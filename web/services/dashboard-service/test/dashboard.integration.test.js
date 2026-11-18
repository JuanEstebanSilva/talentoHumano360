// Tablero de inicio contra una base real. Se omite sin TEST_DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { skip, startRouter } = require('../../test-support/integration');

test('tablero de inicio', { skip }, async (t) => {
  const { call, token } = await startRouter(t, 'dashboard', path.join(__dirname, '../src/routes/dashboard'));
  const usuario = token('Usuario', ['dashboard']);

  await t.test('exige sesión', async () => {
    assert.strictEqual((await call('GET', '/stats')).status, 401);
    assert.strictEqual((await call('GET', '/chart', 'token-falso')).status, 401);
  });

  await t.test('las estadísticas y la gráfica responden con el esquema real', async () => {
    const stats = await call('GET', '/stats', usuario);
    assert.strictEqual(stats.status, 200, JSON.stringify(stats.body));
    assert.strictEqual(typeof stats.body, 'object');
    const chart = await call('GET', '/chart', usuario);
    assert.strictEqual(chart.status, 200, JSON.stringify(chart.body));
  });
});
