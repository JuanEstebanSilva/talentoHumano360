const test = require('node:test');
const assert = require('node:assert');

const { SOURCES, getSource } = require('../src/utils/catalog');
const { resolvePeriod, buildWhere, pickColumns, ReportError } = require('../src/utils/reportEngine');
const { parseBogotaDateTime, computeNextRun, validateSchedule } = require('../src/utils/schedule');
const { canAccessSource, canAutomate } = require('../src/utils/permissions');

const bogota = (value) => parseBogotaDateTime(value);

test('parseBogotaDateTime interpreta la hora de Colombia y rechaza fechas imposibles', () => {
  assert.strictEqual(bogota('2026-03-01T08:00').toISOString(), '2026-03-01T13:00:00.000Z');
  assert.strictEqual(bogota('2026-02-30T08:00'), null);
  assert.strictEqual(bogota('2026-03-01T25:00'), null);
  assert.strictEqual(bogota('cualquier cosa'), null);
});

test('computeNextRun: la primera ejecución futura se respeta', () => {
  const inicio = bogota('2026-12-01T08:00');
  assert.strictEqual(
    computeNextRun({ frecuencia: 'diaria', inicio }, bogota('2026-11-01T08:00')).getTime(),
    inicio.getTime()
  );
});

test('computeNextRun: diaria, semanal y personalizada avanzan sin acumular atrasos', () => {
  const inicio = bogota('2026-01-01T08:00');
  const after = bogota('2026-01-10T09:00');
  assert.strictEqual(computeNextRun({ frecuencia: 'diaria', inicio }, after).getTime(), bogota('2026-01-11T08:00').getTime());
  assert.strictEqual(computeNextRun({ frecuencia: 'semanal', inicio }, after).getTime(), bogota('2026-01-15T08:00').getTime());
  assert.strictEqual(
    computeNextRun({ frecuencia: 'personalizada', intervalo: 6, unidad: 'horas', inicio }, after).getTime(),
    bogota('2026-01-10T14:00').getTime()
  );
});

test('computeNextRun: mensual ajusta el día 31 al último día del mes', () => {
  const inicio = bogota('2026-01-31T08:00');
  assert.strictEqual(computeNextRun({ frecuencia: 'mensual', inicio }, bogota('2026-02-01T00:00')).getTime(), bogota('2026-02-28T08:00').getTime());
  assert.strictEqual(computeNextRun({ frecuencia: 'mensual', inicio }, bogota('2026-02-28T08:00')).getTime(), bogota('2026-03-31T08:00').getTime());
  assert.strictEqual(computeNextRun({ frecuencia: 'mensual', inicio }, bogota('2026-12-31T09:00')).getTime(), bogota('2027-01-31T08:00').getTime());
});

test('validateSchedule rechaza frecuencias e intervalos inválidos', () => {
  assert.strictEqual(validateSchedule({ frecuencia: 'mensual' }), null);
  assert.ok(validateSchedule({ frecuencia: 'cada rato' }));
  assert.ok(validateSchedule({ frecuencia: 'personalizada', intervalo: 0, unidad: 'dias' }));
  assert.ok(validateSchedule({ frecuencia: 'personalizada', intervalo: 2, unidad: 'minutos' }));
  assert.strictEqual(validateSchedule({ frecuencia: 'personalizada', intervalo: 2, unidad: 'horas' }), null);
});

test('resolvePeriod calcula los periodos relativos en hora de Colombia', () => {
  // 1 de marzo a las 02:00 UTC todavía es 28 de febrero en Colombia.
  const now = new Date('2026-03-01T02:00:00Z');
  assert.deepStrictEqual(resolvePeriod('mes_actual', now), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepStrictEqual(resolvePeriod('mes_anterior', now), { desde: '2026-01-01', hasta: '2026-01-31' });
  assert.deepStrictEqual(resolvePeriod('ultimos_7', now), { desde: '2026-02-22', hasta: '2026-02-28' });
  assert.deepStrictEqual(resolvePeriod('anio_anterior', now), { desde: '2025-01-01', hasta: '2025-12-31' });
  // Enero: el mes anterior está en el año anterior.
  assert.deepStrictEqual(resolvePeriod('mes_anterior', new Date('2026-01-15T12:00:00Z')), { desde: '2025-12-01', hasta: '2025-12-31' });
});

test('buildWhere combina filtros y nunca inserta valores en el SQL', () => {
  const source = getSource('solicitudes');
  const attack = "x'; DROP TABLE usuarios; --";
  const { where, params, criterios } = buildWhere(source, {
    nombre: attack,
    tipo: 'Incapacidad',
    documento: '1.057.123.456',
    inicio: { desde: '2026-01-01', hasta: '2026-01-31' },
    dias: { min: 2, max: '' },
  });
  assert.ok(!where.includes('DROP TABLE'));
  assert.ok(params.includes(`%${attack}%`));
  assert.ok(params.includes('1057123456'));
  assert.ok(params.includes('Incapacidad'));
  assert.strictEqual(criterios.length, 5);
  assert.ok(where.includes(' AND '));
});

test('buildWhere rechaza filtros desconocidos y rangos inválidos', () => {
  const source = getSource('vacaciones');
  assert.throws(() => buildWhere(source, { 'x; DROP': 'a' }), ReportError);
  assert.throws(() => buildWhere(source, { inicio: { desde: '2026-02-30' } }), ReportError);
  assert.throws(() => buildWhere(source, { inicio: { desde: '2026-02-01', hasta: '2026-01-01' } }), ReportError);
  assert.throws(() => buildWhere(source, { inicio: { periodo: 'cuando_sea' } }), ReportError);
  assert.throws(() => buildWhere(source, []), ReportError);
});

test('pickColumns solo acepta columnas del catálogo', () => {
  const source = getSource('vacaciones');
  assert.deepStrictEqual(pickColumns(source, ['nombre', 'estado']).map(c => c.key), ['nombre', 'estado']);
  assert.throws(() => pickColumns(source, ['password']), ReportError);
  assert.ok(pickColumns(source).length > 0);
});

test('permisos: una fuente exige todos sus módulos y nunca depende del nombre', () => {
  const novedades = getSource('novedades');
  const usuario = { name: 'Angela', role: 'Usuario', modules: ['reports', 'viaticos'] };
  assert.strictEqual(canAccessSource(usuario, getSource('viaticos')), true);
  assert.strictEqual(canAccessSource(usuario, getSource('sst_emo')), false);
  assert.strictEqual(canAccessSource(usuario, novedades), false);
  assert.strictEqual(canAccessSource({ role: 'Coordinador', modules: [] }, novedades), true);
  // Informes y automatización: todo usuario registrado; sin sesión no.
  assert.strictEqual(canAutomate({ ...usuario, username: 'angela.falsa' }), true);
  assert.strictEqual(canAutomate({ username: 'x', role: 'Usuario', modules: [] }), true);
  assert.strictEqual(canAutomate(usuario), false);
  assert.strictEqual(canAutomate(null), false);
});

test('el catálogo es coherente: claves únicas y sin exponer contraseñas ni adjuntos', () => {
  assert.strictEqual(new Set(SOURCES.map(s => s.id)).size, SOURCES.length);
  for (const source of SOURCES) {
    assert.strictEqual(new Set(source.columnas.map(c => c.key)).size, source.columnas.length, source.id);
    assert.strictEqual(new Set(source.filtros.map(f => f.key)).size, source.filtros.length, source.id);
    for (const column of source.columnas) {
      assert.ok(!/password|soporte/i.test(column.expr), `${source.id}.${column.key}`);
    }
  }
});
