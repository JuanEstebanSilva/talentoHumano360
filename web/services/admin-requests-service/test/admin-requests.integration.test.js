// Permisos, incapacidades y licencias contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { skip, startRouter, uniqueDoc } = require('../../test-support/integration');

test('módulo de solicitudes administrativas', { skip }, async (t) => {
  const doc = uniqueDoc();
  const { pool, call, token } = await startRouter(t, 'admin-requests', path.join(__dirname, '../src/routes/admin-requests'),
    (p) => p.query('DELETE FROM solicitudes_admin WHERE documento = $1', [doc]));
  const coord = token('Incapacidades'); // responsable del módulo de incapacidades
  const admin = token('Administrador');
  const lector = token('Usuario'); // funcionario sin gestión: solo ve y radica lo propio
  const nueva = { tipo: 'Incapacidad', persona: 'Prueba Integración', documento: doc, dependencia: 'Secretaría de Salud', fechaInicio: '2027-01-04', diasSolicitados: 3 };
  let id;

  await t.test('exige sesión; el funcionario no gestiona solicitudes ajenas', async () => {
    assert.strictEqual((await call('GET', '/')).status, 401);
    assert.strictEqual((await call('GET', '/', lector)).status, 200);
    assert.strictEqual((await call('POST', '/', lector, nueva)).status, 403);
  });

  await t.test('valida tipo, persona y documento', async () => {
    assert.strictEqual((await call('GET', '/?tipo=Vacaciones', coord)).status, 400);
    assert.strictEqual((await call('POST', '/', coord, { ...nueva, tipo: 'Vacaciones' })).status, 400);
    assert.strictEqual((await call('POST', '/', coord, { ...nueva, documento: '' })).status, 400);
  });

  await t.test('crea la solicitud con radicado según el tipo', async () => {
    const res = await call('POST', '/', coord, nueva);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    id = res.body.id;
    assert.match(res.body.radicado, /^INC-2026-\d{5}$/);
    const lista = await call('GET', `/?tipo=Incapacidad&q=${doc}`, coord);
    assert.strictEqual(lista.body.total, 1);
    assert.strictEqual(lista.body.data[0].persona, 'PRUEBA INTEGRACIÓN');
    assert.strictEqual(lista.body.data[0].diasSolicitados, 3);
    assert.strictEqual((await call('GET', `/?tipo=Licencia&q=${doc}`, coord)).body.total, 0);
    const stats = await call('GET', '/stats', coord);
    assert.ok(stats.body.some(s => s.tipo === 'Incapacidad' && Number(s.total) >= 1));
  });

  await t.test('actualiza y cambia el estado con historial', async () => {
    assert.strictEqual((await call('PUT', '/2147483000', coord, nueva)).status, 404);
    const put = await call('PUT', `/${id}`, coord, { ...nueva, diasSolicitados: 5, estado: 'Pendiente' });
    assert.strictEqual(put.status, 200);
    assert.strictEqual((await call('PATCH', `/${id}/status`, admin, {})).status, 400);
    // Control interno: quien radicó la solicitud no cambia su estado salvo que sea Administrador.
    assert.strictEqual((await call('PATCH', `/${id}/status`, coord, { estado: 'en revision' })).status, 403);
    const patch = await call('PATCH', `/${id}/status`, admin, { estado: 'en revision', notaGestion: 'Falta soporte' });
    assert.strictEqual(patch.body.estado, 'En revisión');
    const fila = (await call('GET', `/?tipo=Incapacidad&q=${doc}`, coord)).body.data[0];
    assert.strictEqual(fila.diasSolicitados, 5);
    assert.strictEqual(fila.notaGestion, 'Falta soporte');
    const hist = await pool.query('SELECT 1 FROM historial_solicitudes_admin WHERE id_solicitud = $1', [id]);
    assert.strictEqual(hist.rows.length, 3);
  });

  await t.test('elimina la solicitud', async () => {
    assert.strictEqual((await call('DELETE', '/abc', coord)).status, 400);
    assert.strictEqual((await call('DELETE', '/2147483000', coord)).status, 404);
    assert.strictEqual((await call('DELETE', `/${id}`, lector)).status, 403);
    assert.strictEqual((await call('DELETE', `/${id}`, coord)).status, 200);
    assert.strictEqual((await call('GET', `/?tipo=Incapacidad&q=${doc}`, coord)).body.total, 0);
  });
});
