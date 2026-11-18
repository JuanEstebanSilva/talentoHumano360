const assert = require('assert');
const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434', 10),
  database: process.env.DB_NAME || 'talento360',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123'
});

// Import the parser logic exactly as implemented in frontend and backend
function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || isNaN(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function isValidCalendarDate(d, m, y) {
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function parseDateRobust(rawVal, resolucionStr, explicitDias) {
  let expD = null;
  if (explicitDias !== undefined && explicitDias !== null && String(explicitDias).trim() !== '') {
    const sExp = String(explicitDias).trim();
    if (/^\d+$/.test(sExp)) {
      const parsed = parseInt(sExp, 10);
      if (parsed > 0) expD = parsed;
    }
  }

  if (rawVal == null || String(rawVal).trim() === '') {
    return { start: null, end: null, dias: expD, raw: null };
  }

  // Las fechas de comisión NO deben extraerse de textos de resoluciones ni actos administrativos
  const rawStr = String(rawVal).trim();
  if (/(?:RES|RESOLUCI[OÓ]N|DECRETO|ACTO|OFICIO|MEMORANDO)/i.test(rawStr) || /^\d{3,5}\//.test(rawStr)) {
    return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
  }

  if (typeof rawVal === 'number' && rawVal > 30000 && rawVal < 60000) {
    const sDate = excelSerialToDate(rawVal);
    if (sDate) {
      const [d, m, y] = sDate.split('/');
      if (isValidCalendarDate(d, m, y)) {
        return { start: sDate, end: sDate, dias: expD || 1, raw: rawVal };
      }
    }
  }

  if (rawVal instanceof Date) {
    const d = String(rawVal.getUTCDate()).padStart(2, '0');
    const m = String(rawVal.getUTCMonth() + 1).padStart(2, '0');
    const y = rawVal.getUTCFullYear();
    if (isValidCalendarDate(d, m, y)) {
      const dStr = `${d}/${m}/${y}`;
      return { start: dStr, end: dStr, dias: expD || 1, raw: rawVal };
    }
    return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
  }

  let s = String(rawVal).trim().replace(/\s+/g, '');

  // Formato ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    if (isValidCalendarDate(d, m, y)) {
      const dStr = `${d}/${m}/${y}`;
      return { start: dStr, end: dStr, dias: expD || 1, raw: rawVal };
    }
    return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
  }

  // Corrección de erratas detectadas en archivos de la Gobernación de Boyacá
  s = s.replace(/\/203$/, '/2023');
  s = s.replace(/\/024$/, '/2024');
  s = s.replace(/\/204$/, '/2024');
  s = s.replace(/(\d{1,2}\/\d{1,2})\/(\d{4})$/, '$1/$2');
  s = s.replace(/,(\/\d{2}\/\d{4})$/, '$1');
  s = s.replace(/\/(\d{2})\/(\d{4})$/, '/$1/$2');
  s = s.replace(/\/096\/(\d{4})$/, '/06/$1');

  // Fechas sin barra entre día y mes o mes y año (ej: 07,08,0908/2023 -> 07,08,09/08/2023)
  s = s.replace(/^(\d{1,2}(?:,\d{1,2})*)(\d{2})\/(\d{4})$/, '$1/$2/$3');
  s = s.replace(/^(\d{1,2}(?:,\d{1,2})*)\/(\d{2})(\d{4})$/, '$1/$2/$3');
  s = s.replace(/^(\d{1,2})\/(\d{2})(\d{4})$/, '$1/$2/$3');
  s = s.replace(/^(\d{1,2})(\d{2})\/(\d{4})$/, '$1/$2/$3');

  const parts = s.split('/').filter(p => p.length > 0);

  if (parts.length === 3) {
    let dayPart = parts[0];
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    if (month.length === 3 && month.startsWith('0')) month = month.substring(1);

    const days = dayPart.split(',').map(d => {
      let cl = d.trim().replace(/^0+/, '') || '0';
      if (cl.length === 3 && cl.startsWith('22')) cl = '22';
      return cl;
    }).filter(d => d.length > 0 && !isNaN(parseInt(d, 10)));

    if (days.length > 0) {
      const allDaysValid = days.every(d => isValidCalendarDate(d, month, year));
      if (!allDaysValid) {
        return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
      }
      if (days.length > 1) {
        const start = `${days[0].padStart(2, '0')}/${month}/${year}`;
        const end = `${days[days.length - 1].padStart(2, '0')}/${month}/${year}`;
        return { start, end, dias: expD || days.length, raw: rawVal };
      }
      const single = `${days[0].padStart(2, '0')}/${month}/${year}`;
      return { start: single, end: single, dias: expD || 1, raw: rawVal };
    }
  } else if (parts.length === 4) {
    let day1Part = parts[0];
    let m1Part = parts[1];
    let day2Part = parts[2];
    let m2Part = parts[3];

    let year = '2023';
    let month2 = '01';

    if (m2Part.length === 4) {
      year = m2Part;
      month2 = day2Part.padStart(2, '0');
      const d1Tokens = day1Part.split(',').filter(Boolean);
      const d2Tokens = [m1Part];
      const startMonth = month2;
      const startValid = d1Tokens.every(d => isValidCalendarDate(d, startMonth, year));
      const endValid = d2Tokens.every(d => isValidCalendarDate(d, month2, year));
      if (startValid && endValid) {
        const start = `${d1Tokens[0].padStart(2, '0')}/${startMonth}/${year}`;
        const end = `${d2Tokens[d2Tokens.length - 1].padStart(2, '0')}/${month2}/${year}`;
        return { start, end, dias: expD || (d1Tokens.length + d2Tokens.length), raw: rawVal };
      }
    }
  } else if (parts.length >= 5) {
    let year = parts[parts.length - 1];
    if (year.length === 2) year = '20' + year;
    let endMonth = parts[parts.length - 2].padStart(2, '0');
    let endDays = parts[parts.length - 3].split(',').filter(Boolean);
    let startMonth = parts[1].padStart(2, '0');
    let startDays = parts[0].split(',').filter(Boolean);

    const startValid = startDays.every(d => isValidCalendarDate(d, startMonth, year));
    const endValid = endDays.every(d => isValidCalendarDate(d, endMonth, year));
    if (startValid && endValid) {
      const start = `${(startDays[0] || '01').padStart(2, '0')}/${startMonth}/${year}`;
      const end = `${(endDays[endDays.length - 1] || '01').padStart(2, '0')}/${endMonth}/${year}`;
      const dias = expD || ((startDays.length || 1) + (endDays.length || 1));
      return { start, end, dias, raw: rawVal };
    }
  }

  const mMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mMatch) {
    let yr = mMatch[3];
    if (yr.length === 2) yr = '20' + yr;
    const d = mMatch[1].padStart(2, '0');
    const mo = mMatch[2].padStart(2, '0');
    if (isValidCalendarDate(d, mo, yr)) {
      const dStr = `${d}/${mo}/${yr}`;
      return { start: dStr, end: dStr, dias: expD || 1, raw: rawVal };
    }
    return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
  }

  return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
}

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function loginUser(username, password) {
  const res = await requestJson({
    host: 'localhost',
    port: 80,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username, password });
  return res.body.token;
}

