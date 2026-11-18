// Entrada automática contra una base de datos real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.TEST_DATABASE_URL;

test('entrada automática de documentos', { skip: !url && 'Definir TEST_DATABASE_URL para ejecutar' }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bandeja-test-'));
  const inboxDir = path.join(root, 'bandeja');
  fs.mkdirSync(inboxDir);
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
  process.env.DOCUMENTS_STORAGE_DIR = path.join(root, 'almacen');
  process.env.DOCUMENTS_INBOX_DIR = inboxDir;

  const { Pool } = require('pg');
  const routes = require('../src/routes/documents');
  const pool = new Pool({ connectionString: url, ssl: false });

  const suffix = String(Date.now()).slice(-8);
  const cedula = `8${suffix}2`;
  const idPersona = `INB${suffix}`;
  const ids = [];
  t.after(async () => {
    await pool.query('DELETE FROM documentos WHERE id_documento = ANY($1)', [ids]).catch(() => {});
    await pool.query('DELETE FROM personas WHERE id_persona = $1', [idPersona]).catch(() => {});
    await pool.end();
    fs.rmSync(root, { recursive: true, force: true });
    setImmediate(() => process.exit(process.exitCode || 0));
  });
  await pool.query('INSERT INTO personas (id_persona, cedula, nombre_completo) VALUES ($1, $2, $3)', [idPersona, cedula, 'SERVIDOR BANDEJA']);

  const write = (name, content) => fs.writeFileSync(path.join(inboxDir, name), content);
  const listing = (sub) => fs.readdirSync(path.join(inboxDir, sub));
  const scan = () => routes.scanInbox({ minAgeMs: 0 });

  await t.test('un archivo válido entra a la bandeja con sugerencia y sale de la carpeta', async () => {
    write(`HOJA_DE_VIDA_${cedula}.pdf`, `%PDF-1.7 entrada ${suffix}`);
    const results = await scan();
    assert.strictEqual(results[0].resultado, 'procesado');
    assert.strictEqual(listing('procesados').length, 1);
    assert.ok(!fs.existsSync(path.join(inboxDir, `HOJA_DE_VIDA_${cedula}.pdf`)));

    const { rows } = await pool.query(
      `SELECT d.id_documento, d.estado, d.cedula_sugerida, d.creado_por, ts.nombre AS tipo
         FROM documentos d LEFT JOIN tipos_documento ts ON ts.id_tipo = d.id_tipo_sugerido
        WHERE d.cedula_sugerida = $1`,
      [cedula]
    );
    assert.strictEqual(rows.length, 1);
    ids.push(rows[0].id_documento);
    assert.strictEqual(rows[0].estado, 'Pendiente'); // Nunca se clasifica sin confirmación humana.
    assert.strictEqual(rows[0].tipo, 'Hoja de vida');
    assert.strictEqual(rows[0].creado_por, 'entrada-automatica');
  });

  await t.test('un archivo no admitido o duplicado se rechaza con su motivo', async () => {
    write('malicioso.pdf', '<script>alert(1)</script>');
    write('copia.pdf', `%PDF-1.7 entrada ${suffix}`);
    const results = await scan();
    assert.deepStrictEqual(results.map(r => r.resultado), ['rechazado', 'rechazado']);
    const rejected = listing('rechazados');
    assert.strictEqual(rejected.filter(f => f.endsWith('.motivo.txt')).length, 2);
    const reasons = rejected.filter(f => f.endsWith('.motivo.txt'))
      .map(f => fs.readFileSync(path.join(inboxDir, 'rechazados', f), 'utf8')).join(' ');
    assert.match(reasons, /Formato no admitido/);
    assert.match(reasons, /ya está cargado/);
  });

  await t.test('ignora temporales, subcarpetas y archivos que aún se están copiando', async () => {
    write('~$bloqueo.pdf', '%PDF-1.7 x');
    write('descarga.pdf.part', '%PDF-1.7 x');
    write('reciente.pdf', `%PDF-1.7 reciente ${suffix}`);
    const results = await routes.scanInbox({ minAgeMs: 60000 });
    assert.deepStrictEqual(results, []);
    assert.ok(fs.existsSync(path.join(inboxDir, 'reciente.pdf')));
    assert.ok(fs.existsSync(path.join(inboxDir, '~$bloqueo.pdf')));

    fs.rmSync(path.join(inboxDir, 'reciente.pdf'));
  });
});
