// Pruebas contra una base de datos real ya inicializada con los scripts de database/.
// Se omiten si no se define TEST_DATABASE_URL. No usar nunca una base de producción.

const test = require('node:test');
const assert = require('node:assert');

const url = process.env.TEST_DATABASE_URL;

test('API de informes y automatización', { skip: !url && 'Definir TEST_DATABASE_URL para ejecutar' }, async (t) => {
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
  process.env.REPORTS_SCHEDULER = 'off';

  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { Pool } = require('pg');
  const { SOURCES } = require('../src/utils/catalog');
  const reportsRoutes = require('../src/routes/reports');
  const automationRoutes = require('../src/routes/automation');

  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportsRoutes);
  app.use('/api/automation', automationRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const pool = new Pool({ connectionString: url, ssl: false });
  const tag = `T${String(Date.now()).slice(-8)}`;
  const owner = `${tag.toLowerCase()}@prueba.local`;

  const createdAutomations = [];
  t.after(async () => {
    await pool.query('DELETE FROM automatizaciones WHERE id_automatizacion = ANY($1)', [createdAutomations]).catch(() => {});
    await pool.query('DELETE FROM solicitudes_admin WHERE documento = $1', [tag]).catch(() => {});
    await pool.query('DELETE FROM usuarios WHERE username = $1', [owner]).catch(() => {});
    await pool.end();
    await new Promise((resolve) => server.close(resolve));
    setImmediate(() => process.exit(process.exitCode || 0)); // El pool del servicio sigue abierto.
  });

  await pool.query(
    `INSERT INTO solicitudes_admin (tipo, dependencia, apellidos_nombres, documento, fecha_inicio, fecha_fin, dias_solicitados, estado) VALUES
     ('Incapacidad', 'DEP A', 'PERSONA UNO', $1, '15/01/2026', '2026-01-20', 5, 'Aprobada'),
     ('Permiso Laboral', 'DEP A', 'PERSONA DOS', $1, '2026-02-10', '2026-02-11', 1, 'Pendiente'),
     ('Incapacidad', 'DEP B', 'PERSONA TRES', $1, '2026-03-05', '2026-03-06', 2, 'Aprobada')`,
    [tag]
  );
  await pool.query(
    `INSERT INTO usuarios (username, password, nombre, rol, estado, modulos)
     VALUES ($1, 'x', 'Dueño', 'Usuario', 'ACTIVO', 'reports,reports_write,admin-requests')`,
    [owner]
  );

  const tokenFor = (modules, username = 'otro@prueba.local', role = 'Usuario') =>
    jwt.sign({ username, role, modules }, process.env.JWT_SECRET);
  const gestor = tokenFor(['reports', 'reports_write', 'admin-requests'], owner);
  const lector = tokenFor(['reports', 'admin-requests']);
  const sinFuente = tokenFor(['reports', 'reports_write', 'viaticos']);
  const ajeno = tokenFor(['dashboard']);
  const coordinador = tokenFor([], 'coord@prueba.local', 'Coordinador');

  const call = (method, route, token, body) => fetch(base + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = async (res) => ({ status: res.status, body: await res.json() });
  const generar = (token, filtros, extra = {}) =>
    call('POST', '/reports/generar', token, { fuente: 'solicitudes', filtros: { documento: tag, ...filtros }, ...extra }).then(json);

  await t.test('exige sesión; cualquier usuario registrado entra, pero sin fuentes que no puede consultar', async () => {
    assert.strictEqual((await call('GET', '/reports/catalogo', null)).status, 401);
    assert.strictEqual((await call('GET', '/automation', null)).status, 401);
    const res = await json(await call('GET', '/reports/catalogo', ajeno));
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.fuentes.some(f => f.id === 'solicitudes'));
    assert.strictEqual(res.body.puedeAutomatizar, true);
  });

  await t.test('el catálogo solo muestra fuentes permitidas y sin SQL', async () => {
    const { body } = await json(await call('GET', '/reports/catalogo', lector));
    assert.deepStrictEqual(body.fuentes.map(f => f.id), ['solicitudes']);
    assert.ok(!JSON.stringify(body).includes('solicitudes_admin'));
    assert.strictEqual(body.puedeAutomatizar, true);
    const all = await json(await call('GET', '/reports/catalogo', coordinador));
    assert.strictEqual(all.body.fuentes.length, SOURCES.length);
  });

  await t.test('todas las fuentes del catálogo se ejecutan contra el esquema real', async () => {
    for (const source of SOURCES) {
      const columnas = source.columnas.map(c => c.key);
      const res = await json(await call('POST', '/reports/generar', coordinador, { fuente: source.id, columnas, limit: 5 }));
      assert.strictEqual(res.status, 200, `${source.id}: ${res.body.error}`);
      const options = await json(await call('GET', `/reports/opciones/${source.id}`, coordinador));
      assert.strictEqual(options.status, 200, `opciones ${source.id}`);
      for (const filtro of source.filtros) {
        let value = 'x';
        if (filtro.tipo === 'fechas') value = { periodo: 'anio_actual' };
        if (filtro.tipo === 'numero') value = { min: 1, max: 9 };
        const filtered = await json(await call('POST', '/reports/generar', coordinador, { fuente: source.id, filtros: { [filtro.key]: value }, limit: 1 }));
        assert.strictEqual(filtered.status, 200, `${source.id}.${filtro.key}: ${filtered.body.error}`);
      }
    }
  });

  await t.test('combina filtros y entiende fechas guardadas como texto', async () => {
    const todos = await generar(gestor, {});
    assert.strictEqual(todos.body.total, 3);

    const combinados = await generar(gestor, { tipo: 'Incapacidad', dependencia: 'DEP A', inicio: { desde: '2026-01-01', hasta: '2026-01-31' } });
    assert.strictEqual(combinados.body.total, 1);
    assert.strictEqual(combinados.body.filas[0].nombre, 'PERSONA UNO');
    assert.strictEqual(combinados.body.filas[0].inicio, '2026-01-15');
    assert.ok(combinados.body.criterios.some(c => c.label === 'Fecha de inicio' && c.valor.includes('2026-01-01')));
  });

  await t.test('solo devuelve las columnas elegidas y maneja los casos sin resultados', async () => {
    const sel = await generar(gestor, {}, { columnas: ['nombre', 'estado'] });
    assert.deepStrictEqual(Object.keys(sel.body.filas[0]).sort(), ['estado', 'nombre']);
    const vacio = await generar(gestor, { dias: { min: 500 } });
    assert.strictEqual(vacio.status, 200);
    assert.strictEqual(vacio.body.total, 0);
    assert.deepStrictEqual(vacio.body.filas, []);
  });

  await t.test('no permite consultar datos de módulos ajenos ni filtros inválidos', async () => {
    assert.strictEqual((await call('POST', '/reports/generar', sinFuente, { fuente: 'solicitudes' })).status, 404);
    assert.strictEqual((await call('POST', '/reports/generar', ajeno, { fuente: 'solicitudes' })).status, 404);
    assert.strictEqual((await call('POST', '/reports/generar', gestor, { fuente: 'no_existe' })).status, 404);
    assert.strictEqual((await call('POST', '/reports/generar', gestor, { fuente: 'solicitudes', filtros: { inventado: 'x' } })).status, 400);
    assert.strictEqual((await call('POST', '/reports/generar', gestor, { fuente: 'solicitudes', columnas: ['password'] })).status, 400);
  });

  const definicion = {
    nombre: `Informe ${tag}`,
    fuente: 'solicitudes',
    filtros: { documento: tag, estado: 'Aprobada' },
    columnas: ['nombre', 'tipo', 'estado'],
    frecuencia: 'mensual',
    inicio: '2030-01-15T08:30',
  };
  let id;

  await t.test('crear automatización: valida permisos y datos', async () => {
    // Cualquier usuario registrado puede programar, pero solo sobre fuentes que ya puede consultar.
    assert.strictEqual((await call('POST', '/automation', null, definicion)).status, 401);
    assert.strictEqual((await call('POST', '/automation', sinFuente, definicion)).status, 403);
    assert.strictEqual((await call('POST', '/automation', ajeno, definicion)).status, 403);
    const deLector = await json(await call('POST', '/automation', lector, definicion));
    assert.strictEqual(deLector.status, 201);
    createdAutomations.push(deLector.body.id);
    assert.strictEqual((await call('POST', '/automation', gestor, { ...definicion, nombre: '' })).status, 400);
    assert.strictEqual((await call('POST', '/automation', gestor, { ...definicion, inicio: 'mañana' })).status, 400);
    assert.strictEqual((await call('POST', '/automation', gestor, { ...definicion, frecuencia: 'personalizada', intervalo: 0, unidad: 'dias' })).status, 400);
    assert.strictEqual((await call('POST', '/automation', gestor, { ...definicion, filtros: { inventado: 'x' } })).status, 400);

    const res = await json(await call('POST', '/automation', gestor, definicion));
    assert.strictEqual(res.status, 201);
    id = res.body.id;
    createdAutomations.push(id);
    assert.strictEqual(new Date(res.body.proximaEjecucion).toISOString(), '2030-01-15T13:30:00.000Z');
    assert.strictEqual(res.body.estado, 'Activa');
  });

  await t.test('cada usuario ve solo sus automatizaciones', async () => {
    const own = await json(await call('GET', '/automation', gestor));
    assert.ok(own.body.data.some(a => a.id === id));
    const other = await json(await call('GET', '/automation', lector));
    assert.ok(!other.body.data.some(a => a.id === id));
    const coord = await json(await call('GET', '/automation', coordinador));
    assert.ok(coord.body.data.some(a => a.id === id));
    assert.strictEqual((await call('DELETE', `/automation/${id}`, sinFuente)).status, 404);
  });

  await t.test('editar, pausar y reanudar', async () => {
    const edited = await json(await call('PUT', `/automation/${id}`, gestor, { ...definicion, nombre: `Editado ${tag}`, frecuencia: 'diaria' }));
    assert.strictEqual(edited.status, 200);
    assert.strictEqual(edited.body.frecuencia, 'diaria');

    const paused = await json(await call('POST', `/automation/${id}/pausar`, gestor));
    assert.strictEqual(paused.body.estado, 'Pausada');
    assert.strictEqual(paused.body.proximaEjecucion, null);

    const resumed = await json(await call('POST', `/automation/${id}/reanudar`, gestor));
    assert.strictEqual(resumed.body.estado, 'Activa');
    assert.ok(resumed.body.proximaEjecucion);
  });

  await t.test('una tarea vencida se ejecuta sola y conserva resultado y criterios', async () => {
    await pool.query(`UPDATE automatizaciones SET proxima_ejecucion = NOW() - INTERVAL '1 minute' WHERE id_automatizacion = $1`, [id]);
    await automationRoutes.tick();

    const runs = await json(await call('GET', `/automation/ejecuciones?automatizacion=${id}`, gestor));
    assert.strictEqual(runs.body.total, 1);
    assert.strictEqual(runs.body.data[0].estado, 'Exitosa');
    assert.strictEqual(runs.body.data[0].origen, 'Programada');
    assert.strictEqual(runs.body.data[0].total, 2);

    const run = await json(await call('GET', `/automation/ejecuciones/${runs.body.data[0].id}`, gestor));
    assert.strictEqual(run.body.filas.length, 2);
    assert.deepStrictEqual(run.body.columnas.map(c => c.key), ['tipo', 'nombre', 'estado']); // Orden del catálogo
    assert.ok(run.body.criterios.some(c => c.valor === 'Aprobada'));

    // No se repite ni queda vencida.
    const { rows } = await pool.query('SELECT proxima_ejecucion > NOW() AS futura FROM automatizaciones WHERE id_automatizacion = $1', [id]);
    assert.strictEqual(rows[0].futura, true);
    await automationRoutes.tick();
    assert.strictEqual((await json(await call('GET', `/automation/ejecuciones?automatizacion=${id}`, gestor))).body.total, 1);

    // Otro usuario no puede leer el resultado guardado.
    assert.strictEqual((await call('GET', `/automation/ejecuciones/${runs.body.data[0].id}`, lector)).status, 404);
  });

  await t.test('una tarea pausada no se ejecuta', async () => {
    await call('POST', `/automation/${id}/pausar`, gestor);
    await pool.query(`UPDATE automatizaciones SET proxima_ejecucion = NOW() - INTERVAL '1 minute' WHERE id_automatizacion = $1`, [id]);
    await automationRoutes.tick();
    assert.strictEqual((await json(await call('GET', `/automation/ejecuciones?automatizacion=${id}`, gestor))).body.total, 1);
    await pool.query('UPDATE automatizaciones SET proxima_ejecucion = NULL WHERE id_automatizacion = $1', [id]);
    await call('POST', `/automation/${id}/reanudar`, gestor);
  });

  await t.test('si al dueño le retiran el acceso, la ejecución queda en error y sin datos', async () => {
    await pool.query(`UPDATE usuarios SET modulos = 'reports,reports_write' WHERE username = $1`, [owner]);
    const manual = await json(await call('POST', `/automation/${id}/ejecutar`, gestor));
    assert.strictEqual(manual.body.estado, 'Error');
    assert.match(manual.body.mensaje, /acceso/);
    const { rows } = await pool.query('SELECT filas FROM automatizacion_ejecuciones WHERE id_ejecucion = $1', [manual.body.idEjecucion]);
    assert.strictEqual(rows[0].filas, null);
    await pool.query(`UPDATE usuarios SET modulos = 'reports,reports_write,admin-requests' WHERE username = $1`, [owner]);
  });

  await t.test('el historial se protege según la fuente que generó las filas, aunque la automatización cambie de fuente', async () => {
    const conAcceso = tokenFor(['reports', 'reports_write', 'admin-requests', 'documents'], owner);
    const sinAcceso = tokenFor(['reports', 'reports_write', 'documents'], owner);

    const created = await json(await call('POST', '/automation', conAcceso, { ...definicion, nombre: `Cambio ${tag}` }));
    assert.strictEqual(created.status, 201);
    createdAutomations.push(created.body.id);
    const run = await json(await call('POST', `/automation/${created.body.id}/ejecutar`, conAcceso));
    assert.strictEqual(run.body.estado, 'Exitosa');
    assert.ok(run.body.total > 0);

    // La automatización pasa a una fuente que el usuario sí conserva.
    const edited = await call('PUT', `/automation/${created.body.id}`, conAcceso, { ...definicion, nombre: `Cambio ${tag}`, fuente: 'documentos', filtros: {}, columnas: [] });
    assert.strictEqual(edited.status, 200);

    // Sin acceso a la fuente original, las filas guardadas no se entregan.
    assert.strictEqual((await call('GET', `/automation/ejecuciones/${run.body.idEjecucion}`, sinAcceso)).status, 404);

    // Con acceso, se ven y conservan su fuente original.
    const detail = await json(await call('GET', `/automation/ejecuciones/${run.body.idEjecucion}`, conAcceso));
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.fuente, 'solicitudes');
    assert.ok(detail.body.filas.length > 0);
  });

  await t.test('eliminar borra la automatización y su historial', async () => {
    assert.strictEqual((await call('DELETE', `/automation/${id}`, gestor)).status, 200);
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM automatizacion_ejecuciones WHERE id_automatizacion = $1', [id]);
    assert.strictEqual(Number(rows[0].n), 0);
  });
});
