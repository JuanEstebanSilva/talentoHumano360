/**
 * scratch/test_admin_15_operations_matrix.js
 * Matriz RBAC Integral del Administrador — 15 Operaciones en 3 Módulos
 * Cobertura completa de: Crear, Consultar, Actualizar, Cambiar Estado, Eliminar
 * Servidores Públicos (5) + Horarios (5) + Viáticos (5) = 15 Operaciones
 */

const { Pool } = require('pg');
const assert = require('assert');

const BASE_URL = 'http://localhost';
const pool = new Pool({
  connectionString: 'postgresql://postgres:admin123@localhost:5434/talento360'
});

async function request(token, method, path, body = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data = null;
  const raw = await res.text();
  try {
    data = JSON.parse(raw);
  } catch (e) {
    data = raw;
  }
  return { status: res.status, data };
}

async function runAdmin15Operations() {
  console.log('=== VERIFICACIÓN RBAC DEL ADMINISTRADOR: 15 OPERACIONES EN 3 MÓDULOS ===\n');

  // 1. Autenticación como Administrador Institucional
  const loginRes = await request(null, 'POST', '/api/auth/login', {
    username: 'alejoleo2022@gmail.com',
    password: '@Alejo123'
  });
  assert.strictEqual(loginRes.status, 200, 'Login del Administrador debe responder 200');
  const token = loginRes.data.token;
  assert.ok(token, 'Token JWT de Administrador generado correctamente');
  console.log('✅ Autenticación de Administrador (alejoleo2022@gmail.com) exitosa.\n');

  // Obtener servidor base para FKs sin acuerdos previos de horario
  const empRes = await pool.query(`
    SELECT p.cedula, p.nombre_completo 
    FROM personas p 
    WHERE p.es_vacante = false 
      AND p.cedula NOT IN (SELECT documento FROM horarios WHERE documento IS NOT NULL)
    LIMIT 1
  `);
  const baseCedula = empRes.rows[0].cedula;
  const baseNombre = empRes.rows[0].nombre_completo;

  const results = [];
  function record(num, modulo, operacion, method, endpoint, httpStatus, pgCheck) {
    results.push({ num, modulo, operacion, method, endpoint, httpStatus, pgCheck });
    console.log(`[OP-${String(num).padStart(2, '0')}] ${modulo.padEnd(20)} | ${operacion.padEnd(16)} | ${method.padEnd(6)} ${endpoint.padEnd(32)} | HTTP: ${httpStatus} | BD: ${pgCheck} | ✅ PASS`);
  }

  // ==========================================
  // MÓDULO 1: SERVIDORES PÚBLICOS (5 Operaciones)
  // ==========================================
  console.log('--- MÓDULO 1: SERVIDORES PÚBLICOS ---');
  const testCedula = '99099001';
  // Limpieza preventiva
  await pool.query('DELETE FROM rel_principal WHERE id_persona IN (SELECT id_persona FROM personas WHERE cedula = $1)', [testCedula]);
  await pool.query('DELETE FROM personas WHERE cedula = $1', [testCedula]);

  const pEmployee = {
    cedula: testCedula,
    nombreCompleto: 'SERVIDOR SINTETICO AUDITORIA ADMIN',
    dependencia: 'DESPACHO DEL GOBERNADOR',
    cargoActual: 'ASESOR',
    codigoCargo: '105',
    gradoCargo: '02',
    asignacion: '$6.000.000',
    estado: 'Activo',
    situacion: 'LIBRE NOMBRAMIENTO Y REMOCIÓN',
    clasificacion: 'Directivo'
  };

  // OP-01: Crear Servidor
  let r = await request(token, 'POST', '/api/employees', pEmployee);
  assert.strictEqual(r.status, 201);
  let pg = await pool.query('SELECT COUNT(*) FROM personas WHERE cedula = $1', [testCedula]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 1);
  record(1, 'Servidores Públicos', 'Crear', 'POST', '/api/employees', r.status, 'Insertado en personas/rel_principal');

  // OP-02: Consultar Servidor
  r = await request(token, 'GET', `/api/employees/${testCedula}`);
  assert.strictEqual(r.status, 200);
  const fetchedCedula = r.data.cedula || r.data.persona?.cedula;
  assert.strictEqual(fetchedCedula, testCedula);
  record(2, 'Servidores Públicos', 'Consultar', 'GET', `/api/employees/:cedula`, r.status, 'Consultado con éxito');

  // OP-03: Actualizar Servidor
  r = await request(token, 'PUT', `/api/employees/${testCedula}`, { ...pEmployee, dependencia: 'SECRETARÍA GENERAL' });
  assert.strictEqual(r.status, 200);
  pg = await pool.query(`
    SELECT d.dependencia 
    FROM dependencias d 
    JOIN rel_principal r ON d.id_dependencia = r.id_dependencia 
    JOIN personas p ON r.id_persona = p.id_persona 
    WHERE p.cedula = $1`, [testCedula]);
  assert.strictEqual(pg.rows[0].dependencia, 'SECRETARÍA GENERAL');
  record(3, 'Servidores Públicos', 'Actualizar', 'PUT', `/api/employees/:cedula`, r.status, 'Dependencia actualizada a SECRETARÍA GENERAL');

  // OP-04: Cambiar Estado Servidor
  r = await request(token, 'PATCH', `/api/employees/${testCedula}/status`, {
    estadoServidor: 'Inactivo',
    motivoRetiro: 'Renuncia regularmente aceptada'
  });
  assert.strictEqual(r.status, 200);
  pg = await pool.query(`
    SELECT e.estado_servidor 
    FROM estados e 
    JOIN rel_principal r ON e.id_estado = r.id_estado 
    JOIN personas p ON r.id_persona = p.id_persona 
    WHERE p.cedula = $1`, [testCedula]);
  assert.strictEqual(pg.rows[0].estado_servidor.toLowerCase(), 'inactivo');
  record(4, 'Servidores Públicos', 'Cambiar Estado', 'PATCH', `/api/employees/:cedula/status`, r.status, 'Estado cambiado a Inactivo');

  // OP-05: Eliminar Servidor
  r = await request(token, 'DELETE', `/api/employees/${testCedula}`);
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT COUNT(*) FROM personas WHERE cedula = $1', [testCedula]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 0);
  record(5, 'Servidores Públicos', 'Eliminar', 'DELETE', `/api/employees/:cedula`, r.status, 'Registro eliminado de BD');

  // ==========================================
  // MÓDULO 2: HORARIOS (5 Operaciones)
  // ==========================================
  console.log('\n--- MÓDULO 2: HORARIOS ---');
  // OP-06: Crear Horario
  r = await request(token, 'POST', '/api/horarios', {
    documento: baseCedula,
    apellidos_nombres: baseNombre,
    modalidad: 'Horario flexible',
    fecha_inicio: '2026-06-01',
    fecha_fin: '2026-11-30',
    franja_ingreso: '07:30',
    franja_salida: '16:30',
    observaciones: 'Horario especial administrador'
  });
  assert.strictEqual(r.status, 201);
  const idHorario = r.data?.data?.id_horario || r.data?.id_horario || r.data?.id;
  assert.ok(idHorario, 'ID de horario retornado');
  pg = await pool.query('SELECT COUNT(*) FROM horarios WHERE id_horario = $1', [idHorario]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 1);
  record(6, 'Horarios', 'Crear', 'POST', '/api/horarios', r.status, 'Insertado en horarios');

  // OP-07: Consultar Horario
  r = await request(token, 'GET', `/api/horarios/${idHorario}`);
  assert.strictEqual(r.status, 200);
  const fetchedId = r.data.horario?.id_horario || r.data.id_horario || r.data.id;
  assert.strictEqual(fetchedId, idHorario);
  record(7, 'Horarios', 'Consultar', 'GET', `/api/horarios/:id`, r.status, 'Consultado detalle de acuerdo');

  // OP-08: Actualizar Horario
  r = await request(token, 'PUT', `/api/horarios/${idHorario}`, {
    documento: baseCedula,
    apellidos_nombres: baseNombre,
    modalidad: 'Horario flexible',
    fecha_inicio: '2026-06-01',
    fecha_fin: '2026-11-30',
    franja_ingreso: '08:00',
    franja_salida: '17:00',
    observaciones: 'Horario especial actualizado por admin'
  });
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT franja_ingreso FROM horarios WHERE id_horario = $1', [idHorario]);
  assert.strictEqual(pg.rows[0].franja_ingreso, '08:00');
  record(8, 'Horarios', 'Actualizar', 'PUT', `/api/horarios/:id`, r.status, 'Franja ingreso actualizada a 08:00');

  // OP-09: Cambiar Estado Horario
  r = await request(token, 'PATCH', `/api/horarios/${idHorario}/status`, {
    estado: 'Inactivo',
    motivo_inactivacion: 'Finalización de acuerdo por reasignación'
  });
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT estado FROM horarios WHERE id_horario = $1', [idHorario]);
  assert.strictEqual(pg.rows[0].estado, 'Inactivo');
  record(9, 'Horarios', 'Cambiar Estado', 'PATCH', `/api/horarios/:id/status`, r.status, 'Estado cambiado a Inactivo');

  // OP-10: Eliminar Horario
  r = await request(token, 'DELETE', `/api/horarios/${idHorario}`);
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT COUNT(*) FROM horarios WHERE id_horario = $1', [idHorario]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 0);
  record(10, 'Horarios', 'Eliminar', 'DELETE', `/api/horarios/:id`, r.status, 'Registro eliminado de BD');

  // ==========================================
  // MÓDULO 3: VIÁTICOS (5 Operaciones)
  // ==========================================
  console.log('\n--- MÓDULO 3: VIÁTICOS ---');
  // OP-11: Crear Viático
  r = await request(token, 'POST', '/api/viaticos', {
    persona: baseNombre,
    documento: baseCedula,
    dependencia: 'SECRETARÍA GENERAL',
    destino: 'SOGAMOSO',
    motivo: 'Comisión institucional verificación técnica',
    fechaInicio: '2026-06-15',
    fechaFin: '2026-06-16',
    dias: 2,
    valorTotal: 320000,
    numeroResolucion: 'RES-AUDIT-ADMIN-01'
  });
  assert.strictEqual(r.status, 201);
  const idViatico = r.data.id;
  assert.ok(idViatico, 'ID de viático retornado');
  pg = await pool.query('SELECT COUNT(*) FROM viaticos WHERE id_viatico = $1', [idViatico]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 1);
  record(11, 'Viáticos', 'Crear', 'POST', '/api/viaticos', r.status, 'Insertado en viaticos');

  // OP-12: Consultar Viático
  r = await request(token, 'GET', `/api/viaticos/${idViatico}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.id_viatico, idViatico);
  record(12, 'Viáticos', 'Consultar', 'GET', `/api/viaticos/:id`, r.status, 'Consultado detalle de viático');

  // OP-13: Actualizar Viático
  r = await request(token, 'PUT', `/api/viaticos/${idViatico}`, {
    persona: baseNombre,
    documento: baseCedula,
    dependencia: 'SECRETARÍA GENERAL',
    destino: 'SOGAMOSO Y NOBSA',
    motivo: 'Comisión institucional ampliada',
    fechaInicio: '2026-06-15',
    fechaFin: '2026-06-17',
    valorTotal: 480000,
    numeroResolucion: 'RES-AUDIT-ADMIN-01'
  });
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT destino, dias FROM viaticos WHERE id_viatico = $1', [idViatico]);
  assert.strictEqual(pg.rows[0].destino, 'SOGAMOSO Y NOBSA');
  assert.strictEqual(pg.rows[0].dias, 3);
  record(13, 'Viáticos', 'Actualizar', 'PUT', `/api/viaticos/:id`, r.status, 'Destino y duración (3 días) actualizados');

  // OP-14: Cambiar Estado Viático
  r = await request(token, 'PATCH', `/api/viaticos/${idViatico}/status`, {
    estado: 'Aprobado'
  });
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT estado FROM viaticos WHERE id_viatico = $1', [idViatico]);
  assert.strictEqual(pg.rows[0].estado, 'Aprobado');
  record(14, 'Viáticos', 'Cambiar Estado', 'PATCH', `/api/viaticos/:id/status`, r.status, 'Estado cambiado a Aprobado');

  // OP-15: Eliminar Viático
  r = await request(token, 'DELETE', `/api/viaticos/${idViatico}`);
  assert.strictEqual(r.status, 200);
  pg = await pool.query('SELECT COUNT(*) FROM viaticos WHERE id_viatico = $1', [idViatico]);
  assert.strictEqual(parseInt(pg.rows[0].count, 10), 0);
  record(15, 'Viáticos', 'Eliminar', 'DELETE', `/api/viaticos/:id`, r.status, 'Registro eliminado de BD');

  await pool.end();

  console.log('\n================================================================');
  console.log(`RESUMEN: ${results.length} DE 15 OPERACIONES EJECUTADAS Y VERIFICADAS EN BD`);
  console.log('RESULTADO FINAL MATRIZ ADMINISTRADOR: ✅ 100% SATISFACTORIA');
  console.log('================================================================');
}

runAdmin15Operations().catch(err => {
  console.error('FATAL EN MATRIZ DE ADMINISTRADOR:', err);
  process.exit(1);
});