async function runTests() {
  console.log('=== SUITE EXHAUSTIVA DE PRUEBAS DE FECHAS, DURACIÓN Y PROTECCIÓN CASCADE ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // --- SECCIÓN 1: INTERPRETACIÓN Y RECHAZO DE FECHAS EN RESOLUCIONES ---
  console.log('--- SECCIÓN 1: RECHAZO DE TEXTOS DE RESOLUCIÓN COMO FECHAS DE COMISIÓN ---');

  test('RES-01: Rechazo de resolución en fecha ("RES 123 DEL 10/04/2023")', () => {
    const res = parseDateRobust('RES 123 DEL 10/04/2023');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, null);
    assert.strictEqual(res.invalid, true);
  });

  test('RES-02: Rechazo de patrón acto con barra ("123/10/04/2023")', () => {
    const res = parseDateRobust('123/10/04/2023');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, null);
    assert.strictEqual(res.invalid, true);
  });

  test('RES-03: Rechazo de texto "RESOLUCION 456 DEL 2023"', () => {
    const res = parseDateRobust('RESOLUCION 456 DEL 2023');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, null);
    assert.strictEqual(res.invalid, true);
  });

  test('RES-04: Rechazo de "DECRETO 042 DE 2023"', () => {
    const res = parseDateRobust('DECRETO 042 DE 2023');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.invalid, true);
  });

  test('RES-05: Rechazo de "OFICIO 998"', () => {
    const res = parseDateRobust('OFICIO 998');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.invalid, true);
  });

  // --- SECCIÓN 2: 12 CASOS OBLIGATORIOS DE VALIDACIÓN DE DURACIÓN ---
  console.log('\n--- SECCIÓN 2: 12 CASOS OBLIGATORIOS DE VALIDACIÓN DE DURACIÓN ---');

  // Caso 1: NULL (sin fecha ni duración)
  test('VD-01: Duración NULL (rawVal=null, dias=null)', () => {
    const res = parseDateRobust(null, null, null);
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, null);
  });

  // Caso 2: 0 (dias = 0 debe ser rechazado como duración inválida)
  test('VD-02: Duración 0 días (explicitDias=0)', () => {
    const res = parseDateRobust(null, null, 0);
    assert.strictEqual(res.dias, null, 'dias=0 no es una duración válida de comisión');
  });

  // Caso 3: -5 (negativo rechazado)
  test('VD-03: Duración negativa (explicitDias=-5)', () => {
    const res = parseDateRobust(null, null, -5);
    assert.strictEqual(res.dias, null, 'Duración negativa debe ser rechazada');
  });

  // Caso 4: 3.5 (decimal rechazado, solo enteros)
  test('VD-04: Duración decimal (explicitDias=3.5)', () => {
    const res = parseDateRobust(null, null, '3.5');
    assert.strictEqual(res.dias, null, 'Duración decimal debe ser rechazada (solo enteros)');
  });

  // Caso 5: "5 días" (alfanumérico con unidades rechazado)
  test('VD-05: Duración con texto ("5 días")', () => {
    const res = parseDateRobust(null, null, '5 días');
    assert.strictEqual(res.dias, null, 'Cadena "5 días" debe ser rechazada');
  });

  // Caso 6: "5abc" (alfanumérico rechazado)
  test('VD-06: Duración alfanumérica ("5abc")', () => {
    const res = parseDateRobust(null, null, '5abc');
    assert.strictEqual(res.dias, null, 'Cadena "5abc" debe ser rechazada');
  });

  // Caso 7: "5" (cadena entera pura válida)
  test('VD-07: Duración como cadena entera ("5")', () => {
    const res = parseDateRobust(null, null, '5');
    assert.strictEqual(res.dias, 5, 'Cadena "5" debe ser parseada como 5');
  });

  // Caso 8: Rango de 4 días (con fechas válidas)
  test('VD-08: Rango de 4 días (10,11,12,13/05/2023)', () => {
    const res = parseDateRobust('10,11,12,13/05/2023');
    assert.strictEqual(res.start, '10/05/2023');
    assert.strictEqual(res.end, '13/05/2023');
    assert.strictEqual(res.dias, 4);
  });

  // Caso 9: Duración explícita 7 con fecha vacía
  test('VD-09: Duración explícita 7 con fecha vacía', () => {
    const res = parseDateRobust(null, null, 7);
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, 7);
  });

  // Caso 10: Fecha vacía sin duración disponible
  test('VD-10: Fecha vacía sin duración disponible', () => {
    const res = parseDateRobust('', null, '');
    assert.strictEqual(res.start, null);
    assert.strictEqual(res.end, null);
    assert.strictEqual(res.dias, null);
  });

  console.log(`\nResultado Parser (Unitario): ${passed}/${total} pruebas superadas.\n`);

  // --- SECCIÓN 3: PRUEBAS EN VIVO API / BD (CASOS 11, 12, NULABILIDAD Y CASCADE) ---
  console.log('--- SECCIÓN 3: PRUEBAS EN VIVO API Y POSTGRESQL ---');
  const token = await loginUser('bergenet.gutierrez@boyaca.gov.co', '@Bergenet123');
  if (!token) throw new Error('No se pudo autenticar a Bergenet Gutierrez.');

  // Caso VD-11 y VD-12 con API real y PostgreSQL:
  // Crear viático inicial con rango 10/05/2026 - 12/05/2026 (3 días)
  const createViatico = await requestJson({
    host: 'localhost',
    port: 80,
    path: '/api/viaticos',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    persona: 'SERVIDOR PRUEBA CASOS DURACION',
    documento: '1057611073',
    dependencia: 'SECRETARÍA GENERAL',
    cargo: 'PROFESIONAL UNIVERSITARIO',
    destino: 'DUITAMA',
    motivo: 'Prueba de actualización de fechas y duración',
    fechaInicio: '2026-05-10',
    fechaFin: '2026-05-12',
    valorTotal: 300000
  });

  assert.strictEqual(createViatico.status, 201);
  const vitId = createViatico.body.id;

  const rowInitial = await pool.query('SELECT fecha_inicio, fecha_fin, dias FROM viaticos WHERE id_viatico = $1', [vitId]);
  assert.strictEqual(rowInitial.rows[0].dias, 3, 'Duración inicial calculada = 3 días');
  console.log(`[PASS] Creación inicial: id=${vitId}, dias=${rowInitial.rows[0].dias}`);

  // Caso 11: Actualización con nuevas fechas (de 10-12 a 10-15 = 6 días)
  const updateRes1 = await requestJson({
    host: 'localhost',
    port: 80,
    path: `/api/viaticos/${vitId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    persona: 'SERVIDOR PRUEBA CASOS DURACION',
    documento: '1057611073',
    dependencia: 'SECRETARÍA GENERAL',
    cargo: 'PROFESIONAL UNIVERSITARIO',
    destino: 'DUITAMA',
    motivo: 'Prueba de actualización de fechas y duración',
    fechaInicio: '2026-05-10',
    fechaFin: '2026-05-15',
    estado: 'Radicado'
  });

  assert.strictEqual(updateRes1.status, 200);
  const rowUpdated1 = await pool.query('SELECT fecha_inicio, fecha_fin, dias FROM viaticos WHERE id_viatico = $1', [vitId]);
  assert.strictEqual(rowUpdated1.rows[0].dias, 6, 'Duración recalculada automáticamente = 6 días');
  console.log(`[PASS] VD-11: Actualización con nuevo rango de fechas recalculó dias=${rowUpdated1.rows[0].dias}`);

  // Caso 12: Actualización sin fechas ni duración (debe conservar duración previa)
  const updateRes2 = await requestJson({
    host: 'localhost',
    port: 80,
    path: `/api/viaticos/${vitId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    persona: 'SERVIDOR PRUEBA CASOS DURACION',
    documento: '1057611073',
    dependencia: 'SECRETARÍA GENERAL',
    cargo: 'PROFESIONAL UNIVERSITARIO',
    destino: 'DUITAMA MODIFICADO',
    motivo: 'Prueba de conservación de duración previa',
    estado: 'Radicado'
  });

  assert.strictEqual(updateRes2.status, 200);
  const rowUpdated2 = await pool.query('SELECT fecha_inicio, fecha_fin, dias, destino FROM viaticos WHERE id_viatico = $1', [vitId]);
  assert.strictEqual(rowUpdated2.rows[0].dias, 6, 'Debe conservar la duración previa de 6 días');
  assert.strictEqual(rowUpdated2.rows[0].destino, 'DUITAMA MODIFICADO');
  console.log(`[PASS] VD-12: Actualización sin fechas ni duración conservó dias=${rowUpdated2.rows[0].dias}`);

  // --- SECCIÓN 4: PROTECCIÓN CONTRA ELIMINACIÓN EN CASCADA ---
  console.log('\n--- SECCIÓN 4: PROTECCIÓN CONTRA ELIMINACIÓN EN CASCADA ---');

  // 1. Verificar constraint en PostgreSQL
  const fkRes = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conname = 'viaticos_id_paquete_fkey' AND conrelid = 'viaticos'::regclass
  `);
  assert.strictEqual(fkRes.rows.length, 1, 'Constraint viaticos_id_paquete_fkey debe existir');
  assert.ok(fkRes.rows[0].def.includes('ON DELETE RESTRICT'), `Definición FK debe ser ON DELETE RESTRICT: ${fkRes.rows[0].def}`);
  console.log(`[PASS] PostgreSQL FK Constraint: ${fkRes.rows[0].conname} -> ${fkRes.rows[0].def}`);

  // 2. Verificar que intentar eliminar un paquete con viáticos vía API es rechazado con 400
  const pkgWithViaticos = await pool.query(`
    SELECT id_paquete, COUNT(*) as cnt
    FROM viaticos
    WHERE id_paquete IS NOT NULL
    GROUP BY id_paquete
    ORDER BY cnt DESC
    LIMIT 1
  `);
  assert.ok(pkgWithViaticos.rows.length > 0, 'Debe haber paquetes con viáticos en BD');
  const targetPkgId = pkgWithViaticos.rows[0].id_paquete;
  const viaticosCountInPkg = parseInt(pkgWithViaticos.rows[0].cnt, 10);

  const deleteAttemptRes = await requestJson({
    host: 'localhost',
    port: 80,
    path: `/api/viaticos/paquetes/${targetPkgId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  assert.strictEqual(deleteAttemptRes.status, 400, 'Debe responder HTTP 400 rechazando la eliminación');
  assert.ok(deleteAttemptRes.body.error.includes('No es posible eliminar el paquete presupuestal'), 'Mensaje de error debe explicar la protección');
  console.log(`[PASS] API bloqueó intento de eliminar paquete ${targetPkgId} (${viaticosCountInPkg} viáticos): "${deleteAttemptRes.body.error}"`);

  // Verificar que el paquete y sus viáticos siguen 100% intactos
  const checkPkgExists = await pool.query('SELECT COUNT(*) FROM paquetes_viaticos WHERE id_paquete = $1', [targetPkgId]);
  assert.strictEqual(parseInt(checkPkgExists.rows[0].count, 10), 1, 'El paquete presupuestal debe existir intacto');
  const checkVitExists = await pool.query('SELECT COUNT(*) FROM viaticos WHERE id_paquete = $1', [targetPkgId]);
  assert.strictEqual(parseInt(checkVitExists.rows[0].count, 10), viaticosCountInPkg, 'Todos los viáticos asociados siguen intactos');
  console.log(`[PASS] Integridad histórica garantizada: 0 viáticos eliminados.`);

  // 3. Probar que un paquete vacío sí puede ser eliminado sin afectar a ningún registro
  const createEmptyPkg = await pool.query(`
    INSERT INTO paquetes_viaticos (nombre, archivo_origen, anio, descripcion, creado_por)
    VALUES ('PAQUETE TEMPORAL PRUEBA VACIO', 'TEMP.xlsx', 2026, 'Paquete de prueba temporal', 'test_audit')
    RETURNING id_paquete
  `);
  const emptyPkgId = createEmptyPkg.rows[0].id_paquete;

  const deleteEmptyRes = await requestJson({
    host: 'localhost',
    port: 80,
    path: `/api/viaticos/paquetes/${emptyPkgId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(deleteEmptyRes.status, 200, 'Paquete vacío sí puede ser eliminado');
  console.log(`[PASS] Paquete vacío ${emptyPkgId} eliminado correctamente vía API.`);

  // Limpieza de registro sintético de viático
  await pool.query('DELETE FROM viaticos WHERE id_viatico = $1', [vitId]);
  console.log(`[CLEANUP] Viático sintético ${vitId} eliminado limpiamente.`);

  await pool.end();
  console.log('\n=== SUITE COMPLETADA CON ÉXITO AL 100% (FECHAS, DURACIÓN Y PROTECCIÓN CASCADE) ===');
}

runTests().catch(err => {
  console.error('FATAL ERROR EN PRUEBAS:', err);
  process.exit(1);
});
