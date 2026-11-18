// Historial de cargas masivas: el middleware lee la respuesta de la ruta y la registra.
// Prueba unitaria con una base simulada. Todos los servicios usan una copia idéntica del archivo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const trackImport = require('../src/utils/importHistory');

function run(body, status, req) {
  const queries = [];
  const pool = { query: (sql, params) => { queries.push({ sql, params }); return Promise.resolve(); } };
  const res = { statusCode: status, json(b) { this.sent = b; return this; } };
  trackImport(pool, 'requests')(req, res, () => {});
  res.json(body);
  return { queries, res };
}

test('registra una carga confirmada con los totales de la respuesta', () => {
  const req = { body: { rows: [{}, {}, {}], nombreArchivo: 'vacaciones.xlsx' }, user: { username: 'ana@prueba' } };
  const { queries, res } = run({ inserted: 2, skipped: 1, errors: ['Fila 3: sin documento'] }, 200, req);
  assert.deepStrictEqual(res.sent, { inserted: 2, skipped: 1, errors: ['Fila 3: sin documento'] });
  assert.strictEqual(queries.length, 1);
  const [modulo, archivo, usuario, total, ins, act, dup, omit, errores] = queries[0].params;
  assert.deepStrictEqual([modulo, archivo, usuario, total, ins, act, dup, omit], ['requests', 'vacaciones.xlsx', 'ana@prueba', 3, 2, 0, 0, 1]);
  assert.deepStrictEqual(JSON.parse(errores), ['Fila 3: sin documento']);
});

test('lee el resumen de viáticos y horarios y los errores con hoja y fila', () => {
  const req = { body: { rows: [{}, {}] }, user: { username: 'u' } };
  const { queries } = run({ resumen: { insertados: 1, actualizados: 1, omitidos: 0 }, errores: [{ hoja: 'A', fila: 4, error: 'fecha inválida' }] }, 200, req);
  const p = queries[0].params;
  assert.deepStrictEqual(p.slice(3, 8), [2, 1, 1, 0, 0]);
  assert.deepStrictEqual(JSON.parse(p[8]), ['Hoja A, fila 4: fecha inválida']);
});

test('registra rechazos y fallos con su motivo, pero no los 401 y 403', () => {
  const req = { body: { rows: [], nombreArchivo: 'vacio.xlsx' }, user: { username: 'u' } };
  let r = run({ error: 'No se recibieron registros para importar.' }, 400, req);
  assert.deepStrictEqual(r.queries[0].params, ['requests', 'vacio.xlsx', 'u', 0, 'Rechazada', 'No se recibieron registros para importar.']);
  r = run({ error: 'Error interno' }, 500, req);
  assert.strictEqual(r.queries[0].params[4], 'Fallida');
  assert.strictEqual(run({ error: 'Permisos insuficientes.' }, 403, req).queries.length, 0);
  assert.strictEqual(run({ error: 'Token requerido.' }, 401, req).queries.length, 0);
});

test('un fallo de la base no cambia la respuesta', async () => {
  const pool = { query: () => Promise.reject(new Error('sin conexión')) };
  const res = { statusCode: 200, json(b) { this.sent = b; return this; } };
  trackImport(pool, 'requests')({ body: { rows: [] } }, res, () => {});
  const warn = console.warn; console.warn = () => {};
  try {
    res.json({ inserted: 0 });
    await new Promise((r) => setImmediate(r));
  } finally { console.warn = warn; }
  assert.deepStrictEqual(res.sent, { inserted: 0 });
});

test('todas las copias del middleware son idénticas', () => {
  const services = path.resolve(__dirname, '../..');
  const mine = fs.readFileSync(path.join(__dirname, '../src/utils/importHistory.js'), 'utf8');
  for (const svc of ['admin-requests-service', 'employees-service', 'horarios-service', 'sst-service', 'viaticos-service']) {
    const file = path.join(services, svc, 'src/utils/importHistory.js');
    if (fs.existsSync(file)) assert.strictEqual(fs.readFileSync(file, 'utf8'), mine, svc);
  }
});
