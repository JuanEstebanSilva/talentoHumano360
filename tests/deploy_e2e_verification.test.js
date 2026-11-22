/**
 * tests/deploy_e2e_verification.test.js
 * Suite Exhaustiva de Pruebas End-to-End sobre el Despliegue en Vivo (Render + Neon)
 * Gobernación de Boyacá · Talento 360
 * Verifica autenticación, filtros avanzados, operaciones CRUD y seguridad en la nube
 */

const test = require('node:test');
const assert = require('node:assert');

const DEPLOY_URL = process.env.DEPLOY_URL || 'https://talento360-backend.onrender.com';

async function remoteRequest(method, path, options = {}) {
  const { token, body, headers = {} } = options;
  const reqHeaders = { ...headers };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  if (body && !reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';

  const fetchOpts = {
    method,
    headers: reqHeaders,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  };

  const res = await fetch(`${DEPLOY_URL}${path}`, fetchOpts);
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { status: res.status, headers: res.headers, data, text };
}

let adminToken = null;
let activeEmpCedula = null;
let activeEmpNombre = null;

// ─── SECCIÓN 1: SALUD E INFRAESTRUCTURA DEL DESPLIEGUE ─────────────────────────
test('DEPLOY-01: Verificación de salud y conexión a base de datos Neon', async () => {
  const res = await remoteRequest('GET', '/health');
  assert.strictEqual(res.status, 200, 'Health check debe responder 200');
  assert.strictEqual(res.data?.status, 'ok');
  assert.strictEqual(res.data?.database?.connected, true, 'Base de datos en Neon debe estar conectada');
  assert.ok(res.headers.get('strict-transport-security'), 'HSTS debe estar activo en el despliegue');
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN');
});

test('DEPLOY-02: Verificación de entrega del Frontend SPA en la nube', async () => {
  const res = await remoteRequest('GET', '/');
  assert.strictEqual(res.status, 200, 'Frontend SPA raíz debe responder 200');
  assert.ok(res.text.includes('Talento 360'), 'HTML debe contener el título institucional');
  assert.ok(res.text.includes('app.js'), 'HTML debe enlazar los scripts del cliente');
});

test('DEPLOY-03: Verificación de blindaje y bloqueo de archivos sensibles en nube', async () => {
  const sensitive = ['/.env', '/.git', '/database/01_schema.sql', '/package.json'];
  for (const p of sensitive) {
    const res = await remoteRequest('GET', p);
    assert.strictEqual(res.status, 404, `Acceso remoto a ${p} debe responder 404`);
  }
});

test('DEPLOY-04: Protección de endpoint administrativo /api/db-status en nube', async () => {
  // Petición anónima debe ser 401
  const anonRes = await remoteRequest('GET', '/api/db-status');
  assert.strictEqual(anonRes.status, 401, 'db-status anónimo debe responder 401');

  // Login de Administrador
  const loginRes = await remoteRequest('POST', '/api/auth/login', {
    body: { username: 'alejoleo2022@gmail.com', password: '@Alejo123' }
  });
  assert.strictEqual(loginRes.status, 200, 'Login administrador debe ser 200');
  adminToken = loginRes.data.token;
  assert.ok(adminToken, 'Token admin generado');

  // db-status con token admin debe ser 200
  const authDbRes = await remoteRequest('GET', '/api/db-status', { token: adminToken });
  assert.strictEqual(authDbRes.status, 200, 'db-status con token admin debe ser 200');
  assert.strictEqual(authDbRes.data?.status, 'connected');
  assert.strictEqual(authDbRes.data?.users, undefined, 'No debe filtrar usuarios');
});

// ─── SECCIÓN 2: MÓDULO DE SERVIDORES PÚBLICOS (FILTROS Y CRUD) ────────────────
test('DEPLOY-05: Servidores Públicos — Pruebas de filtros avanzados en nube', async () => {
  assert.ok(adminToken);

  // 1. Listado general
  const allRes = await remoteRequest('GET', '/api/employees?limit=10', { token: adminToken });
  assert.strictEqual(allRes.status, 200);
  let items = allRes.data?.data || allRes.data || [];

  if (items.length === 0) {
    // Si la BD remota está en estado cero, registrar servidor base institucional
    const seedRes = await remoteRequest('POST', '/api/employees', {
      token: adminToken,
      body: {
        cedula: '1099887766',
        nombres: 'SERVIDOR',
        apellidos: 'BASE CLOUD',
        nombreCompleto: 'SERVIDOR BASE CLOUD',
        tipo_vinculacion: 'Carrera Administrativa',
        cargoActual: 'PROFESIONAL ESPECIALIZADO',
        codigo_cargo: '222',
        grado: '05',
        dependencia: 'SECRETARÍA GENERAL',
        correo: 'servidor.base@boyaca.gov.co'
      }
    });
    activeEmpCedula = '1099887766';
    activeEmpNombre = 'SERVIDOR BASE CLOUD';
    const refetch = await remoteRequest('GET', '/api/employees?limit=10', { token: adminToken });
    items = refetch.data?.data || refetch.data || [];
  } else {
    const activeEmp = items.find(e => (e.estado_servidor || '').toLowerCase() === 'activo' || !e.estado_servidor);
    if (activeEmp) {
      activeEmpCedula = activeEmp.cedula;
      activeEmpNombre = activeEmp.nombre_completo || (activeEmp.nombres + ' ' + activeEmp.apellidos);
    }
  }

  assert.ok(items.length > 0, 'Debe retornar servidores públicos');

  // 2. Filtro por búsqueda de texto (nombre o cédula)
  const queryName = items[0].nombre_completo ? items[0].nombre_completo.split(' ')[0] : 'SERVIDOR';
  const searchRes = await remoteRequest('GET', `/api/employees?search=${encodeURIComponent(queryName)}&limit=5`, { token: adminToken });
  assert.strictEqual(searchRes.status, 200);

  // 3. Filtro por dependencia
  const depRes = await remoteRequest('GET', '/api/employees?dependencia=SECRETARÍA&limit=5', { token: adminToken });
  assert.strictEqual(depRes.status, 200);

  // 4. Filtro por estado
  const statusRes = await remoteRequest('GET', '/api/employees?estado=Activo&limit=5', { token: adminToken });
  assert.strictEqual(statusRes.status, 200);
});

test('DEPLOY-06: Servidores Públicos — Ciclo completo CRUD en nube', async () => {
  assert.ok(adminToken);
  const testCedula = '999888' + Math.floor(1000 + Math.random() * 9000);

  // 1. CREAR
  const createRes = await remoteRequest('POST', '/api/employees', {
    token: adminToken,
    body: {
      cedula: testCedula,
      nombres: 'FUNCIONARIO PRUEBA',
      apellidos: 'DESPLIEGUE CLOUD',
      nombre_completo: 'FUNCIONARIO PRUEBA DESPLIEGUE CLOUD',
      tipo_documento: 'Cédula de Ciudadanía',
      tipo_vinculacion: 'Carrera Administrativa',
      denominacion_cargo: 'PROFESIONAL ESPECIALIZADO',
      codigo_cargo: '222',
      grado_cargo: '05',
      dependencia: 'DIRECCIÓN DE TALENTO HUMANO',
      municipio: 'TUNJA',
      correo: `test.cloud.${testCedula}@boyaca.gov.co`
    }
  });
  assert.strictEqual(createRes.status, 201, 'Creación de servidor debe responder 201');

  // 2. CONSULTAR
  const getRes = await remoteRequest('GET', `/api/employees/${testCedula}`, { token: adminToken });
  assert.strictEqual(getRes.status, 200, 'Consulta de servidor creado debe responder 200');

  // 3. ACTUALIZAR
  const updateRes = await remoteRequest('PUT', `/api/employees/${testCedula}`, {
    token: adminToken,
    body: {
      nombre_completo: 'FUNCIONARIO PRUEBA MODIFICADO',
      dependencia: 'SECRETARÍA GENERAL'
    }
  });
  assert.strictEqual(updateRes.status, 200, 'Actualización de servidor debe responder 200');

  // 4. CAMBIAR ESTADO
  const patchRes = await remoteRequest('PATCH', `/api/employees/${testCedula}/status`, {
    token: adminToken,
    body: { estado: 'Inactivo' }
  });
  assert.strictEqual(patchRes.status, 200, 'Cambio de estado debe responder 200');

  // 5. ELIMINAR
  const delRes = await remoteRequest('DELETE', `/api/employees/${testCedula}`, { token: adminToken });
  assert.strictEqual(delRes.status, 200, 'Eliminación de servidor debe responder 200');
});

// ─── SECCIÓN 3: MÓDULO DE HORARIOS Y MODALIDADES (FILTROS Y CRUD) ──────────────
test('DEPLOY-07: Horarios — Pruebas de filtros avanzados en nube', async () => {
  assert.ok(adminToken);

  // 1. Listado general
  const allRes = await remoteRequest('GET', '/api/horarios?limit=10', { token: adminToken });
  assert.strictEqual(allRes.status, 200);

  // 2. Filtro por modalidad
  const modRes = await remoteRequest('GET', '/api/horarios?modalidad=Teletrabajo&limit=5', { token: adminToken });
  assert.strictEqual(modRes.status, 200);

  // 3. Filtro por rango de fechas
  const dateRes = await remoteRequest('GET', '/api/horarios?fecha_inicio_desde=2023-01-01&fecha_inicio_hasta=2026-12-31&limit=5', { token: adminToken });
  assert.strictEqual(dateRes.status, 200);

  // 4. Filtro por dependencia
  const depRes = await remoteRequest('GET', '/api/horarios?dependencia=GENERAL&limit=5', { token: adminToken });
  assert.strictEqual(depRes.status, 200);

  // 5. Filtro por resolución / acto
  const actRes = await remoteRequest('GET', '/api/horarios?numero_resolucion=RES&limit=5', { token: adminToken });
  assert.strictEqual(actRes.status, 200);
});

test('DEPLOY-08: Horarios — Ciclo completo CRUD en nube', async () => {
  assert.ok(adminToken);
  assert.ok(activeEmpCedula, 'Se requiere cédula de funcionario base');

  // 1. CREAR Horario Flexible
  const createRes = await remoteRequest('POST', '/api/horarios', {
    token: adminToken,
    body: {
      documento: activeEmpCedula,
      apellidos_nombres: activeEmpNombre || 'SERVIDOR BASE CLOUD',
      modalidad: 'Horario flexible',
      fecha_inicio: '2027-01-01',
      fecha_fin: '2027-06-30',
      franja_ingreso: '07:00',
      franja_salida: '16:00',
      observaciones: 'Horario de prueba automatizada en nube'
    }
  });

  if (createRes.status === 201) {
    const idHorario = createRes.data?.data?.id_horario || createRes.data?.id_horario || createRes.data?.id;
    assert.ok(idHorario, 'ID de horario retornado');

    // 2. CONSULTAR
    const getRes = await remoteRequest('GET', `/api/horarios/${idHorario}`, { token: adminToken });
    assert.strictEqual(getRes.status, 200);

    // 3. ACTUALIZAR
    const updRes = await remoteRequest('PUT', `/api/horarios/${idHorario}`, {
      token: adminToken,
      body: { franja_ingreso: '07:30', franja_salida: '16:30' }
    });
    assert.strictEqual(updRes.status, 200);

    // 4. CAMBIAR ESTADO
    const patchRes = await remoteRequest('PATCH', `/api/horarios/${idHorario}/status`, {
      token: adminToken,
      body: { estado: 'Inactiva' }
    });
    assert.strictEqual(patchRes.status, 200);

    // 5. ELIMINAR
    const delRes = await remoteRequest('DELETE', `/api/horarios/${idHorario}`, { token: adminToken });
    assert.strictEqual(delRes.status, 200);
  } else {
    // Si ya existe solape para este servidor en esa fecha, verificar que la validación responde correctamente
    assert.ok(createRes.status === 400);
  }
});

// ─── SECCIÓN 4: MÓDULO DE VIÁTICOS Y COMISIONES (FILTROS Y CRUD) ───────────────
test('DEPLOY-09: Viáticos — Pruebas de filtros avanzados y DIVIPOLA en nube', async () => {
  assert.ok(adminToken);

  // 1. Catálogo unificado DIVIPOLA / Destinos
  const destRes = await remoteRequest('GET', '/api/destinos?departamento=BOYACA&limit=10', { token: adminToken });
  assert.strictEqual(destRes.status, 200);
  const destinos = destRes.data?.data || destRes.data?.destinos || destRes.data || [];
  assert.ok(Array.isArray(destinos), 'Destinos debe ser un arreglo');

  // 2. Listado de viáticos
  const viatRes = await remoteRequest('GET', '/api/viaticos?limit=10', { token: adminToken });
  assert.strictEqual(viatRes.status, 200);

  // 3. Filtro por destino nacional / municipio
  const munRes = await remoteRequest('GET', '/api/viaticos?municipio_destino=TUNJA&limit=5', { token: adminToken });
  assert.strictEqual(munRes.status, 200);

  // 4. Filtro por rango de fechas
  const dateRes = await remoteRequest('GET', '/api/viaticos?fecha_salida_desde=2023-01-01&fecha_salida_hasta=2026-12-31&limit=5', { token: adminToken });
  assert.strictEqual(dateRes.status, 200);

  // 5. Filtro por rango de valor
  const valRes = await remoteRequest('GET', '/api/viaticos?valor_total_min=100000&valor_total_max=2000000&limit=5', { token: adminToken });
  assert.strictEqual(valRes.status, 200);
});

test('DEPLOY-10: Viáticos — Ciclo completo CRUD en nube', async () => {
  assert.ok(adminToken);

  // 1. CREAR Viático
  const createRes = await remoteRequest('POST', '/api/viaticos', {
    token: adminToken,
    body: {
      documento: activeEmpCedula || '1099887766',
      persona: activeEmpNombre || 'SERVIDOR VIATICOS CLOUD',
      apellidos_nombres: activeEmpNombre || 'SERVIDOR VIATICOS CLOUD',
      cargo: 'PROFESIONAL UNIVERSITARIO',
      dependencia: 'SECRETARÍA DE HACIENDA',
      tipo_destino: 'Nacional',
      departamento_destino: 'BOYACA',
      destino: 'TUNJA',
      municipio_destino: 'TUNJA',
      fecha_salida: '2027-03-10',
      fecha_regreso: '2027-03-12',
      fechaInicio: '2027-03-10',
      fechaFin: '2027-03-12',
      dias: 2,
      valor_dia: 150000,
      valorDiario: 150000,
      valor_total: 300000,
      estado: 'Radicado',
      motivo: 'Comisión institucional de prueba en despliegue'
    }
  });
  assert.strictEqual(createRes.status, 201, 'Creación de viático debe responder 201');
  const idViatico = createRes.data?.data?.id_viatico || createRes.data?.id_viatico || createRes.data?.id;
  assert.ok(idViatico, 'ID de viático retornado');

  // 2. CONSULTAR
  const getRes = await remoteRequest('GET', `/api/viaticos/${idViatico}`, { token: adminToken });
  assert.strictEqual(getRes.status, 200);

  // 3. ACTUALIZAR
  const updRes = await remoteRequest('PUT', `/api/viaticos/${idViatico}`, {
    token: adminToken,
    body: { municipio_destino: 'DUITAMA', valor_total: 320000 }
  });
  assert.strictEqual(updRes.status, 200);

  // 4. CAMBIAR ESTADO
  const patchRes = await remoteRequest('PATCH', `/api/viaticos/${idViatico}/status`, {
    token: adminToken,
    body: { estado: 'Aprobado', observaciones: 'Comisión oficial aprobada' }
  });
  assert.strictEqual(patchRes.status, 200);

  // 5. ELIMINAR
  const delRes = await remoteRequest('DELETE', `/api/viaticos/${idViatico}`, { token: adminToken });
  assert.strictEqual(delRes.status, 200);
});

// ─── SECCIÓN 5: RESTO DE MÓDULOS DE LA PLATAFORMA EN NUBE ─────────────────────
test('DEPLOY-11: Verificación de módulos auxiliares (Documentos, Informes, SST, Admin)', async () => {
  assert.ok(adminToken);

  // Módulo Documentos
  const docsRes = await remoteRequest('GET', '/api/documents/types', { token: adminToken });
  assert.strictEqual(docsRes.status, 200, 'Tipos documentales debe responder 200');

  // Módulo SST
  const sstRes = await remoteRequest('GET', '/api/sst/stats', { token: adminToken });
  assert.strictEqual(sstRes.status, 200, 'Estadísticas SST debe responder 200');

  // Módulo Solicitudes / Permisos
  const reqRes = await remoteRequest('GET', '/api/admin-requests/catalogs/permisos', { token: adminToken });
  assert.strictEqual(reqRes.status, 200, 'Catálogo de permisos debe responder 200');

  // Módulo Incapacidades
  const incRes = await remoteRequest('GET', '/api/incapacidades/stats', { token: adminToken });
  assert.strictEqual(incRes.status, 200, 'Estadísticas incapacidades debe responder 200');

  // Centro de Errores y Monitoreo
  const errRes = await remoteRequest('GET', '/api/admin/errors', { token: adminToken });
  assert.strictEqual(errRes.status, 200, 'Centro de errores debe responder 200');

  // Copias de Seguridad
  const bkpRes = await remoteRequest('GET', '/api/admin/backups', { token: adminToken });
  assert.strictEqual(bkpRes.status, 200, 'Listado de backups debe responder 200');
});
