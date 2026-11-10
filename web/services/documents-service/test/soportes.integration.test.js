// Soportes de solicitudes administrativas contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.TEST_DATABASE_URL;

test('soportes de solicitudes', { skip: !url && 'Definir TEST_DATABASE_URL para ejecutar' }, async (t) => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soportes-test-'));
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
  process.env.DOCUMENTS_STORAGE_DIR = storageDir;

  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { Pool } = require('pg');
  const routes = require('../src/routes/documents');

  const app = express();
  app.use(express.json());
  app.use('/api/documents', routes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/documents`;
  const pool = new Pool({ connectionString: url, ssl: false });

  const tag = `S${String(Date.now()).slice(-9)}`;
  const docs = [];
  const requests = [];
  t.after(async () => {
    await pool.query('DELETE FROM documentos WHERE id_documento = ANY($1)', [docs]).catch(() => {});
    await pool.query('DELETE FROM solicitudes_admin WHERE id_solicitud = ANY($1)', [requests]).catch(() => {});
    await pool.end();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(storageDir, { recursive: true, force: true });
    setImmediate(() => process.exit(process.exitCode || 0));
  });

  const newRequest = async (tipo, documento = tag) => {
    const { rows } = await pool.query(
      `INSERT INTO solicitudes_admin (tipo, dependencia, apellidos_nombres, documento) VALUES ($1, 'DEP', 'SERVIDOR SIN FICHA', $2) RETURNING id_solicitud`,
      [tipo, documento]
    );
    requests.push(rows[0].id_solicitud);
    return rows[0].id_solicitud;
  };
  const token = (modules, role = 'Usuario') => jwt.sign({ username: 'prueba@local', role, modules }, process.env.JWT_SECRET);
  const coordinador = token([], 'Coordinador');
  const gestor = token(['documents', 'documents_write', 'admin-requests']);
  const sinSolicitudes = token(['documents', 'documents_write', 'documents_sensitive']);

  let counter = 0;
  const upload = async (id, tk, content = `%PDF-1.7 soporte ${tag} ${++counter}`, name = 'soporte médico.pdf') => {
    const form = new FormData();
    form.append('archivo', new Blob([content]), name);
    const res = await fetch(`${base}/soportes/solicitud/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${tk}` }, body: form });
    return { status: res.status, body: await res.json() };
  };
  const list = async (id, tk) => {
    const res = await fetch(`${base}/soportes/solicitud/${id}`, { headers: { Authorization: `Bearer ${tk}` } });
    return { status: res.status, body: await res.json() };
  };

  await t.test('una incapacidad queda clasificada, vinculada y protegida como sensible', async () => {
    const id = await newRequest('Incapacidad');
    const res = await upload(id, coordinador);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    docs.push(res.body.id);
    assert.strictEqual(res.body.estado, 'Clasificado');
    assert.strictEqual(res.body.esSensible, true);
    assert.strictEqual(res.body.cedula, tag); // Funciona aunque el servidor no tenga ficha en personas.
    assert.strictEqual(res.body.nombreArchivo, 'soporte médico.pdf');

    const coord = await list(id, coordinador);
    assert.deepStrictEqual(coord.body.data.map(d => d.id), [res.body.id]);

    // Con acceso a solicitudes pero sin permiso sensible: ni aparece ni se abre.
    const limitado = await list(id, gestor);
    assert.strictEqual(limitado.status, 200);
    assert.deepStrictEqual(limitado.body.data, []);
    assert.strictEqual(limitado.body.restringido, true);
    assert.strictEqual(limitado.body.puedeAdjuntar, false);
    assert.strictEqual(coord.body.restringido, false);
    assert.strictEqual(coord.body.puedeAdjuntar, true);

    // La respuesta es idéntica haya o no soporte: no revela si existe uno.
    const vacia = await list(await newRequest('Incapacidad'), gestor);
    assert.deepStrictEqual(vacia.body, limitado.body);
    const directo = await fetch(`${base}/${res.body.id}/archivo`, { headers: { Authorization: `Bearer ${gestor}` } });
    assert.strictEqual(directo.status, 404);
  });

  await t.test('sin permiso sensible no se puede adjuntar a una incapacidad ni a una licencia', async () => {
    for (const tipo of ['Incapacidad', 'Licencia']) {
      const res = await upload(await newRequest(tipo), gestor);
      assert.strictEqual(res.status, 403, tipo);
    }
  });

  await t.test('un permiso laboral se adjunta y lo ve quien gestiona documentos', async () => {
    const id = await newRequest('Permiso Laboral');
    const res = await upload(id, gestor);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    docs.push(res.body.id);
    assert.strictEqual(res.body.esSensible, false);
    const lista = await list(id, gestor);
    assert.strictEqual(lista.body.data.length, 1);
    assert.strictEqual(lista.body.restringido, false);
    assert.strictEqual(lista.body.puedeAdjuntar, true);

    // Todo usuario registrado con acceso a solicitudes lo ve y puede adjuntar (no es sensible).
    const lector = await list(id, token(['documents', 'admin-requests']));
    assert.strictEqual(lector.body.data.length, 1);
    assert.strictEqual(lector.body.puedeAdjuntar, true);
  });

  await t.test('consultar los soportes de una solicitud inexistente responde 404', async () => {
    assert.strictEqual((await list(2147483000, coordinador)).status, 404);
  });

  await t.test('exige sesión y acceso a solicitudes; el módulo de documentos ya no se exige', async () => {
    const id = await newRequest('Permiso Laboral');
    assert.strictEqual((await upload(id, sinSolicitudes)).status, 403);
    assert.strictEqual((await list(id, sinSolicitudes)).status, 403);
    assert.strictEqual((await list(id, token(['dashboard']))).status, 403);
    assert.strictEqual((await upload(id, token(['dashboard']))).status, 403);
    assert.strictEqual((await upload(id, '')).status, 401);
    assert.strictEqual((await list(id, '')).status, 401);
    // Con acceso a solicitudes basta: no hace falta el módulo de documentos ni el de escritura.
    const sinModulo = await upload(id, token(['admin-requests']));
    assert.strictEqual(sinModulo.status, 201, JSON.stringify(sinModulo.body));
    docs.push(sinModulo.body.id);
    const soloLectura = await upload(id, token(['documents', 'admin-requests']));
    assert.strictEqual(soloLectura.status, 201, JSON.stringify(soloLectura.body));
    docs.push(soloLectura.body.id);
  });

  await t.test('valida solicitud, cédula y contenido del archivo', async () => {
    assert.strictEqual((await upload(2147483000, coordinador)).status, 404);
    assert.strictEqual((await upload(await newRequest('Licencia', ''), coordinador)).status, 400);
    assert.strictEqual((await upload(await newRequest('Licencia'), coordinador, '<script>alert(1)</script>', 'falso.pdf')).status, 400);
  });

  await t.test('eliminar la solicitud conserva el soporte y su historial', async () => {
    const id = await newRequest('Licencia');
    const res = await upload(id, coordinador);
    docs.push(res.body.id);
    await pool.query('DELETE FROM solicitudes_admin WHERE id_solicitud = $1', [id]);
    const { rows } = await pool.query('SELECT id_solicitud_admin, eliminado_en FROM documentos WHERE id_documento = $1', [res.body.id]);
    assert.strictEqual(rows[0].id_solicitud_admin, null);
    assert.strictEqual(rows[0].eliminado_en, null);
    const events = await pool.query(`SELECT 1 FROM documento_eventos WHERE id_documento = $1 AND accion = 'Carga'`, [res.body.id]);
    assert.strictEqual(events.rows.length, 1);
  });
});
