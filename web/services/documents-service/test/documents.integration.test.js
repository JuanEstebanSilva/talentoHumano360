// Pruebas de la API contra una base de datos real ya inicializada con los scripts de database/.
// Se omiten si no se define TEST_DATABASE_URL. No usar nunca una base de producción:
//   TEST_DATABASE_URL=postgres://postgres:clave@localhost:5432/talento360_test DB_SSL=false npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.TEST_DATABASE_URL;

test('API de documentos', { skip: !url && 'Definir TEST_DATABASE_URL para ejecutar' }, async (t) => {
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'documentos-test-'));
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
  const suffix = String(Date.now()).slice(-8);
  const cedula = `9${suffix}1`;
  const idPersona = `TEST${suffix}`;

  const created = [];
  t.after(async () => {
    await pool.query('DELETE FROM documentos WHERE id_documento = ANY($1)', [created]).catch(() => {});
    await pool.query('DELETE FROM personas WHERE id_persona = $1', [idPersona]).catch(() => {});
    await pool.end();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(storageDir, { recursive: true, force: true });
    setImmediate(() => process.exit(process.exitCode || 0)); // El pool del router sigue abierto.
  });

  await pool.query(
    'INSERT INTO personas (id_persona, cedula, nombre_completo) VALUES ($1, $2, $3)',
    [idPersona, cedula, 'SERVIDOR DE PRUEBA']
  );

  const tokenFor = (modules, role = 'Usuario') =>
    jwt.sign({ username: `test.${modules.join('.')}`, name: 'Prueba', role, modules }, process.env.JWT_SECRET);
  const gestor = tokenFor(['documents', 'documents_write']);
  const lector = tokenFor(['documents']);
  const ajeno = tokenFor(['dashboard']);
  const sensible = tokenFor(['documents', 'documents_write', 'documents_sensitive']);

  const call = (method, route, token, body) => fetch(base + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  const upload = (route, token, name, content, fields = {}) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
    form.append('archivo', new Blob([content]), name);
    return fetch(base + route, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  };
  const pdf = (text) => Buffer.from(`%PDF-1.7 ${text} ${suffix}`);

  await t.test('exige sesión; cualquier usuario registrado accede, tenga o no el módulo', async () => {
    assert.strictEqual((await call('GET', '', null)).status, 401);
    assert.strictEqual((await call('GET', '', ajeno)).status, 200);
    assert.strictEqual((await call('GET', '', lector)).status, 200);
  });

  await t.test('cualquier usuario registrado puede cargar archivos; sin sesión no', async () => {
    const res = await upload('', lector, 'x.pdf', pdf('lector'));
    assert.strictEqual(res.status, 201);
    created.push((await res.json()).id);
    const anon = await fetch(base, { method: 'POST', body: new FormData() });
    assert.strictEqual(anon.status, 401);
  });

  await t.test('rechaza archivos cuyo contenido no es válido', async () => {
    const res = await upload('', gestor, 'malicioso.pdf', Buffer.from('<script>alert(1)</script>'));
    assert.strictEqual(res.status, 400);
  });

  let pendingId;
  await t.test('sin datos entra a la bandeja con sugerencia y permite confirmar', async () => {
    const res = await upload('', gestor, `HOJA_DE_VIDA_${cedula}.pdf`, pdf('sugerido'));
    assert.strictEqual(res.status, 201);
    const doc = await res.json();
    pendingId = doc.id;
    created.push(doc.id);
    assert.strictEqual(doc.estado, 'Pendiente');
    assert.strictEqual(doc.sugerencia.cedula, cedula);
    assert.strictEqual(doc.sugerencia.tipoNombre, 'Hoja de vida');

    // La bandeja es visible para todo usuario registrado.
    assert.strictEqual((await call('GET', `/${doc.id}`, lector)).status, 200);

    const confirm = await call('PATCH', `/${doc.id}`, gestor, { cedula: doc.sugerencia.cedula, idTipo: doc.sugerencia.idTipo });
    assert.strictEqual(confirm.status, 200);
    const classified = await confirm.json();
    assert.strictEqual(classified.estado, 'Clasificado');
    assert.strictEqual(classified.nombreServidor, 'SERVIDOR DE PRUEBA');
    assert.strictEqual((await call('GET', `/${doc.id}`, lector)).status, 200);
  });

  await t.test('no acepta un archivo idéntico dos veces', async () => {
    const res = await upload('', gestor, 'copia.pdf', pdf('sugerido'));
    assert.strictEqual(res.status, 409);
  });

  await t.test('versiona y conserva cada archivo', async () => {
    const res = await upload(`/${pendingId}/versiones`, gestor, 'Resolución v2.pdf', pdf('segunda'), { nota: 'Corrección' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual((await res.json()).versionActual, 2);

    const first = await call('GET', `/${pendingId}/archivo?version=1`, lector);
    assert.ok((await first.text()).includes('sugerido'));
    const latest = await call('GET', `/${pendingId}/archivo`, lector);
    assert.strictEqual(latest.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(latest.headers.get('content-disposition').startsWith('attachment'));
    assert.ok(latest.headers.get('content-disposition').includes("UTF-8''Resoluci%C3%B3n"));
    assert.ok((await latest.text()).includes('segunda'));

    const detail = await (await call('GET', `/${pendingId}`, gestor)).json();
    assert.strictEqual(detail.versiones.length, 2);
    const acciones = detail.eventos.map(e => e.accion);
    for (const accion of ['Carga', 'Clasificación', 'Nueva versión', 'Descarga']) {
      assert.ok(acciones.includes(accion), `falta el evento ${accion}`);
    }
  });

  await t.test('protege los documentos sensibles desde que entran', async () => {
    const res = await upload('', sensible, `incapacidad ${cedula}.pdf`, pdf('salud'));
    assert.strictEqual(res.status, 201);
    const doc = await res.json();
    created.push(doc.id);
    assert.strictEqual(doc.esSensible, true);

    assert.strictEqual((await call('GET', `/${doc.id}`, gestor)).status, 404);
    assert.strictEqual((await call('GET', `/${doc.id}/archivo`, gestor)).status, 404);
    const list = await (await call('GET', '?limit=200', gestor)).json();
    assert.ok(!list.data.some(d => d.id === doc.id));
    assert.strictEqual((await call('GET', `/${doc.id}`, sensible)).status, 200);

    const tipos = await (await call('GET', '/tipos', gestor)).json();
    assert.ok(!tipos.data.some(x => x.esSensible));
    assert.strictEqual((await call('POST', '/tipos', gestor, { nombre: 'Tipo no autorizado' })).status, 403);
  });

  await t.test('la búsqueda encuentra por cédula con puntos y escapa comodines', async () => {
    const dotted = cedula.replace(/(\d{3})(?=\d)/g, '$1.');
    const found = await (await call('GET', `?q=${encodeURIComponent(dotted)}`, lector)).json();
    assert.ok(found.data.some(d => d.id === pendingId));
    const none = await (await call('GET', `?q=${encodeURIComponent('%')}`, lector)).json();
    assert.strictEqual(none.data.length, 0);
  });

  await t.test('eliminar oculta el documento y conserva el archivo y su historial', async () => {
    assert.strictEqual((await call('DELETE', `/${pendingId}`, null)).status, 401);
    assert.strictEqual((await call('DELETE', `/${pendingId}`, ajeno, { motivo: 'Prueba' })).status, 200);
    assert.strictEqual((await call('GET', `/${pendingId}`, gestor)).status, 404);
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM documento_eventos WHERE id_documento = $1 AND accion = $2', [pendingId, 'Eliminación']);
    assert.strictEqual(Number(rows[0].n), 1);
  });
});
