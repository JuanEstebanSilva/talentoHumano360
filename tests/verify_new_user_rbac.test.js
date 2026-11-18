/**
 * tests/verify_new_user_rbac.test.js
 * Prueba exhaustiva de autorización RBAC para el nuevo usuario técnico:
 * talento360.notificaciones@gmail.com
 * Acceso EXCLUSIVO a: Centro de Monitoreo de Errores y Copias de Seguridad.
 * Acceso RESTRINGIDO (403) a: Servidores Públicos, Horarios, Viáticos, Solicitudes, SST, etc.
 */

const assert = require('assert');

const BASE_URL = 'http://localhost';

async function run() {
  console.log('=== VERIFICACIÓN EXHAUSTIVA DE ACCESO RBAC: NUEVO USUARIO TÉCNICO ===\n');

  // 1. Iniciar sesión
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'talento360.notificaciones@gmail.com',
      password: 'Talento360@dmin'
    })
  });

  assert.strictEqual(loginRes.status, 200, 'Login debe ser exitoso (200)');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert.ok(token, 'Token JWT debe estar presente');
  console.log('✅ [1/10] Autenticación exitosa (HTTP 200).');
  console.log('         Usuario:', loginData.user.username);
  console.log('         Rol:', loginData.user.role);
  console.log('         Módulos asignados:', loginData.user.modules);

  assert.deepStrictEqual(
    loginData.user.modules.sort(),
    ['admin-backups', 'admin-errors'].sort(),
    'Módulos deben ser estrictamente [admin-errors, admin-backups]'
  );
  console.log('✅ [2/10] Módulos en sesión verificados: ÚNICAMENTE [admin-errors, admin-backups].\n');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Helper de prueba
  async function testEndpoint(name, url, expectedStatus, shouldAllow) {
    const res = await fetch(`${BASE_URL}${url}`, { headers });
    const isOk = (res.status === expectedStatus);
    const passSymbol = isOk ? '✅' : '❌';
    console.log(`${passSymbol} [${name}] ${url} -> HTTP ${res.status} (Esperado: ${expectedStatus}) | ${shouldAllow ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO 403'}`);
    assert.strictEqual(
      res.status,
      expectedStatus,
      `Fallo en ${name} (${url}): esperado ${expectedStatus}, obtenido ${res.status}`
    );
  }

  console.log('--- A. MÓDULOS PERMITIDOS (DEBE TENER ACCESO 200) ---');
  // 3. Monitoreo de Errores
  await testEndpoint('Centro de Errores', '/api/admin/errors', 200, true);
  // 4. Copias de Seguridad
  await testEndpoint('Copias de Seguridad (Listar)', '/api/admin/backups', 200, true);
  // 5. Copias de Seguridad (Configuración)
  await testEndpoint('Copias de Seguridad (Config)', '/api/admin/backups/config', 200, true);

  console.log('\n--- B. MÓDULOS RESTRINGIDOS (DEBE DENEGAR ACCESO 403) ---');
  // 6. Servidores Públicos
  await testEndpoint('Servidores Públicos', '/api/employees', 403, false);
  // 7. Horarios
  await testEndpoint('Horarios y Modalidades', '/api/horarios', 403, false);
  // 8. Viáticos
  await testEndpoint('Viáticos', '/api/viaticos', 403, false);
  // 9. Solicitudes Administrativas
  await testEndpoint('Solicitudes Admin (Listado)', '/api/admin-requests', 403, false);
  await testEndpoint('Solicitudes Admin (Estadísticas)', '/api/admin-requests/stats', 403, false);
  await testEndpoint('Solicitudes Admin (Catálogo)', '/api/admin-requests/catalogs/permisos', 403, false);
  // 10. Incapacidades
  await testEndpoint('Incapacidades (Listado)', '/api/incapacidades', 403, false);
  await testEndpoint('Incapacidades (Estadísticas)', '/api/incapacidades/stats', 403, false);
  // 11. Seguridad y Salud en el Trabajo (SST)
  await testEndpoint('SST Sociodemográfico', '/api/sst/sociodemografico', 403, false);
  await testEndpoint('SST Epidemiológico', '/api/sst/epidemiologico', 403, false);
  await testEndpoint('SST EPP Entregas', '/api/sst/epp', 403, false);
  await testEndpoint('SST EPP Inventario', '/api/sst/epp/inventario', 403, false);
  await testEndpoint('SST Estadísticas', '/api/sst/stats', 403, false);

  console.log('\n================================================================');
  console.log('RESUMEN: TODAS LAS PRUEBAS RBAC SATISFACTORIAS AL 100%');
  console.log('El usuario talento360.notificaciones@gmail.com SOLO TIENE ACCESO');
  console.log('A Centro de Errores y Copias de Seguridad, Y A NADA MÁS.');
  console.log('================================================================');
}

run().catch(err => {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN:', err.message);
  process.exit(1);
});
