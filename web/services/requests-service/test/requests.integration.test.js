// Vacaciones (solicitudes) contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { skip, startRouter, uniqueDoc } = require('../../test-support/integration');

test('módulo de vacaciones', { skip }, async (t) => {
  const doc = uniqueDoc();
  const { pool, call, token } = await startRouter(t, 'requests', path.join(__dirname, '../src/routes/requests'),
    (p) => p.query('DELETE FROM vacaciones WHERE documento = $1', [doc]));
  const coord = token('Coordinador');
  const usuario = token('Usuario', ['requests']);
  const nueva = { persona: 'Prueba Integración Vacaciones', documento: doc, dependencia: 'Secretaría General', fechaInicio: '2027-01-04', diasTotales: 15 };
  let id;

  await t.test('exige sesión y solo coordinación o administración escriben', async () => {
    assert.strictEqual((await call('GET', '/')).status, 401);
    assert.strictEqual((await call('GET', '/', 'token-falso')).status, 401);
    assert.strictEqual((await call('POST', '/', usuario, nueva)).status, 403);
  });

  await t.test('valida los campos obligatorios', async () => {
    assert.strictEqual((await call('POST', '/', coord, { ...nueva, fechaInicio: '' })).status, 400);
  });

  await t.test('crea la solicitud con radicado e historial', async () => {
    const res = await call('POST', '/', coord, nueva);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    id = res.body.id;
    assert.match(res.body.radicado, /^VAC-2026-\d{5}$/);
    const hist = await pool.query('SELECT estado_nuevo FROM historial_solicitudes WHERE id_vacacion = $1', [id]);
    assert.deepStrictEqual(hist.rows.map(r => r.estado_nuevo), ['Pendiente']);
  });

  await t.test('la lista la encuentra y la filtra por estado', async () => {
    const res = await call('GET', `/?q=${doc}`, usuario);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 1);
    const fila = res.body.data[0];
    assert.strictEqual(fila.persona, 'PRUEBA INTEGRACIÓN VACACIONES');
    assert.strictEqual(fila.dependencia, 'SECRETARÍA GENERAL');
    assert.strictEqual(fila.tipo, 'Vacaciones');
    assert.strictEqual(fila.estado, 'Pendiente');
    assert.strictEqual((await call('GET', `/?q=${doc}&estado=Aprobada`, usuario)).body.total, 0);
  });

  await t.test('cambia el estado y lo deja en el historial', async () => {
    assert.strictEqual((await call('PATCH', `/${id}/status`, coord, {})).status, 400);
    assert.strictEqual((await call('PATCH', '/2147483000/status', coord, { estado: 'Aprobada' })).status, 404);
    assert.strictEqual((await call('PATCH', `/${id}/status`, usuario, { estado: 'Aprobada' })).status, 403);
    const res = await call('PATCH', `/${id}/status`, coord, { estado: 'aprobada', notaGestion: 'Visto bueno' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.estado, 'Aprobada');
    const hist = await pool.query('SELECT 1 FROM historial_solicitudes WHERE id_vacacion = $1', [id]);
    assert.strictEqual(hist.rows.length, 2);
    assert.strictEqual((await call('GET', `/?q=${doc}&estado=Aprobada`, usuario)).body.total, 1);
  });

  await t.test('elimina la solicitud y su historial', async () => {
    assert.strictEqual((await call('DELETE', '/abc', coord)).status, 400);
    assert.strictEqual((await call('DELETE', '/2147483000', coord)).status, 404);
    assert.strictEqual((await call('DELETE', `/${id}`, usuario)).status, 403);
    assert.strictEqual((await call('DELETE', `/${id}`, coord)).status, 200);
    const hist = await pool.query('SELECT 1 FROM historial_solicitudes WHERE id_vacacion = $1', [id]);
    assert.strictEqual(hist.rows.length, 0);
    assert.strictEqual((await call('GET', `/?q=${doc}`, usuario)).body.total, 0);
  });
});
