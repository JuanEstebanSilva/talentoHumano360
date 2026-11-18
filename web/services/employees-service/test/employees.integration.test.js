// Servidores públicos contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { skip, startRouter, uniqueDoc } = require('../../test-support/integration');

test('módulo de servidores públicos', { skip }, async (t) => {
  const cedula = uniqueDoc();
  let coord;
  const { call, token } = await startRouter(t, 'employees', path.join(__dirname, '../src/routes/employees'),
    // La ficha ocupa varias tablas: se limpia con la misma ruta de eliminación.
    () => call('DELETE', `/${cedula}`, coord));
  coord = token('Administrador');
  const editor = token('Usuario', ['employees'], ['employees:read', 'employees:write']);
  const lector = token('Usuario', ['employees'], ['employees:read']);
  const sst = token('Usuario', ['sst'], ['sst:read']);
  const ajeno = token('Usuario', ['viaticos'], ['viaticos:read']);
  const nuevo = { nombreCompleto: 'Prueba Integración Ana', cedula, dependencia: 'Secretaría General', cargoActual: 'Profesional Universitario' };

  await t.test('el listado y la ficha exigen el permiso employees:read', async () => {
    assert.strictEqual((await call('GET', '/')).status, 401);
    assert.strictEqual((await call('GET', '/', ajeno)).status, 403);
    assert.strictEqual((await call('GET', `/${cedula}`, ajeno)).status, 403);
    assert.strictEqual((await call('GET', '/', lector)).status, 200);
    assert.strictEqual((await call('GET', '/', sst)).status, 403);
    assert.strictEqual((await call('GET', '/', editor)).status, 200);
  });

  await t.test('valida nombre y permisos al crear', async () => {
    assert.strictEqual((await call('POST', '/', lector, nuevo)).status, 403);
    assert.strictEqual((await call('POST', '/', editor, { ...nuevo, nombreCompleto: '' })).status, 400);
    assert.strictEqual((await call('POST', '/', editor, { ...nuevo, nombreCompleto: 'Ana 123' })).status, 400);
  });

  await t.test('crea el servidor y rechaza la cédula repetida', async () => {
    const res = await call('POST', '/', editor, nuevo);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.cedula, cedula);
    assert.strictEqual(res.body.documento_pendiente, false);
    assert.strictEqual((await call('POST', '/', editor, nuevo)).status, 409);
  });

  await t.test('la ficha muestra lo registrado', async () => {
    const res = await call('GET', `/${cedula}`, lector);
    assert.strictEqual(res.status, 200);
    const texto = JSON.stringify(res.body);
    assert.ok(texto.includes(cedula));
    assert.ok(texto.includes('ANA'));
  });

  await t.test('valida el cambio de estado', async () => {
    assert.strictEqual((await call('PATCH', `/${cedula}/status`, lector, { estadoServidor: 'Inactivo' })).status, 403);
    assert.strictEqual((await call('PATCH', `/${cedula}/status`, editor, {})).status, 400);
    assert.strictEqual((await call('PATCH', `/${cedula}/status`, editor, { estadoServidor: 'Vacaciones' })).status, 400);
    const res = await call('PATCH', `/${cedula}/status`, editor, { estadoServidor: 'Inactivo' });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  });

  await t.test('elimina el servidor', async () => {
    assert.strictEqual((await call('DELETE', `/${cedula}`, lector)).status, 403);
    assert.strictEqual((await call('DELETE', `/${cedula}`, editor)).status, 200);
    assert.strictEqual((await call('GET', `/${cedula}`, lector)).status, 404);
    assert.strictEqual((await call('DELETE', `/${cedula}`, editor)).status, 404);
  });
});
