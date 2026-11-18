// Perfil epidemiológico de SST contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { skip, startRouter, uniqueDoc } = require('../../test-support/integration');

test('módulo de SST: perfil epidemiológico', { skip }, async (t) => {
  const doc = uniqueDoc();
  const ids = [];
  const { pool, call, token } = await startRouter(t, 'sst', path.join(__dirname, '../src/routes/sst'), async (p) => {
    await p.query(`DELETE FROM sst_historial WHERE submodulo = 'epidemiologico' AND id_registro = ANY($1)`, [ids]);
    await p.query('DELETE FROM sst_perfil_epidemiologico WHERE documento = $1', [doc]);
    await p.query('DELETE FROM sst_entrega_epp WHERE documento = $1', [doc]);
    await p.query('DELETE FROM sst_perfil_sociodemografico WHERE documento = $1', [doc]);
    await p.query('DELETE FROM importaciones WHERE archivo LIKE $1', [`${doc}%`]);
  });
  const coord = token('SST'); // responsable SST: gestiona todo el módulo
  const lector = token('Usuario'); // funcionario: solo ve lo propio y no escribe
  const nuevo = { documento: doc, nombreCompleto: 'Prueba Salud Ana María', dependencia: 'Secretaría General', fechaEmo: '2026-03-15', tipoEmo: 'Periódico' };
  let id;

  await t.test('los datos de salud exigen sesión, y escribir exige ser responsable SST', async () => {
    assert.strictEqual((await call('GET', '/epidemiologico')).status, 401);
    assert.strictEqual((await call('GET', '/epidemiologico', lector)).status, 200);
    assert.strictEqual((await call('POST', '/epidemiologico', lector, nuevo)).status, 403);
  });

  await t.test('valida documento y nombre', async () => {
    assert.strictEqual((await call('POST', '/epidemiologico', coord, { ...nuevo, documento: '' })).status, 400);
    assert.strictEqual((await call('POST', '/epidemiologico', coord, { documento: doc })).status, 400);
  });

  await t.test('crea el registro y programa el próximo examen a un año', async () => {
    const res = await call('POST', '/epidemiologico', coord, nuevo);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    id = res.body.id;
    ids.push(id);
    assert.match(res.body.radicado, /^EMO-2026-\d{4,}$/);
    const lista = await call('GET', `/epidemiologico?q=${doc}`, coord);
    assert.strictEqual(lista.body.total, 1);
    const fila = lista.body.data[0];
    assert.strictEqual(fila.nombreCompleto, 'PRUEBA SALUD ANA MARÍA');
    assert.strictEqual(fila.fechaEmo, '2026-03-15');
    assert.strictEqual(fila.fechaProximoEmo, '2027-03-15');
  });

  await t.test('un examen de egreso no programa uno nuevo', async () => {
    const res = await call('POST', '/epidemiologico', coord, { ...nuevo, tipoEmo: 'Egreso' });
    assert.strictEqual(res.status, 201);
    ids.push(res.body.id);
    const lista = await call('GET', `/epidemiologico?q=${doc}&tipoEmo=Egreso`, coord);
    assert.strictEqual(lista.body.total, 1);
    assert.strictEqual(lista.body.data[0].fechaProximoEmo, '');
  });

  await t.test('cambia el estado del caso', async () => {
    assert.strictEqual((await call('PATCH', `/epidemiologico/${id}/status`, lector, { estadoFinalCaso: 'Cerrado' })).status, 403);
    assert.strictEqual((await call('PATCH', '/epidemiologico/2147483000/status', coord, { estadoFinalCaso: 'Cerrado' })).status, 404);
    assert.strictEqual((await call('PATCH', `/epidemiologico/${id}/status`, coord, { estadoFinalCaso: 'Cerrado' })).status, 200);
    const lista = await call('GET', `/epidemiologico?q=${doc}&estadoCaso=Cerrado`, coord);
    assert.strictEqual(lista.body.total, 1);
    assert.strictEqual(lista.body.data[0].id, id);
  });

  await t.test('elimina el registro', async () => {
    assert.strictEqual((await call('DELETE', `/epidemiologico/${id}`, lector)).status, 403);
    assert.strictEqual((await call('DELETE', '/epidemiologico/2147483000', coord)).status, 404);
    assert.strictEqual((await call('DELETE', `/epidemiologico/${id}`, coord)).status, 200);
    assert.strictEqual((await call('GET', `/epidemiologico?q=${doc}&estadoCaso=Cerrado`, coord)).body.total, 0);
  });

  await t.test('entrega de EPP: crea, consulta y elimina', async () => {
    assert.strictEqual((await call('POST', '/epp', lector, { documento: doc, nombreCompleto: 'X' })).status, 403);
    assert.strictEqual((await call('POST', '/epp', coord, { documento: doc })).status, 400);
    const epp = { documento: doc, nombreCompleto: 'Prueba Salud Ana María', elementoEpp: 'Guantes', fechaEntrega: '2026-03-15' };
    const res = await call('POST', '/epp', coord, epp);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.radicado, /^EPP-2026-\d{4,}$/);
    const lista = await call('GET', `/epp?q=${doc}`, coord);
    assert.strictEqual(lista.body.total, 1);
    assert.strictEqual(lista.body.data[0].id, res.body.id);
    assert.strictEqual((await call('DELETE', `/epp/${res.body.id}`, coord)).status, 200);
    assert.strictEqual((await call('GET', `/epp?q=${doc}`, coord)).body.total, 0);
  });

  await t.test('perfil sociodemográfico: crea, consulta y elimina', async () => {
    assert.strictEqual((await call('POST', '/sociodemografico', coord, { documento: doc })).status, 400);
    const res = await call('POST', '/sociodemografico', coord, { documento: doc, nombreCompleto: 'Prueba Salud Ana María' });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.radicado, /^SOC-2026-\d{4,}$/);
    const lista = await call('GET', `/sociodemografico?q=${doc}`, coord);
    assert.strictEqual(lista.body.total, 1);
    assert.strictEqual(lista.body.data[0].id, res.body.id);
    assert.strictEqual((await call('DELETE', `/sociodemografico/${res.body.id}`, coord)).status, 200);
    assert.strictEqual((await call('GET', `/sociodemografico?q=${doc}`, coord)).body.total, 0);
  });

  await t.test('el historial registra las cargas rechazadas y fallidas con su motivo', async () => {
    assert.strictEqual((await call('POST', '/epp/bulk', coord, { rows: [], nombreArchivo: `${doc}-vacio.xlsx` })).status, 400);
    const falla = await call('POST', '/sociodemografico/bulk', coord, { rows: [{ documento: 'X'.repeat(300), nombreCompleto: 'FALLA' }], nombreArchivo: `${doc}-falla.xlsx` });
    assert.strictEqual(falla.status, 500);
    // Sin permiso no es un intento de carga: no se registra.
    assert.strictEqual((await call('POST', '/epp/bulk', lector, { rows: [{}], nombreArchivo: `${doc}-sinpermiso.xlsx` })).status, 403);
    await new Promise((resolve) => setTimeout(resolve, 300)); // El registro no bloquea la respuesta.
    const { rows } = await pool.query(
      'SELECT archivo, resultado, motivo, total_filas, insertados FROM importaciones WHERE archivo LIKE $1 ORDER BY id_importacion', [`${doc}%`]);
    assert.deepStrictEqual(rows.map(r => [r.archivo, r.resultado, r.total_filas, r.insertados]), [
      [`${doc}-vacio.xlsx`, 'Rechazada', 0, 0],
      [`${doc}-falla.xlsx`, 'Fallida', 1, 0],
    ]);
    assert.match(rows[0].motivo, /No se recibieron/);
    assert.match(rows[1].motivo, /Error en carga masiva/);
  });
});
