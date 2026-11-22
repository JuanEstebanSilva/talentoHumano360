const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { Pool } = require('pg');
const trackImport = require('../utils/importHistory');
const { uploadMiddleware, previsualizarExcel, importarExcel } = require('../controllers/employeeImportController');
const { parseExcelDate, formatDateISO } = require('../utils/excelHelper');
const {
  GRADOS_VALIDOS,
  CLASIFICACIONES_EMPLEO,
  ESTADOS_SERVIDOR,
  SEXOS_VALIDOS,
  DISCAPACIDADES_VALIDAS,
  TIPOS_SANGRE_VALIDOS,
  DIPLOMADOS_OPCIONES,
  validateCodigoCargo,
  validateGrado,
  validateEstadoServidor,
  validateAndSplitNombre,
  validateCedulaInput,
  formatCedulaVisual,
  generarIdTemporalSecuencial,
  validateSexo,
  validateTipoSangre,
  validateSituacionDiscapacidad,
  calcularDiferenciaFechasExacta,
  normalizarClasificacionEmpleo,
  parseSituacionYDiscapacidad,
  validateFunciones,
  validateMatricula,
  validateTelefonoFijo,
  validateCelulares,
  validateEmail,
  validateOtroTiempoPeriodos,
  sumarTiemposExactos,
  calcularOtroTiempoNormalizado,
  inferirNivelCargo
} = require('../utils/employeeValidator');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'talento360',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'admin123',
        ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const isDefaultOrInsecure = !secret || secret.trim() === '' || secret.includes('talento360_secret_2026');
  if (isProd) {
    if (isDefaultOrInsecure) {
      console.error('[FATAL CIBERSEGURIDAD] En entorno de producción (NODE_ENV=production), la variable JWT_SECRET es obligatoria y no puede usar el secreto predeterminado o predecible (AUD-011).');
      process.exit(1);
    }
    return secret;
  }
  if (isDefaultOrInsecure) {
    console.warn('[AVISO DE SEGURIDAD] JWT_SECRET no configurado o usando valor por defecto en desarrollo.');
    return secret || 'talento360_secret_2026';
  }
  return secret;
}
const JWT_SECRET = resolveJwtSecret();

function auth(req, res, next) {
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido o sesión expirada.' }); }
}
function hasPermission(user, requiredPerm) {
  if (!user) return false;
  const role = String(typeof user === 'string' ? user : (user.role || user.rol || '')).toLowerCase();
  const mods = (typeof user === 'object' && Array.isArray(user.modules))
    ? user.modules
    : (typeof user === 'object' && typeof user.modules === 'string' ? user.modules.split(',').map(m => m.trim().toLowerCase()) : []);
  const perms = (typeof user === 'object' && Array.isArray(user.permissions)) ? user.permissions : [];

  // 1. Acceso de Administrador General / Superusuario
  if (role === 'administrador' || role === 'admin' || mods.includes('*') || mods.includes('all') || perms.includes('*')) {
    return true;
  }

  // 2. Verificación estricta de permiso granular
  if (requiredPerm) {
    if (perms.includes(requiredPerm)) return true;
    const [mod, action] = requiredPerm.split(':');
    if (perms.includes(`${mod}:*`)) return true;
    // Si la acción es lectura (read) y el módulo está asignado (sin restricción de solo escritura)
    if (action === 'read' && mods.includes(mod)) return true;
    // Para escritura (write/delete/import/export), NO basta tener el nombre del módulo en mods si perms existe
    if (perms.length === 0 && mods.includes(mod)) return true;
    if (action === 'write' && (mods.includes(`${mod}_write`) || mods.includes(`${mod}:write`))) return true;
  }

  return false;
}

function canEdit(user) {
  return hasPermission(user, 'employees:write');
}

function canRead(user) {
  return hasPermission(user, 'employees:read');
}

function canLookup(user) {
  return canRead(user) ||
    hasPermission(user, 'horarios:read') ||
    hasPermission(user, 'horarios:write') ||
    hasPermission(user, 'viaticos:read') ||
    hasPermission(user, 'viaticos:write') ||
    hasPermission(user, 'requests:read') ||
    hasPermission(user, 'requests:write');
}
function clean(v) { return v == null ? '' : String(v).trim().replace(/\s+/g,' ').toUpperCase(); }

// ─── POST /api/employees/previsualizar-excel (Diagnóstico y Pre-auditoría de Excel) ─────────
router.post(['/previsualizar-excel', '/preview-excel'], auth, (req, res) => {
  if (!canEdit(req.user)) {
    return res.status(403).json({ success: false, error: 'Permisos insuficientes para realizar la previsualización masiva.' });
  }

  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    previsualizarExcel(req, res, pool);
  });
});

// ─── POST /api/employees/importar-excel (Carga Masiva de Archivo Excel) ─────────
router.post(['/importar-excel', '/import-excel', '/upload-excel'], auth, trackImport(pool, 'employees'), (req, res) => {
  if (!canEdit(req.user)) {
    return res.status(403).json({ success: false, error: 'Permisos insuficientes para realizar la importación masiva.' });
  }

  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    importarExcel(req, res, pool);
  });
});

// ─── GET /api/employees/buscar (Búsqueda institucional ligera para formularios) ──
// Trae ÚNICAMENTE la información estrictamente requerida (identificación y cargo institucional):
// - Cédula / Documento
// - Nombre completo
// - Cargo
// - Código del cargo
// - Grado salarial
// - Dependencia
// - Secretaría
router.get(['/buscar', '/buscar-servidor', '/lookup'], auth, async (req, res) => {
  if (!canLookup(req.user)) {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Permisos insuficientes para consultar el censo de funcionarios.' });
  }

  const { q = '', cedula = '', limit = 8 } = req.query;
  const searchLimit = Math.min(Math.max(1, parseInt(limit, 10) || 8), 25);

  try {
    const rawTerm = (q || cedula || '').trim();
    if (!rawTerm) {
      return res.json({ data: [] });
    }

    const cleanCedula = rawTerm.replace(/[.,\s]/g, '');
    const digitsOnly = rawTerm.replace(/\D/g, '');

    let normCedula = '';
    if (cleanCedula !== rawTerm && cleanCedula.length > 0) {
      normCedula = cleanCedula;
    } else if (digitsOnly.length >= 3 && digitsOnly !== rawTerm) {
      normCedula = digitsOnly;
    }

    const params = [`%${rawTerm}%`];
    let whereQuery = `
      WHERE (COALESCE(p.es_vacante, false) = false AND COALESCE(p.primer_apellido, '') != 'VACANTE')
        AND (p.cedula != 'PROV-00003' AND UPPER(COALESCE(p.nombre_completo, '')) NOT LIKE '%SUPERVISOR%')
        AND (
          LOWER(p.nombre_completo) LIKE LOWER($1)
          OR p.cedula LIKE $1
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') LIKE $1
    `;

    if (normCedula) {
      params.push(`%${normCedula}%`);
      whereQuery += `
          OR p.cedula LIKE $2
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') LIKE $2
      `;
    }

    whereQuery += `)`;

    params.push(rawTerm);
    const rawTermParam = `$${params.length}`;
    params.push(cleanCedula);
    const cleanCedulaParam = `$${params.length}`;

    params.push(searchLimit);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT 
        COALESCE(p.cedula, '') AS cedula,
        COALESCE(p.nombre_completo, TRIM(CONCAT(p.primer_apellido, ' ', p.segundo_apellido, ' ', p.nombres))) AS nombre_completo,
        COALESCE(ca.cargo, cb.cargo, 'PROFESIONAL UNIVERSITARIO') AS cargo,
        COALESCE(ca.codigo, cb.codigo, '') AS codigo,
        COALESCE(ca.grado, cb.grado, '') AS grado,
        COALESCE(d.dependencia, 'SECRETARÍA GENERAL') AS dependencia,
        COALESCE(con.celular, con.telefono_fijo, '') AS telefono,
        COALESCE(con.celular, '') AS celular,
        COALESCE(con.telefono_fijo, '') AS telefono_fijo
      FROM rel_principal r
      JOIN personas p ON p.id_persona = r.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
      LEFT JOIN cargos ca ON ca.id_cargo = r.id_cargo_actual
      LEFT JOIN cargos cb ON cb.id_cargo = r.id_cargo_base
      LEFT JOIN contactos con ON con.id_contacto = r.id_contacto
      LEFT JOIN estados e ON e.id_estado = r.id_estado
      ${whereQuery}
      ORDER BY 
        CASE WHEN LOWER(COALESCE(e.estado_servidor, 'Activo')) = 'activo' THEN 1 ELSE 2 END,
        CASE 
          WHEN p.cedula = ${rawTermParam} OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = ${cleanCedulaParam} THEN 1 
          ELSE 2 
        END,
        p.nombre_completo ASC
      LIMIT ${limitParam}
    `;

    const result = await pool.query(sql, params);

    const data = result.rows.map(row => {
      const depUpper = (row.dependencia || '').toUpperCase().trim();
      let sec = depUpper;
      if (depUpper.includes('SECRETARÍA') || depUpper.includes('SECRETARIA')) {
        sec = depUpper;
      } else if (depUpper.includes('TALENTO HUMANO') || depUpper.includes('SISTEMAS') || depUpper.includes('SERVICIOS GENERALES')) {
        sec = 'SECRETARÍA GENERAL';
      } else if (depUpper.includes('GOBERNADOR') || depUpper.includes('DESPACHO')) {
        sec = 'DESPACHO DEL GOBERNADOR';
      } else if (depUpper.includes('JURÍDICA') || depUpper.includes('JURIDICA')) {
        sec = 'OFICINA ASESORA JURÍDICA';
      } else {
        sec = depUpper || 'SECRETARÍA GENERAL';
      }

      const rawGrado = (row.grado || '').toString().trim();
      const cleanGrado = (rawGrado && rawGrado !== '—' && rawGrado !== '-') ? rawGrado : 'N/A';

      const rawTel = (row.telefono || row.celular || row.telefono_fijo || '').toString().trim();
      const cleanTelefono = (rawTel && rawTel !== '—' && rawTel !== '-') ? rawTel : 'N/A';

      return {
        cedula: row.cedula,
        documento: row.cedula,
        nombre_completo: row.nombre_completo,
        nombreCompleto: row.nombre_completo,
        persona: row.nombre_completo,
        apellidos_nombres: row.nombre_completo,
        cargo: row.cargo,
        cargoActual: row.cargo,
        cargo_actual: row.cargo,
        codigo: row.codigo || 'N/A',
        codigoActual: row.codigo || 'N/A',
        codigo_actual: row.codigo || 'N/A',
        grado: cleanGrado,
        gradoActual: cleanGrado,
        grado_actual: cleanGrado,
        dependencia: row.dependencia || 'Sin dependencia',
        secretaria: sec,
        telefono: cleanTelefono,
        celular: cleanTelefono,
        telefono_fijo: (row.telefono_fijo && row.telefono_fijo.trim()) || 'N/A',
      };
    });

    return res.json({ data, total: data.length });
  } catch (err) {
    console.error('[employees] buscar error:', err.message);
    return res.status(500).json({ error: 'Error en búsqueda rápida de servidores.', details: err.message });
  }
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  if (!canRead(req.user)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de servidores públicos.' });
  }
  const {
    q = '',
    dependencia = '',
    cargo = '',
    codigoCargo = '',
    grado = '',
    tipoSangre = '',
    sexo = '',
    edadMin = '',
    edadMax = '',
    fechaNacDesde = '',
    fechaNacHasta = '',
    tieneDiscapacidad = '',
    tipoDiscapacidad = '',
    situacion = '',
    clasificacion = '',
    concurso = '',
    opec = '',
    fechaIngresoDesde = '',
    fechaIngresoHasta = '',
    fechaEncargoDesde = '',
    fechaEncargoHasta = '',
    tieneEncargo = '',
    encargoDenominacion = '',
    encargoCodigo = '',
    encargoGrado = '',
    estudios = '',
    institucionEstudios = '',
    tieneDiplomado = '',
    sortBy = '',
    page = 1,
    limit = 30
  } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  try {
    const trimmedQ = (q || '').trim();
    const cleanCedula = trimmedQ.replace(/[.,\s]/g, '');
    const digitsOnly = trimmedQ.replace(/\D/g, '');

    let normCedula = '';
    if (cleanCedula !== trimmedQ && cleanCedula.length > 0) {
      normCedula = cleanCedula;
    } else if (digitsOnly.length >= 3 && digitsOnly !== trimmedQ) {
      normCedula = digitsOnly;
    }

    const whereConditions = [];
    const params = [];

    if (trimmedQ) {
      params.push(`%${trimmedQ}%`);
      const qIdx = params.length;
      if (normCedula) {
        params.push(`%${normCedula}%`);
        const cIdx = params.length;
        whereConditions.push(`(
          LOWER(p.nombre_completo) LIKE LOWER($${qIdx})
          OR p.cedula LIKE $${qIdx}
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') LIKE $${qIdx}
          OR p.cedula LIKE $${cIdx}
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') LIKE $${cIdx}
          OR LOWER(d.dependencia) LIKE LOWER($${qIdx})
          OR LOWER(ca.cargo) LIKE LOWER($${qIdx})
          OR LOWER(cb.cargo) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.clasificacion_empleo, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.situacion, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(r.encargo_denominacion, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.novedades, '')) LIKE LOWER($${qIdx})
          OR (ve.numero_vacante IS NOT NULL AND ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0')) ILIKE $${qIdx})
        )`);
      } else {
        whereConditions.push(`(
          LOWER(p.nombre_completo) LIKE LOWER($${qIdx})
          OR p.cedula LIKE $${qIdx}
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') LIKE $${qIdx}
          OR LOWER(d.dependencia) LIKE LOWER($${qIdx})
          OR LOWER(ca.cargo) LIKE LOWER($${qIdx})
          OR LOWER(cb.cargo) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.clasificacion_empleo, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.situacion, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(r.encargo_denominacion, '')) LIKE LOWER($${qIdx})
          OR LOWER(COALESCE(e.novedades, '')) LIKE LOWER($${qIdx})
          OR (ve.numero_vacante IS NOT NULL AND ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0')) ILIKE $${qIdx})
        )`);
      }
    }

    const trimmedDep = (dependencia || '').trim();
    if (trimmedDep && trimmedDep.toUpperCase() !== 'TODAS' && trimmedDep.toUpperCase() !== 'TODAS LAS DEPENDENCIAS') {
      params.push(trimmedDep);
      const depIdx = params.length;
      whereConditions.push(`(
        LOWER(d.dependencia) = LOWER($${depIdx})
        OR LOWER(d.dependencia) LIKE '%' || LOWER($${depIdx}) || '%'
      )`);
    }

    const trimmedCargo = (cargo || '').trim();
    if (trimmedCargo && trimmedCargo.toUpperCase() !== 'TODOS' && trimmedCargo.toUpperCase() !== 'TODOS LOS CARGOS') {
      params.push(trimmedCargo);
      const cargoIdx = params.length;
      whereConditions.push(`(
        LOWER(ca.cargo) = LOWER($${cargoIdx})
        OR LOWER(cb.cargo) = LOWER($${cargoIdx})
      )`);
    }
    // ─── FILTROS AVANZADOS ────────────────────────────────────────────────────────
    if (codigoCargo && codigoCargo.trim()) {
      params.push(codigoCargo.trim());
      const idx = params.length;
      whereConditions.push('(ca.codigo = $' + idx + ' OR cb.codigo = $' + idx + ' OR r.encargo_codigo = $' + idx + ')');
    }

    if (grado && grado.trim()) {
      params.push(grado.trim());
      const idx = params.length;
      whereConditions.push('(ca.grado = $' + idx + ' OR cb.grado = $' + idx + ' OR r.encargo_grado = $' + idx + ')');
    }

    if (tipoSangre && tipoSangre.trim()) {
      params.push(tipoSangre.trim());
      const idx = params.length;
      whereConditions.push('REPLACE(UPPER(COALESCE(p.tipo_sangre, \'\')), \'0\', \'O\') = REPLACE(UPPER($' + idx + '), \'0\', \'O\')');
    }

    if (sexo && sexo.trim()) {
      const s = sexo.trim().toUpperCase();
      if (s === 'M' || s.startsWith('MASC')) {
        whereConditions.push('(UPPER(COALESCE(p.sexo, \'\')) LIKE \'M%\' OR UPPER(COALESCE(p.sexo, \'\')) = \'M\')');
      } else if (s === 'F' || s.startsWith('FEM')) {
        whereConditions.push('(UPPER(COALESCE(p.sexo, \'\')) LIKE \'F%\' OR UPPER(COALESCE(p.sexo, \'\')) = \'F\')');
      } else {
        params.push(s);
        whereConditions.push('UPPER(COALESCE(p.sexo, \'\')) = UPPER($' + params.length + ')');
      }
    }

    if (edadMin && !isNaN(parseInt(edadMin, 10))) {
      params.push(parseInt(edadMin, 10));
      whereConditions.push('(p.fecha_nacimiento ~ \'^\\d{4}-\\d{2}-\\d{2}$\' AND DATE_PART(\'year\', AGE(CURRENT_DATE, p.fecha_nacimiento::date)) >= $' + params.length + ')');
    }

    if (edadMax && !isNaN(parseInt(edadMax, 10))) {
      params.push(parseInt(edadMax, 10));
      whereConditions.push('(p.fecha_nacimiento ~ \'^\\d{4}-\\d{2}-\\d{2}$\' AND DATE_PART(\'year\', AGE(CURRENT_DATE, p.fecha_nacimiento::date)) <= $' + params.length + ')');
    }

    if (fechaNacDesde && fechaNacDesde.trim()) {
      params.push(fechaNacDesde.trim());
      whereConditions.push('p.fecha_nacimiento >= $' + params.length);
    }

    if (fechaNacHasta && fechaNacHasta.trim()) {
      params.push(fechaNacHasta.trim());
      whereConditions.push('p.fecha_nacimiento <= $' + params.length);
    }

    if (tieneDiscapacidad) {
      const td = tieneDiscapacidad.trim().toLowerCase();
      if (td === 'si' || td === 'true' || td === '1') {
        whereConditions.push('(p.tipo_discapacidad IS NOT NULL AND TRIM(p.tipo_discapacidad) != \'\' AND UPPER(p.tipo_discapacidad) NOT IN (\'NINGUNA\', \'NINGUNO\', \'NO REGISTRA\', \'SIN ESPECIFICAR\'))');
      } else if (td === 'no' || td === 'false' || td === '0') {
        whereConditions.push('(p.tipo_discapacidad IS NULL OR TRIM(p.tipo_discapacidad) = \'\' OR UPPER(p.tipo_discapacidad) IN (\'NINGUNA\', \'NINGUNO\', \'NO REGISTRA\', \'SIN ESPECIFICAR\'))');
      }
    }

    if (tipoDiscapacidad && tipoDiscapacidad.trim()) {
      params.push('%' + tipoDiscapacidad.trim() + '%');
      whereConditions.push('UPPER(COALESCE(p.tipo_discapacidad, \'\')) LIKE UPPER($' + params.length + ')');
    }

    if (situacion && situacion.trim()) {
      const sitTrim = situacion.trim();
      if (sitTrim.toUpperCase() === 'ENCARGO') {
        whereConditions.push(`(
          UPPER(COALESCE(e.situacion, '')) = 'ENCARGO'
          OR UPPER(COALESCE(e.clasificacion_empleo, '')) LIKE '%ENCARGO%'
          OR (r.encargo_denominacion IS NOT NULL AND TRIM(r.encargo_denominacion) != '')
          OR r.fecha_encargo IS NOT NULL
        )`);
      } else if (sitTrim.toUpperCase() === 'RETIRADO' || sitTrim.toUpperCase() === 'INACTIVO') {
        whereConditions.push(`(
          UPPER(COALESCE(e.situacion, '')) LIKE '%RETIRAD%'
          OR UPPER(COALESCE(e.estado_servidor, '')) = 'RETIRADO'
          OR UPPER(COALESCE(e.estado_servidor, '')) = 'INACTIVO'
        )`);
      } else {
        params.push('%' + sitTrim + '%');
        whereConditions.push('UPPER(COALESCE(e.situacion, \'\')) LIKE UPPER($' + params.length + ')');
      }
    }

    if (clasificacion && clasificacion.trim()) {
      const clasTrim = clasificacion.trim();
      if (['ENCARGO', 'ENCARGOS', 'ENCARGO (TODOS)', 'ENCARGO (TODOS LOS TIPOS)', 'TODOS LOS ENCARGOS'].includes(clasTrim.toUpperCase())) {
        whereConditions.push(`(
          UPPER(COALESCE(e.clasificacion_empleo, '')) LIKE '%ENCARGO%'
          OR UPPER(COALESCE(e.situacion, '')) = 'ENCARGO'
          OR (r.encargo_denominacion IS NOT NULL AND TRIM(r.encargo_denominacion) != '')
          OR r.fecha_encargo IS NOT NULL
        )`);
      } else {
        params.push('%' + clasTrim + '%');
        whereConditions.push('UPPER(COALESCE(e.clasificacion_empleo, \'\')) LIKE UPPER($' + params.length + ')');
      }
    }

    if (concurso) {
      const cc = concurso.trim().toLowerCase();
      if (cc === 'si' || cc === 'true' || cc === '1') {
        whereConditions.push('(e.opec IS NOT NULL AND TRIM(e.opec) != \'\' AND UPPER(e.opec) NOT IN (\'NO\', \'NO REGISTRADO\', \'NINGUNA\', \'NINGUNO\', \'0\'))');
      } else if (cc === 'no' || cc === 'false' || cc === '0') {
        whereConditions.push('(e.opec IS NULL OR TRIM(e.opec) = \'\' OR UPPER(e.opec) IN (\'NO\', \'NO REGISTRADO\', \'NINGUNA\', \'NINGUNO\', \'0\'))');
      }
    }

    if (opec && opec.trim()) {
      params.push('%' + opec.trim() + '%');
      whereConditions.push('UPPER(COALESCE(e.opec, \'\')) LIKE UPPER($' + params.length + ')');
    }

    if (fechaIngresoDesde && fechaIngresoDesde.trim()) {
      params.push(fechaIngresoDesde.trim());
      whereConditions.push('r.fecha_ingreso >= $' + params.length);
    }

    if (fechaIngresoHasta && fechaIngresoHasta.trim()) {
      params.push(fechaIngresoHasta.trim());
      whereConditions.push('r.fecha_ingreso <= $' + params.length);
    }

    if (fechaEncargoDesde && fechaEncargoDesde.trim()) {
      params.push(fechaEncargoDesde.trim());
      whereConditions.push('r.fecha_encargo >= $' + params.length);
    }

    if (fechaEncargoHasta && fechaEncargoHasta.trim()) {
      params.push(fechaEncargoHasta.trim());
      whereConditions.push('r.fecha_encargo <= $' + params.length);
    }

    if (tieneEncargo) {
      const te = tieneEncargo.trim().toLowerCase();
      if (te === 'si' || te === 'true' || te === '1') {
        whereConditions.push(`(
          (r.encargo_denominacion IS NOT NULL AND TRIM(r.encargo_denominacion) != '')
          OR UPPER(COALESCE(e.situacion, '')) = 'ENCARGO'
          OR UPPER(COALESCE(e.clasificacion_empleo, '')) LIKE '%ENCARGO%'
          OR r.fecha_encargo IS NOT NULL
        )`);
      } else if (te === 'no' || te === 'false' || te === '0') {
        whereConditions.push(`(
          (r.encargo_denominacion IS NULL OR TRIM(r.encargo_denominacion) = '')
          AND UPPER(COALESCE(e.situacion, '')) != 'ENCARGO'
          AND UPPER(COALESCE(e.clasificacion_empleo, '')) NOT LIKE '%ENCARGO%'
          AND r.fecha_encargo IS NULL
        )`);
      }
    }

    if (encargoDenominacion && encargoDenominacion.trim()) {
      params.push('%' + encargoDenominacion.trim() + '%');
      whereConditions.push('UPPER(COALESCE(r.encargo_denominacion, \'\')) LIKE UPPER($' + params.length + ')');
    }

    if (encargoCodigo && encargoCodigo.trim()) {
      params.push(encargoCodigo.trim());
      whereConditions.push('r.encargo_codigo = $' + params.length);
    }

    if (encargoGrado && encargoGrado.trim()) {
      params.push(encargoGrado.trim());
      whereConditions.push('r.encargo_grado = $' + params.length);
    }

    if (estudios && estudios.trim()) {
      params.push('%' + estudios.trim() + '%');
      whereConditions.push('UPPER(COALESCE(edu.estudios, \'\')) LIKE UPPER($' + params.length + ')');
    }

    if (institucionEstudios && institucionEstudios.trim()) {
      params.push('%' + institucionEstudios.trim() + '%');
      whereConditions.push('UPPER(COALESCE(edu.institucion_estudios, \'\')) LIKE UPPER($' + params.length + ')');
    }

    if (tieneDiplomado) {
      const td = tieneDiplomado.trim().toLowerCase();
      if (td === 'si' || td === 'true' || td === '1') {
        whereConditions.push('edu.tiene_diplomado = true');
      } else if (td === 'no' || td === 'false' || td === '0') {
        whereConditions.push('(edu.tiene_diplomado = false OR edu.tiene_diplomado IS NULL)');
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;

    let orderClause = `
      CASE 
        -- 1. Inactivos de últimas (prioridad 2)
        WHEN LOWER(COALESCE(e.estado_servidor, 'Activo')) != 'activo' THEN 2
        -- 2. Sin cédula de penúltimas (prioridad 1): documento_pendiente, prefijo PROV-, nulo/vacío, o vacantes
        WHEN COALESCE(p.documento_pendiente, false) = true
          OR p.cedula LIKE 'PROV-%'
          OR p.cedula IS NULL
          OR TRIM(p.cedula) = ''
          OR TRIM(p.cedula) = '0'
          OR COALESCE(p.es_vacante, false) = true
          OR p.primer_apellido = 'VACANTE'
          OR p.nombre_completo LIKE 'PLAZA VACANTE%'
          THEN 1
        -- 3. Activos con cédula de primeras (prioridad 0)
        ELSE 0 
      END ASC,
      p.nombre_completo ASC`;

    if (sortBy === 'fecha_ingreso_asc' || sortBy === 'tiempo_servicio_desc') {
      orderClause = `r.fecha_ingreso ASC NULLS LAST, p.nombre_completo ASC`;
    } else if (sortBy === 'fecha_ingreso_desc' || sortBy === 'tiempo_servicio_asc') {
      orderClause = `r.fecha_ingreso DESC NULLS LAST, p.nombre_completo ASC`;
    } else if (sortBy === 'edad_asc') {
      orderClause = `p.fecha_nacimiento DESC NULLS LAST, p.nombre_completo ASC`;
    } else if (sortBy === 'edad_desc') {
      orderClause = `p.fecha_nacimiento ASC NULLS LAST, p.nombre_completo ASC`;
    } else if (sortBy === 'alfabetico_asc') {
      orderClause = `p.nombre_completo ASC`;
    } else if (sortBy === 'alfabetico_desc') {
      orderClause = `p.nombre_completo DESC`;
    } else if (sortBy === 'cedula_asc') {
      orderClause = `NULLIF(REGEXP_REPLACE(p.cedula, '[^0-9]', '', 'g'), '')::BIGINT ASC NULLS LAST`;
    } else if (sortBy === 'cedula_desc') {
      orderClause = `NULLIF(REGEXP_REPLACE(p.cedula, '[^0-9]', '', 'g'), '')::BIGINT DESC NULLS LAST`;
    }

    const sql = `
      WITH vacantes_enum AS (
        SELECT r_sub.id_registro,
               ROW_NUMBER() OVER (ORDER BY r_sub.id_registro) AS numero_vacante
        FROM rel_principal r_sub
        JOIN personas p_sub ON p_sub.id_persona = r_sub.id_persona
        LEFT JOIN estados e_sub ON e_sub.id_estado = r_sub.id_estado
        WHERE p_sub.es_vacante = true OR p_sub.primer_apellido = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
      )
      SELECT r.id_registro,
             ve.numero_vacante,
             CASE
               WHEN ve.numero_vacante IS NOT NULL THEN ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0'))
               ELSE NULL
             END AS codigo_vacante,
             COALESCE(p.cedula,'') AS cedula,
             COALESCE(p.documento_pendiente, (p.cedula LIKE 'PROV-%')) AS documento_pendiente,
             COALESCE(p.es_vacante, (p.primer_apellido = 'VACANTE')) AS es_vacante,
             COALESCE(p.nombre_completo,'') AS nombre_completo,
             COALESCE(p.primer_apellido,'') AS primer_apellido,
             COALESCE(p.segundo_apellido,'') AS segundo_apellido,
             COALESCE(p.nombres,'') AS nombres,
             COALESCE(p.expedida,'') AS expedida,
             COALESCE(p.departamento_expedicion,'') AS departamento_expedicion,
             COALESCE(p.municipio_expedicion, p.ciudad_expedicion,'') AS municipio_expedicion,
             COALESCE(p.ciudad_expedicion, p.municipio_expedicion,'') AS ciudad_expedicion,
             COALESCE(p.tipo_discapacidad,'') AS tipo_discapacidad,
             COALESCE(p.tipo_sangre,'') AS tipo_sangre,
             COALESCE(p.fecha_nacimiento,'') AS fecha_nacimiento,
             COALESCE(p.sexo,'') AS sexo,
             COALESCE(d.dependencia,'') AS dependencia,
             COALESCE(ca.cargo,'') AS cargo_actual,
             COALESCE(ca.codigo,'') AS codigo_actual,
             COALESCE(ca.grado,'') AS grado_actual,
             COALESCE(ca.nivel,'') AS nivel_actual,
             COALESCE(cb.cargo,'') AS cargo_base,
             COALESCE(cb.codigo,'') AS codigo_base,
             COALESCE(cb.grado,'') AS grado_base,
             COALESCE(cb.nivel,'') AS nivel_base,
             COALESCE(con.correo_institucional,'') AS correo,
             COALESCE(con.correo_personal,'') AS correo_personal,
             COALESCE(con.celular,'') AS celular,
             con.celulares AS celulares_arr,
             COALESCE(con.telefono_fijo,'') AS telefono_fijo,
             COALESCE(con.direccion,'') AS direccion,
             COALESCE(con.ciudad,'') AS ciudad,
             COALESCE(edu.estudios,'') AS estudios,
             COALESCE(edu.matricula_profesional,'') AS matricula_profesional,
             COALESCE(edu.institucion_estudios,'') AS institucion_estudios,
             COALESCE(edu.postgrado,'') AS postgrado,
             COALESCE(edu.institucion_postgrado,'') AS institucion_postgrado,
             COALESCE(edu.diplomado_cap_sena,'') AS diplomado_cap_sena,
             COALESCE(edu.tiene_diplomado, false) AS tiene_diplomado,
             COALESCE(e.situacion,'') AS situacion,
             COALESCE(e.clasificacion_empleo,'') AS clasificacion_empleo,
             COALESCE(e.estado_servidor,'Activo') AS estado_servidor,
             COALESCE(e.funciones, e.funciones_pagadas, '') AS funciones,
             COALESCE(e.opec,'') AS opec,
             COALESCE(e.novedades,'') AS novedades,
             COALESCE(r.fecha_ingreso,'') AS fecha_ingreso,
             COALESCE(r.fecha_retiro,'') AS fecha_retiro,
             COALESCE(r.fecha_encargo,'') AS fecha_encargo,
             COALESCE(r.otro_tiempo_gobernacion,'') AS otro_tiempo_gobernacion,
             COALESCE(r.tiempo_total_gobernacion,'') AS tiempo_total_gobernacion,
             COALESCE(r.encargo_denominacion,'') AS encargo_denominacion,
             COALESCE(r.encargo_codigo,'') AS encargo_codigo,
             COALESCE(r.encargo_grado,'') AS encargo_grado,
             COALESCE(r.encargo_asignacion,'') AS encargo_asignacion,
             r.otros_tiempos_periodos
      FROM rel_principal r
      LEFT JOIN vacantes_enum ve ON ve.id_registro = r.id_registro
      LEFT JOIN personas p     ON p.id_persona      = r.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia   = r.id_dependencia
      LEFT JOIN cargos ca      ON ca.id_cargo        = r.id_cargo_actual
      LEFT JOIN cargos cb      ON cb.id_cargo        = r.id_cargo_base
      LEFT JOIN contactos con  ON con.id_contacto    = r.id_contacto
      LEFT JOIN educacion edu  ON edu.id_educacion   = r.id_educacion
      LEFT JOIN estados e      ON e.id_estado         = r.id_estado
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ${limitParam} OFFSET ${offsetParam}`;

    const allParams = [...params, parseInt(limit), offset];
    const rows = await pool.query(sql, allParams);

    // Count total
    const countSql = `
      WITH vacantes_enum AS (
        SELECT r_sub.id_registro,
               ROW_NUMBER() OVER (ORDER BY r_sub.id_registro) AS numero_vacante
        FROM rel_principal r_sub
        JOIN personas p_sub ON p_sub.id_persona = r_sub.id_persona
        LEFT JOIN estados e_sub ON e_sub.id_estado = r_sub.id_estado
        WHERE p_sub.es_vacante = true OR p_sub.primer_apellido = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
      )
      SELECT COUNT(DISTINCT r.id_registro) AS total
      FROM rel_principal r
      LEFT JOIN vacantes_enum ve ON ve.id_registro = r.id_registro
      LEFT JOIN personas p ON p.id_persona = r.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
      LEFT JOIN cargos ca ON ca.id_cargo = r.id_cargo_actual
      LEFT JOIN cargos cb ON cb.id_cargo = r.id_cargo_base
      LEFT JOIN contactos con ON con.id_contacto = r.id_contacto
      LEFT JOIN educacion edu ON edu.id_educacion = r.id_educacion
      LEFT JOIN estados e ON e.id_estado = r.id_estado
      ${whereClause}`;
    const countRows = await pool.query(countSql, params);
    const total = parseInt(countRows.rows[0]?.total || 0);

    res.json({
      data: rows.rows.map(r => {
        // Cálculo dinámico estricto: "X años, Y meses, Z días"
        const dateNac = parseExcelDate(r.fecha_nacimiento);
        const dateIng = parseExcelDate(r.fecha_ingreso);
        const esRetirado = (r.estado_servidor || '').toLowerCase() === 'retirado' || (r.situacion || '').toLowerCase() === 'retirado';
        const dateRetiro = esRetirado ? parseExcelDate(r.fecha_retiro) : null;
        const edadCalc = dateNac ? calcularDiferenciaFechasExacta(dateNac) : null;
        const tiempoCalc = dateIng ? calcularDiferenciaFechasExacta(dateIng, dateRetiro || undefined) : null;
        const esVacante = Boolean(r.es_vacante);
        const numeroVacante = r.numero_vacante ? parseInt(r.numero_vacante) : null;
        const codigoVacante = r.codigo_vacante || (numeroVacante ? `PLAZA VACANTE ${String(numeroVacante).padStart(4, '0')}` : (esVacante ? 'PLAZA VACANTE' : null));

        const otroTiempoCalc = esVacante ? null : calcularOtroTiempoNormalizado(
          r.otros_tiempos_periodos,
          r.otro_tiempo_gobernacion,
          dateIng
        );

        const tiempoTotalCalc = esVacante ? null : sumarTiemposExactos(
          tiempoCalc,
          otroTiempoCalc
        );

        // Formateador visual con puntos para cédula
        const cedulaPura = esVacante ? null : r.cedula;
        const cedulaVisual = cedulaPura ? formatCedulaVisual(cedulaPura) : null;

        // Celulares como array limpio
        let celularesArr = Array.isArray(r.celulares_arr) ? r.celulares_arr.filter(Boolean) : [];
        if (celularesArr.length === 0 && r.celular && r.celular !== 'NO REGISTRADO') {
          celularesArr = r.celular.split(/[\/\,\;]/).map(c => c.trim()).filter(Boolean);
        }

        // Apellidos desagregados
        const apellidosJuntos = [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' ').trim();

        return {
          id: r.id_registro,
          cedula: cedulaPura,
          cedulaVisual: cedulaVisual,
          nombreCompleto: clean(r.nombre_completo),
          nombre_completo: clean(r.nombre_completo),
          persona: clean(r.nombre_completo),
          primerApellido: esVacante ? 'VACANTE' : clean(r.primer_apellido),
          segundoApellido: esVacante ? '' : clean(r.segundo_apellido),
          apellidos: esVacante ? 'VACANTE' : (apellidosJuntos || clean(r.primer_apellido)),
          nombres: esVacante ? 'PLAZA VACANTE' : clean(r.nombres),
          expedida: esVacante ? null : clean(r.expedida),
          departamentoExpedicion: esVacante ? null : clean(r.departamento_expedicion),
          municipioExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
          ciudadExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
          tipoDiscapacidad: esVacante ? null : (r.tipo_discapacidad || parseSituacionYDiscapacidad(r.situacion).tipoDiscapacidad),
          tipoSangre: esVacante ? null : clean(r.tipo_sangre),
          fechaNacimiento: esVacante ? null : r.fecha_nacimiento,
          edadCalculada: esVacante ? null : (edadCalc ? edadCalc.texto : 'No disponible'),
          edadAnios: esVacante ? null : (edadCalc ? edadCalc.anios : null),
          dependencia: clean(r.dependencia),
          secretaria: (() => {
            const depUpper = (clean(r.dependencia) || '').toUpperCase().trim();
            if (depUpper.includes('SECRETARÍA') || depUpper.includes('SECRETARIA')) return depUpper;
            if (depUpper.includes('TALENTO HUMANO') || depUpper.includes('SISTEMAS') || depUpper.includes('SERVICIOS GENERALES')) return 'SECRETARÍA GENERAL';
            if (depUpper.includes('GOBERNADOR') || depUpper.includes('DESPACHO')) return 'DESPACHO DEL GOBERNADOR';
            if (depUpper.includes('JURÍDICA') || depUpper.includes('JURIDICA')) return 'OFICINA ASESORA JURÍDICA';
            return depUpper || 'SECRETARÍA GENERAL';
          })(),
          cargoActual: clean(r.cargo_actual),
          cargo_actual: clean(r.cargo_actual),
          cargo: clean(r.cargo_actual || r.cargo_base),
          codigoActual: clean(r.codigo_actual),
          codigo_actual: clean(r.codigo_actual),
          codigo: clean(r.codigo_actual || r.codigo_base),
          gradoActual: clean(r.grado_actual),
          grado_actual: clean(r.grado_actual),
          grado: clean(r.grado_actual || r.grado_base) || 'N/A',
          nivelActual: inferirNivelCargo(r.cargo_actual, r.codigo_actual, r.nivel_actual),
          nivel: inferirNivelCargo(r.cargo_actual, r.codigo_actual, r.nivel_actual),
          cargoBase: clean(r.cargo_base),
          codigoBase: clean(r.codigo_base),
          gradoBase: clean(r.grado_base),
          nivelBase: inferirNivelCargo(r.cargo_base, r.codigo_base, r.nivel_base),
          correo: esVacante ? null : r.correo,
          correoPersonal: esVacante ? null : r.correo_personal,
          celular: esVacante ? null : (celularesArr[0] || r.celular),
          celulares: esVacante ? [] : celularesArr,
          telefonoFijo: esVacante ? null : r.telefono_fijo,
          telefono: esVacante ? null : (celularesArr[0] || r.celular || r.telefono_fijo || 'N/A'),
          direccion: esVacante ? null : clean(r.direccion),
          ciudad: esVacante ? null : clean(r.ciudad),
          estudios: esVacante ? null : clean(r.estudios),
          matriculaProfesional: esVacante ? null : clean(r.matricula_profesional),
          institucionEstudios: esVacante ? null : clean(r.institucion_estudios),
          postgrado: esVacante ? null : clean(r.postgrado),
          institucionPostgrado: esVacante ? null : clean(r.institucion_postgrado),
          diplomadoCapSena: esVacante ? null : clean(r.diplomado_cap_sena),
          tieneDiplomado: esVacante ? false : Boolean(r.tiene_diplomado),
          situacion: esVacante ? 'VACANTE' : (parseSituacionYDiscapacidad(r.situacion).situacion || 'ACTIVO'),
          clasificacionEmpleo: esVacante
            ? (r.clasificacion_empleo ? normalizarClasificacionEmpleo(r.clasificacion_empleo) : 'Vacante Definitiva')
            : normalizarClasificacionEmpleo(r.clasificacion_empleo),
          estadoServidor: esVacante ? 'Activo' : (r.estado_servidor || 'Activo'),
          funciones: r.funciones || null,
          opec: esVacante ? null : r.opec,
          novedades: esVacante ? 'PLAZA VACANTE' : r.novedades,
          fechaIngreso: esVacante ? null : r.fecha_ingreso,
          fechaRetiro: esVacante ? null : (r.fecha_retiro || null),
          esRetirado: esRetirado,
          fechaEncargo: esVacante ? null : r.fecha_encargo,
          tiempoServicioCalculado: esVacante ? null : (tiempoCalc ? tiempoCalc.texto : 'No disponible'),
          otroTiempoGobernacion: esVacante ? null : r.otro_tiempo_gobernacion,
          otroTiempoCalculado: esVacante ? null : (otroTiempoCalc && otroTiempoCalc.tieneValor ? otroTiempoCalc.texto : '0 años, 0 meses, 0 días'),
          otroTiempoPeriodos: esVacante ? [] : (Array.isArray(r.otros_tiempos_periodos) ? r.otros_tiempos_periodos : []),
          tiempoTotalGobernacion: esVacante ? null : (tiempoTotalCalc ? tiempoTotalCalc.texto : (tiempoCalc ? tiempoCalc.texto : 'No disponible')),
          encargoDenominacion: clean(r.encargo_denominacion),
          encargoCodigo: clean(r.encargo_codigo),
          encargoGrado: clean(r.encargo_grado),
          encargoAsignacion: clean(r.encargo_asignacion),
          cargoTitular: clean(r.cargo_base || r.cargo_actual),
          codigoTitular: clean(r.codigo_base || r.codigo_actual),
          gradoTitular: clean(r.grado_base || r.grado_actual),
          sexo: esVacante ? null : r.sexo,
          documento_pendiente: esVacante ? false : Boolean(r.documento_pendiente),
          es_vacante: esVacante,
          numeroVacante,
          codigoVacante,
        };
      }),
      total, page: parseInt(page), limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('[employees] list error:', err.message);
    res.status(500).json({ error: 'Error al listar servidores públicos.', details: err.message });
  }
});

// ─── GET /api/employees/catalogs ─────────────────────────────────────────────
router.get('/catalogs', auth, async (_, res) => {
  try {
    const [depsRes, cargosRes, cargosPorDepRes, divipolaRes, estudiosRes, instRes, discRes] = await Promise.all([
      pool.query('SELECT DISTINCT dependencia FROM dependencias WHERE dependencia IS NOT NULL AND dependencia <> \'\' ORDER BY dependencia'),
      pool.query(`SELECT DISTINCT cargo, codigo, grado, asignacion_sueldo, nivel FROM cargos WHERE cargo IS NOT NULL AND cargo <> '' AND cargo !~ '^[0-9]' AND cargo NOT IN ('NO REGISTRADO', 'XXXXX', 'CARGO POR DEFINIR') ORDER BY cargo`),
      pool.query(`
        SELECT DISTINCT d.dependencia, c.cargo, c.codigo, c.grado, c.asignacion_sueldo, c.nivel
        FROM rel_principal r
        JOIN dependencias d ON d.id_dependencia = r.id_dependencia
        JOIN cargos c ON (c.id_cargo = r.id_cargo_actual OR c.id_cargo = r.id_cargo_base)
        WHERE d.dependencia IS NOT NULL AND c.cargo IS NOT NULL
        ORDER BY d.dependencia, c.cargo
      `),
      pool.query('SELECT departamento, municipio FROM divipola ORDER BY departamento, municipio'),
      pool.query('SELECT DISTINCT estudios FROM educacion WHERE estudios IS NOT NULL AND TRIM(estudios) <> \'\' ORDER BY estudios'),
      pool.query('SELECT DISTINCT institucion_estudios FROM educacion WHERE institucion_estudios IS NOT NULL AND TRIM(institucion_estudios) <> \'\' ORDER BY institucion_estudios'),
      pool.query('SELECT DISTINCT tipo_discapacidad FROM personas WHERE tipo_discapacidad IS NOT NULL AND TRIM(tipo_discapacidad) <> \'\' ORDER BY tipo_discapacidad')
    ]);

    // Dependencias únicas institucionales (sin duplicados, sin registros espurios y ordenadas naturalmente)
    const normalizedMap = new Map();
    for (const r of depsRes.rows) {
      const dep = clean(r.dependencia)?.toUpperCase();
      if (!dep || ['HOLAAAAAAAA', 'NO REGISTRADO', 'HOJA2', 'NINGUNA'].includes(dep)) continue;
      
      // Clave normalizada eliminando prefijos numéricos ("1. ", "10. ", etc.)
      const normKey = dep.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
      if (!normKey) continue;

      if (!normalizedMap.has(normKey)) {
        normalizedMap.set(normKey, dep);
      }
    }
    const dependenciasList = Array.from(normalizedMap.values());
    dependenciasList.sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

    // Mapeo dinámico: Dependencia -> Lista de Cargos (deduplicados por cargo)
    const cargosPorDependencia = {};
    for (const row of cargosPorDepRes.rows) {
      const dep = clean(row.dependencia)?.toUpperCase();
      if (!dep) continue;
      if (!cargosPorDependencia[dep]) cargosPorDependencia[dep] = [];
      const cargoName = clean(row.cargo);
      if (cargoName && !cargosPorDependencia[dep].some(c => c.cargo.toUpperCase() === cargoName.toUpperCase())) {
        cargosPorDependencia[dep].push({
          cargo: cargoName.toUpperCase(),
          codigo: clean(row.codigo),
          grado: clean(row.grado),
          asignacion: row.asignacion_sueldo,
          nivel: inferirNivelCargo(row.cargo, row.codigo, row.nivel)
        });
      }
    }

    // Cargos generales deduplicados por nombre
    const cargosList = [];
    const cargosSet = new Set();
    for (const r of cargosRes.rows) {
      const cName = clean(r.cargo)?.toUpperCase();
      if (cName && !cargosSet.has(cName) && !cName.match(/^[0-9]/) && !['NO REGISTRADO', 'XXXXX', 'CARGO POR DEFINIR'].includes(cName)) {
        cargosSet.add(cName);
        cargosList.push({
          cargo: cName,
          codigo: clean(r.codigo),
          grado: clean(r.grado),
          asignacion: r.asignacion_sueldo,
          nivel: inferirNivelCargo(r.cargo, r.codigo, r.nivel)
        });
      }
    }
    cargosList.sort((a, b) => a.cargo.localeCompare(b.cargo, 'es'));

    // Estudios e Instituciones existentes deduplicados
    const estudiosSet = new Set();
    for (const r of (estudiosRes.rows || [])) {
      const est = clean(r.estudios)?.toUpperCase();
      if (est && est !== 'NO REGISTRADO' && est !== 'NINGUNO') estudiosSet.add(est);
    }
    const estudiosList = Array.from(estudiosSet).sort((a, b) => a.localeCompare(b, 'es'));

    const instSet = new Set();
    for (const r of (instRes.rows || [])) {
      const inst = clean(r.institucion_estudios)?.toUpperCase();
      if (inst && inst !== 'NO REGISTRADO' && inst !== 'NINGUNA') instSet.add(inst);
    }
    const instList = Array.from(instSet).sort((a, b) => a.localeCompare(b, 'es'));

    // DIVIPOLA: Departamentos y Municipios dependientes
    const departamentosSet = new Set();
    const municipiosPorDepto = {};
    for (const row of divipolaRes.rows) {
      const depto = clean(row.departamento);
      const mpio = clean(row.municipio);
      departamentosSet.add(depto);
      if (!municipiosPorDepto[depto]) municipiosPorDepto[depto] = [];
      municipiosPorDepto[depto].push(mpio);
    }

    // Ordenar municipios: para Boyacá, TUNJA aparece siempre en la primera posición
    for (const depto of Object.keys(municipiosPorDepto)) {
      municipiosPorDepto[depto].sort((a, b) => {
        if (depto === 'BOYACÁ' || depto === 'BOYACA') {
          if (a === 'TUNJA') return -1;
          if (b === 'TUNJA') return 1;
        }
        return a.localeCompare(b, 'es');
      });
    }

    // Discapacidades canónicas y existentes en BD (todas en MAYÚSCULAS)
    const discSet = new Set((DISCAPACIDADES_VALIDAS || []).map(d => d.toUpperCase()));
    for (const r of (discRes?.rows || [])) {
      let disc = clean(r.tipo_discapacidad)?.toUpperCase();
      if (!disc) continue;
      if (disc === 'MOTORA' || disc === 'FISICA' || disc === 'FÍSICA') disc = 'FÍSICA / MOTRIZ';
      else if (disc === 'COGNITIVA' || disc === 'INTELECTUAL') disc = 'INTELECTUAL / COGNITIVA';
      else if (disc === 'MENTAL' || disc === 'PSICOSOCIAL') disc = 'PSICOSOCIAL / MENTAL';
      else if (disc === 'SORDOCIEGUERA') disc = 'SORDOCIEGA';

      if (!['NINGUNA', 'NINGUNO', 'NO REGISTRA', 'SIN ESPECIFICAR', 'NULL', 'UNDEFINED', 'N/A', 'OTRA'].includes(disc)) {
        discSet.add(disc);
      }
    }
    const discapacidadesList = Array.from(discSet).sort((a, b) => a.localeCompare(b, 'es'));

    res.json({
      dependencias: dependenciasList,
      departamentos: dependenciasList,
      cargos: cargosList,
      cargosPorDependencia,
      estudios: estudiosList,
      institucionesEstudios: instList,
      divipola: {
        departamentos: Array.from(departamentosSet).sort((a, b) => {
          if (a === 'BOYACÁ') return -1;
          if (b === 'BOYACÁ') return 1;
          return a.localeCompare(b, 'es');
        }),
        municipiosPorDepto
      },
      grados: GRADOS_VALIDOS,
      clasificaciones: CLASIFICACIONES_EMPLEO,
      estadosServidor: ESTADOS_SERVIDOR,
      sexos: SEXOS_VALIDOS,
      discapacidades: discapacidadesList,
      tiposSangre: TIPOS_SANGRE_VALIDOS,
      diplomados: DIPLOMADOS_OPCIONES
    });
  } catch (err) {
    console.error('[employees] catalogs error:', err);
    res.status(500).json({ error: 'Error al cargar catálogos.' });
  }
});

// ─── GET /api/employees/municipios & /divipola (AUD-005 / AUD-006) ───────────
router.get(['/municipios', '/divipola'], auth, async (req, res) => {
  try {
    const { q = '', depto = '15' } = req.query;
    const cleanQ = (q || '').trim();
    const cleanDepto = (depto || '').trim();

    let sql = `
      SELECT codigo_mpio AS codigo, municipio, departamento
      FROM divipola
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (cleanDepto && cleanDepto !== 'todos') {
      sql += ` AND (codigo_depto = $${idx} OR TRANSLATE(LOWER(departamento), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') = TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn'))`;
      params.push(cleanDepto);
      idx++;
    }

    if (cleanQ) {
      sql += ` AND (
        codigo_mpio LIKE $${idx}
        OR TRANSLATE(LOWER(municipio), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
      )`;
      params.push(`%${cleanQ}%`);
      idx++;
    }

    sql += ` ORDER BY CASE WHEN UPPER(municipio) = 'TUNJA' THEN 0 ELSE 1 END, municipio ASC LIMIT 250`;
    const r = await pool.query(sql, params);
    res.json({
      total: r.rowCount,
      departamento: cleanDepto || 'BOYACÁ',
      municipios: r.rows
    });
  } catch (err) {
    console.error('[employees] municipios error:', err);
    res.status(500).json({ error: 'Error al consultar municipios.' });
  }
});

// ─── POST /api/employees/dependencias (Registro Directo de Nueva Dependencia) ─
router.post('/dependencias', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  try {
    const { nombre } = req.body;
    const cleanName = clean(nombre)?.toUpperCase();
    if (!cleanName || ['NO REGISTRADO', 'HOLAAAAAAAA', 'HOJA2', 'NINGUNA'].includes(cleanName)) {
      return res.status(400).json({ error: 'Nombre de dependencia inválido.' });
    }
    const existing = await pool.query('SELECT id_dependencia, dependencia FROM dependencias WHERE LOWER(TRIM(dependencia)) = LOWER($1) LIMIT 1', [cleanName]);
    if (existing.rows.length > 0) {
      return res.json({ message: 'La dependencia ya existe', dependencia: existing.rows[0].dependencia, id_dependencia: existing.rows[0].id_dependencia });
    }
    const maxRes = await pool.query("SELECT COALESCE(MAX(SUBSTRING(id_dependencia FROM '[0-9]+')::int), 0) AS max_id FROM dependencias WHERE id_dependencia ~ '^DEP[0-9]+'");
    const nextNum = (maxRes.rows[0]?.max_id || 0) + 1;
    const newId = `DEP${String(nextNum).padStart(3, '0')}`;
    await pool.query('INSERT INTO dependencias(id_dependencia, dependencia) VALUES ($1, $2)', [newId, cleanName]);
    res.status(201).json({ message: 'Dependencia creada exitosamente', id_dependencia: newId, dependencia: cleanName });
  } catch (err) {
    console.error('[employees] create dependencia error:', err.message);
    res.status(500).json({ error: 'Error al registrar dependencia.' });
  }
});

// ─── POST /api/employees (Crear Servidor con 22 Reglas Estrictas) ─────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });

  const b = req.body || {};
  const nombreCompleto = b.nombreCompleto || b.nombre_completo || (b.nombres && b.apellidos ? `${b.nombres} ${b.apellidos}` : (b.nombres || b.apellidos || b.nombre));
  const cedula = b.cedula || b.numero_documento || b.documento;
  const departamentoExpedicion = b.departamentoExpedicion || b.departamento_expedicion;
  const municipioExpedicion = b.municipioExpedicion || b.municipio_expedicion || b.municipio;
  const ciudadExpedicion = b.ciudadExpedicion || b.ciudad_expedicion;
  const sexo = b.sexo;
  const tipoSangre = b.tipoSangre || b.tipo_sangre;
  const fechaNacimiento = b.fechaNacimiento || b.fecha_nacimiento;
  const dependencia = b.dependencia || b.secretaria;
  const cargoActual = b.cargoActual || b.denominacion_cargo || b.cargo || b.cargo_actual;
  const codigoCargo = b.codigoCargo || b.codigo_cargo || b.codigo;
  const grado = b.grado || b.grado_cargo;
  const asignacion = b.asignacion || b.asignacion_basica || b.sueldo;
  const clasificacionEmpleo = b.clasificacionEmpleo || b.clasificacion_empleo || b.tipo_vinculacion;
  const estadoServidor = b.estadoServidor || b.estado_servidor || b.estado;
  const situacion = b.situacion || b.situacion_administrativa;
  const tipoDiscapacidad = b.tipoDiscapacidad || b.tipo_discapacidad;
  const opec = b.opec;
  const fechaIngreso = b.fechaIngreso || b.fecha_ingreso || b.fecha_posesion;
  const fechaEncargo = b.fechaEncargo || b.fecha_encargo;
  const encargoDenominacion = b.encargoDenominacion || b.encargo_denominacion;
  const encargoCodigo = b.encargoCodigo || b.encargo_codigo;
  const encargoGrado = b.encargoGrado || b.encargo_grado;
  const encargoAsignacion = b.encargoAsignacion || b.encargo_asignacion;
  const otroTiempoGobernacion = b.otroTiempoGobernacion || b.otro_tiempo_gobernacion;
  const otroTiempoPeriodos = b.otroTiempoPeriodos || b.otro_tiempo_periodos;
  const funciones = b.funciones;
  const novedades = b.novedades;
  const estudios = b.estudios || b.nivel_educativo || b.titulo;
  const matriculaProfesional = b.matriculaProfesional || b.matricula_profesional;
  const institucionEstudios = b.institucionEstudios || b.institucion_estudios;
  const postgrado = b.postgrado;
  const institucionPostgrado = b.institucionPostgrado || b.institucion_postgrado;
  const tieneDiplomado = b.tieneDiplomado ?? b.tiene_diplomado;
  const diplomadoCapSena = b.diplomadoCapSena || b.diplomado_cap_sena;
  const direccion = b.direccion;
  const ciudad = b.ciudad;
  const telefonoFijo = b.telefonoFijo || b.telefono_fijo || b.telefono;
  const celular = b.celular || b.telefono_movil;
  const celulares = b.celulares;
  const correo = b.correo || b.email || b.correo_institucional;
  const correoPersonal = b.correoPersonal || b.correo_personal;

  // 1. Validar Nombres y Apellidos (Regla 7: solo letras y espacios)
  const nombreValidado = validateAndSplitNombre(nombreCompleto);
  if (!nombreValidado.valido) return res.status(400).json({ error: nombreValidado.error });

  // 2. Validar Cédula (Obligatoria: solo números)
  const cedulaValidada = validateCedulaInput(cedula, true);
  if (!cedulaValidada.valido) return res.status(400).json({ error: cedulaValidada.error });

  // 3. Validar Código de Cargo (Regla 2: opcional, si tiene valor solo números y <= 1000)
  const codigoValidado = validateCodigoCargo(codigoCargo, true);
  if (!codigoValidado.valido) return res.status(400).json({ error: codigoValidado.error });

  // 4. Validar Grado (Regla 3: opcional, si tiene valor 01 a 20, N/a, NE)
  const gradoValidado = validateGrado(grado);
  if (!gradoValidado.valido) return res.status(400).json({ error: gradoValidado.error });

  // 5. Validar Estado del Servidor (Deducido de Situación Administrativa si aplica)
  let estadoParaValidar = estadoServidor;
  const sitUpperPost = String(situacion || '').toUpperCase().trim();
  if (sitUpperPost === 'RETIRADO' || sitUpperPost === 'INACTIVO') {
    estadoParaValidar = 'Retirado';
  } else if (sitUpperPost.includes('PENSION') && !sitUpperPost.includes('PREPENSION')) {
    estadoParaValidar = 'Pensionado';
  } else if (!estadoParaValidar) {
    estadoParaValidar = 'Activo';
  }
  const estadoServidorValidado = validateEstadoServidor(estadoParaValidar);
  if (!estadoServidorValidado.valido) return res.status(400).json({ error: estadoServidorValidado.error });

  // 6. Validar Sexo (Opcional: si se ingresa valida Femenino, Masculino, Prefiero no decirlo)
  const sexoValidado = validateSexo(sexo);
  if (!sexoValidado.valido) return res.status(400).json({ error: sexoValidado.error });

  // 7. Validar Tipo de Sangre (Opcional: si se ingresa valida A+, A-, B+, B-, AB+, AB-, O+, O-)
  const tipoSangreValidado = validateTipoSangre(tipoSangre);
  if (!tipoSangreValidado.valido) return res.status(400).json({ error: tipoSangreValidado.error });

  // 8. Validar Otro Tiempo con la Gobernación (Experiencia Múltiple con fechas y cálculo acumulado)
  const expValidada = validateOtroTiempoPeriodos(otroTiempoPeriodos !== undefined ? otroTiempoPeriodos : otroTiempoGobernacion);
  if (!expValidada.valido) return res.status(400).json({ error: expValidada.error });

  // 9. Validar Situación y Discapacidad (Regla 12)
  const situacionValidada = validateSituacionDiscapacidad(situacion, tipoDiscapacidad);
  if (!situacionValidada.valido) return res.status(400).json({ error: situacionValidada.error });

  // 10. Validar Funciones (Regla 16: números 00-999 o texto)
  const funcionesValidadas = validateFunciones(funciones);
  if (!funcionesValidadas.valido) return res.status(400).json({ error: funcionesValidadas.error });

  // 11. Validar Matrícula Profesional (Regla 18: únicamente números)
  const matriculaValidada = validateMatricula(matriculaProfesional);
  if (!matriculaValidada.valido) return res.status(400).json({ error: matriculaValidada.error });

  // 12. Validar Teléfono Fijo (Regla 20: 6 a 12 dígitos)
  const telFijoValidado = validateTelefonoFijo(telefonoFijo);
  if (!telFijoValidado.valido) return res.status(400).json({ error: telFijoValidado.error });

  // 13. Validar Celulares (Regla 21: hasta 3 números independientes, 9 a 10 dígitos)
  const celularesValidados = validateCelulares(celulares || celular);
  if (!celularesValidados.valido) return res.status(400).json({ error: celularesValidados.error });

  // 14. Validar Correos (Regla 22: validación con @)
  const correoInstValidado = validateEmail(correo, 'Correo Institucional');
  if (!correoInstValidado.valido) return res.status(400).json({ error: correoInstValidado.error });

  const correoPersValidado = validateEmail(correoPersonal, 'Correo Personal');
  if (!correoPersValidado.valido) return res.status(400).json({ error: correoPersValidado.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Manejo de Cédula (o generación estricta de ID temporal PROV-00001, PROV-00002...)
    let finalCedula = cedulaValidada.valor;
    let documentoPendiente = false;

    if (cedulaValidada.esVacia || !finalCedula) {
      // Regla 9: ID temporal secuencial exacto en backend Node.js
      finalCedula = await generarIdTemporalSecuencial(client);
      documentoPendiente = true;
    } else {
      // Verificar duplicidad si viene con cédula real
      const dup = await client.query('SELECT 1 FROM personas WHERE cedula = $1 LIMIT 1', [finalCedula]);
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Ya existe un servidor registrado con la cédula ${finalCedula}.` });
      }
    }

    const nextId = async (table, col, prefix, width) => {
      const seqMap = {
        personas: 'seq_personas_id',
        contactos: 'seq_contactos_id',
        educacion: 'seq_educacion_id',
        estados: 'seq_estados_id',
        rel_principal: 'seq_rel_principal_id',
        dependencias: 'seq_dependencias_id',
        cargos: 'seq_cargos_id'
      };
      const seqName = seqMap[table] || `seq_${table}_id`;
      let candId;
      try {
        const r = await client.query('SELECT next_formatted_id($1, $2, $3) AS id', [seqName, prefix, width]);
        candId = r.rows[0].id;
      } catch (_) {
        const maxRes = await client.query(`SELECT COALESCE(MAX(SUBSTRING(${col} FROM ${prefix.length + 1})::integer), 0) + 1 AS next_val FROM ${table}`);
        const nextVal = maxRes.rows[0]?.next_val || 1;
        candId = prefix + String(nextVal).padStart(width, '0');
      }

      // Auto-reparación preventiva si la secuencia está desfasada respecto a la tabla
      const checkExists = await client.query(`SELECT 1 FROM ${table} WHERE ${col} = $1 LIMIT 1`, [candId]);
      if (checkExists.rows.length > 0) {
        try {
          await client.query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX(SUBSTRING(${col} FROM ${prefix.length + 1})::integer), 0) FROM ${table}), 1))`, [seqName]);
          const r = await client.query('SELECT next_formatted_id($1, $2, $3) AS id', [seqName, prefix, width]);
          candId = r.rows[0].id;
        } catch (_) {
          const maxRes = await client.query(`SELECT COALESCE(MAX(SUBSTRING(${col} FROM ${prefix.length + 1})::integer), 0) + 1 AS next_val FROM ${table}`);
          const nextVal = maxRes.rows[0]?.next_val || 1;
          candId = prefix + String(nextVal).padStart(width, '0');
        }
      }
      return candId;
    };

    const findOrCreate = async (table, idCol, nameCol, prefix, width, name, insertFn) => {
      const cleanName = clean(name) || 'NO REGISTRADO';
      let existing = await client.query(`SELECT ${idCol} FROM ${table} WHERE LOWER(${nameCol}) = LOWER($1) LIMIT 1`, [cleanName]);
      if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];

      // Fallback para dependencias: buscar sin prefijo numérico "1. ", "3. ", etc.
      if (table === 'dependencias') {
        const unnumbered = cleanName.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
        if (unnumbered) {
          existing = await client.query(
            `SELECT ${idCol} FROM ${table} WHERE REGEXP_REPLACE(LOWER(${nameCol}), '^[0-9]+(\\.[0-9]+)*\\.?\\s*', '') = LOWER($1) LIMIT 1`,
            [unnumbered]
          );
          if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];
        }
      }

      const id = await nextId(table, idCol, prefix, width);
      await insertFn(id, cleanName);
      return id;
    };

    const personId = await nextId('personas', 'id_persona', 'PER', 4);
    const contactId = await nextId('contactos', 'id_contacto', 'CON', 4);
    const educationId = await nextId('educacion', 'id_educacion', 'EDU', 4);
    const statusId = await nextId('estados', 'id_estado', 'EST', 4);
    const recordId = await nextId('rel_principal', 'id_registro', 'REL', 4);

    const cleanDep = clean(dependencia)?.toUpperCase() || 'NO REGISTRADO';
    const deptId = await findOrCreate('dependencias', 'id_dependencia', 'dependencia', 'DEP', 3, cleanDep, async (id, name) =>
      client.query('INSERT INTO dependencias(id_dependencia, dependencia) VALUES ($1,$2)', [id, name]));

    const cleanCargo = clean(cargoActual)?.toUpperCase() || 'NO REGISTRADO';
    const cargoId = await findOrCreate('cargos', 'id_cargo', 'cargo', 'CAR', 3, cleanCargo, async (id, name) =>
      client.query(
        "INSERT INTO cargos(id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES ($1,'PLANTA',$2,$3,$4,$5,$6)",
        [id, name, codigoValidado.valor, gradoValidado.valor, asignacion || '$0', inferirNivelCargo(name, codigoValidado.valor)]
      ));

    // Inserción en personas
    const mpioExp = clean(municipioExpedicion || ciudadExpedicion)?.toUpperCase() || null;
    const deptoExp = clean(departamentoExpedicion)?.toUpperCase() || null;
    const expedidaLugar = (mpioExp && deptoExp) ? `${mpioExp}, ${deptoExp}` : (mpioExp || deptoExp || null);
    await client.query(
      `INSERT INTO personas (
         id_persona, cedula, primer_apellido, segundo_apellido, nombres, nombre_completo,
         expedida, departamento_expedicion, ciudad_expedicion, municipio_expedicion, tipo_discapacidad,
         tipo_sangre, fecha_nacimiento, edad, sexo, documento_pendiente, es_vacante
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false)`,
      [
        personId,
        finalCedula,
        nombreValidado.primerApellido,
        nombreValidado.segundoApellido,
        nombreValidado.nombres,
        nombreValidado.nombreCompleto,
        expedidaLugar,
        deptoExp,
        mpioExp,
        mpioExp,
        situacionValidada.tipoDiscapacidad,
        tipoSangreValidado.valor,
        fechaNacimiento || null,
        fechaNacimiento ? calcularDiferenciaFechasExacta(parseExcelDate(fechaNacimiento)).texto : null,
        sexoValidado.valor ? clean(sexoValidado.valor).toUpperCase() : null,
        documentoPendiente
      ]
    );

    // Inserción en contactos
    const primaryCelular = celularesValidados.celulares[0] || 'NO REGISTRADO';
    await client.query(
      `INSERT INTO contactos (
         id_contacto, direccion, ciudad, telefono_fijo, celular, celulares,
         correo_personal, correo_institucional
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        contactId,
        clean(direccion)?.toUpperCase() || 'NO REGISTRADO',
        clean(ciudad)?.toUpperCase() || null,
        telFijoValidado.valor || null,
        primaryCelular,
        celularesValidados.celulares,
        correoPersValidado.valor,
        correoInstValidado.valor
      ]
    );

    // Inserción en educacion
    const tieneDip = Boolean(tieneDiplomado || (diplomadoCapSena && diplomadoCapSena.trim() !== ''));
    await client.query(
      `INSERT INTO educacion (
         id_educacion, estudios, matricula_profesional, institucion_estudios,
         postgrado, institucion_postgrado, diplomado_cap_sena, tiene_diplomado,
         correo_institucional
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        educationId,
        clean(estudios)?.toUpperCase() || 'NO REGISTRADO',
        matriculaValidada.valor,
        clean(institucionEstudios)?.toUpperCase() || 'NO REGISTRADO',
        clean(postgrado)?.toUpperCase() || null,
        clean(institucionPostgrado)?.toUpperCase() || null,
        clean(diplomadoCapSena)?.toUpperCase() || null,
        tieneDip,
        correoInstValidado.valor
      ]
    );

    // Inserción en estados
    await client.query(
      `INSERT INTO estados (
         id_estado, clasificacion_empleo, situacion, funciones_pagadas, novedades,
         opec, estado_servidor, funciones
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        statusId,
        normalizarClasificacionEmpleo(clasificacionEmpleo),
        situacionValidada.situacion,
        funcionesValidadas.valor ? clean(funcionesValidadas.valor).toUpperCase() : null,
        clean(novedades)?.toUpperCase() || '',
        opec || null,
        estadoServidorValidado.valor ? clean(estadoServidorValidado.valor).toUpperCase() : 'ACTIVO',
        funcionesValidadas.valor ? clean(funcionesValidadas.valor).toUpperCase() : null
      ]
    );

    // Cálculo de tiempo de servicio y tiempo total en gobernación
    // Si no se le ingresa fecha de ingreso, al guardar guarda la fecha del día del registro (hoy)
    const hoyColombia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const finalFechaIngreso = clean(fechaIngreso) || hoyColombia;
    const dateIngPost = parseExcelDate(finalFechaIngreso);
    const tiempoCalcPost = dateIngPost ? calcularDiferenciaFechasExacta(dateIngPost) : null;
    const tiempoTotalPost = sumarTiemposExactos(
      tiempoCalcPost,
      (expValidada.periodos && expValidada.periodos.length > 0) ? expValidada.periodos : expValidada.acumuladoTexto
    );
    const tiempoTotalGobernacionStr = tiempoTotalPost ? tiempoTotalPost.texto : null;

    // Inserción en rel_principal
    await client.query(
      `INSERT INTO rel_principal (
         id_registro, id_persona, id_cargo_base, id_cargo_actual, id_dependencia,
         id_educacion, id_contacto, id_estado, otro_tiempo_gobernacion, otros_tiempos_periodos,
         tiempo_total_gobernacion, fecha_ingreso, tiempo_servicio, fecha_encargo,
         encargo_denominacion, encargo_codigo, encargo_grado, encargo_asignacion
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        recordId,
        personId,
        cargoId,
        cargoId,
        deptId,
        educationId,
        contactId,
        statusId,
        expValidada.acumuladoTexto || null,
        JSON.stringify(expValidada.periodos),
        tiempoTotalGobernacionStr,
        finalFechaIngreso,
        tiempoCalcPost ? tiempoCalcPost.texto : '0 años, 0 meses, 0 días',
        fechaEncargo || null,
        clean(encargoDenominacion)?.toUpperCase() || null,
        clean(encargoCodigo)?.toUpperCase() || null,
        clean(encargoGrado)?.toUpperCase() || null,
        clean(encargoAsignacion) || null
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Servidor creado exitosamente.',
      id: recordId,
      cedula: finalCedula,
      documento_pendiente: documentoPendiente
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[employees] create error:', err.message);
    res.status(500).json({ error: 'Error al crear el servidor: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/employees/:cedula ───────────────────────────────────────────────
router.get('/:cedula', auth, async (req, res) => {
  if (!canRead(req.user)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de servidores públicos.' });
  }
  const { cedula } = req.params;
  try {
    const sql = `
      WITH vacantes_enum AS (
        SELECT r_sub.id_registro,
               ROW_NUMBER() OVER (ORDER BY r_sub.id_registro) AS numero_vacante
        FROM rel_principal r_sub
        JOIN personas p_sub ON p_sub.id_persona = r_sub.id_persona
        LEFT JOIN estados e_sub ON e_sub.id_estado = r_sub.id_estado
        WHERE p_sub.es_vacante = true OR p_sub.primer_apellido = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
      )
      SELECT r.id_registro,
             ve.numero_vacante,
             CASE
               WHEN ve.numero_vacante IS NOT NULL THEN ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0'))
               ELSE NULL
             END AS codigo_vacante,
             COALESCE(p.cedula,'') AS cedula,
             COALESCE(p.documento_pendiente, (p.cedula LIKE 'PROV-%')) AS documento_pendiente,
             COALESCE(p.es_vacante, (p.primer_apellido = 'VACANTE')) AS es_vacante,
             COALESCE(p.nombre_completo,'') AS nombre_completo,
             COALESCE(p.primer_apellido,'') AS primer_apellido,
             COALESCE(p.segundo_apellido,'') AS segundo_apellido,
             COALESCE(p.nombres,'') AS nombres,
             COALESCE(p.expedida,'') AS expedida,
             COALESCE(p.departamento_expedicion,'') AS departamento_expedicion,
             COALESCE(p.municipio_expedicion, p.ciudad_expedicion,'') AS municipio_expedicion,
             COALESCE(p.ciudad_expedicion, p.municipio_expedicion,'') AS ciudad_expedicion,
             COALESCE(p.tipo_discapacidad,'') AS tipo_discapacidad,
             COALESCE(p.tipo_sangre,'') AS tipo_sangre,
             COALESCE(p.fecha_nacimiento,'') AS fecha_nacimiento,
             COALESCE(p.sexo,'') AS sexo,
             COALESCE(d.dependencia,'') AS dependencia,
             COALESCE(ca.cargo,'') AS cargo_actual,
             COALESCE(ca.codigo,'') AS codigo_actual,
             COALESCE(ca.grado,'') AS grado_actual,
             COALESCE(ca.nivel,'') AS nivel_actual,
             COALESCE(ca.asignacion_sueldo,'') AS asignacion,
             COALESCE(cb.cargo,'') AS cargo_base,
             COALESCE(cb.codigo,'') AS codigo_base,
             COALESCE(cb.grado,'') AS grado_base,
             COALESCE(cb.nivel,'') AS nivel_base,
             COALESCE(con.correo_institucional,'') AS correo,
             COALESCE(con.correo_personal,'') AS correo_personal,
             COALESCE(con.celular,'') AS celular,
             con.celulares AS celulares_arr,
             COALESCE(con.telefono_fijo,'') AS telefono_fijo,
             COALESCE(con.direccion,'') AS direccion,
             COALESCE(con.ciudad,'') AS ciudad,
             COALESCE(edu.estudios,'') AS estudios,
             COALESCE(edu.matricula_profesional,'') AS matricula_profesional,
             COALESCE(edu.institucion_estudios,'') AS institucion_estudios,
             COALESCE(edu.postgrado,'') AS postgrado,
             COALESCE(edu.institucion_postgrado,'') AS institucion_postgrado,
             COALESCE(edu.diplomado_cap_sena,'') AS diplomado_cap_sena,
             COALESCE(edu.tiene_diplomado, false) AS tiene_diplomado,
             COALESCE(e.situacion,'') AS situacion,
             COALESCE(e.clasificacion_empleo,'') AS clasificacion_empleo,
             COALESCE(e.estado_servidor,'Activo') AS estado_servidor,
             COALESCE(e.funciones, e.funciones_pagadas, '') AS funciones,
             COALESCE(e.opec,'') AS opec,
             COALESCE(e.novedades,'') AS novedades,
             COALESCE(r.fecha_ingreso,'') AS fecha_ingreso,
             COALESCE(r.fecha_retiro,'') AS fecha_retiro,
             COALESCE(r.fecha_encargo,'') AS fecha_encargo,
             COALESCE(r.otro_tiempo_gobernacion,'') AS otro_tiempo_gobernacion,
             COALESCE(r.tiempo_total_gobernacion,'') AS tiempo_total_gobernacion,
             COALESCE(r.encargo_denominacion,'') AS encargo_denominacion,
             COALESCE(r.encargo_codigo,'') AS encargo_codigo,
             COALESCE(r.encargo_grado,'') AS encargo_grado,
             COALESCE(r.encargo_asignacion,'') AS encargo_asignacion,
             r.otros_tiempos_periodos
      FROM rel_principal r
      LEFT JOIN vacantes_enum ve ON ve.id_registro = r.id_registro
      JOIN personas p          ON p.id_persona      = r.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia   = r.id_dependencia
      LEFT JOIN cargos ca      ON ca.id_cargo        = r.id_cargo_actual
      LEFT JOIN cargos cb      ON cb.id_cargo        = r.id_cargo_base
      LEFT JOIN contactos con  ON con.id_contacto    = r.id_contacto
      LEFT JOIN educacion edu  ON edu.id_educacion   = r.id_educacion
      LEFT JOIN estados e      ON e.id_estado         = r.id_estado
      WHERE (p.cedula = $1 
             OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $1
             OR ($2 <> '' AND (p.cedula = $2 OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $2))
             OR r.id_registro = $1 
             OR p.id_persona = $1
             OR (ve.numero_vacante IS NOT NULL AND ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0')) ILIKE $1))
      LIMIT 1`;

    const rawCedula = (cedula || '').trim();
    const cleanCedula = rawCedula.replace(/[.,\s]/g, '');
    const digitsOnly = rawCedula.replace(/\D/g, '');
    const normCedula = (cleanCedula !== rawCedula && cleanCedula.length > 0)
      ? cleanCedula
      : (digitsOnly.length >= 3 ? digitsOnly : '');

    const result = await pool.query(sql, [rawCedula, normCedula]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado.' });
    }

    const r = result.rows[0];
    const dateNac = parseExcelDate(r.fecha_nacimiento);
    const dateIng = parseExcelDate(r.fecha_ingreso);
    const esRetirado = (r.estado_servidor || '').toLowerCase() === 'retirado' || (r.situacion || '').toLowerCase() === 'retirado';
    const dateRetiro = esRetirado ? parseExcelDate(r.fecha_retiro) : null;
    const edadCalc = dateNac ? calcularDiferenciaFechasExacta(dateNac) : null;
    const tiempoCalc = dateIng ? calcularDiferenciaFechasExacta(dateIng, dateRetiro || undefined) : null;
    const esVacante = Boolean(r.es_vacante);
    const numeroVacante = r.numero_vacante ? parseInt(r.numero_vacante) : null;
    const codigoVacante = r.codigo_vacante || (numeroVacante ? `PLAZA VACANTE ${String(numeroVacante).padStart(4, '0')}` : (esVacante ? 'PLAZA VACANTE' : null));

    const otroTiempoCalc = esVacante ? null : calcularOtroTiempoNormalizado(
      r.otros_tiempos_periodos,
      r.otro_tiempo_gobernacion,
      dateIng
    );

    const tiempoTotalCalc = esVacante ? null : sumarTiemposExactos(
      tiempoCalc,
      otroTiempoCalc
    );

    const cedulaPura = esVacante ? null : r.cedula;
    const cedulaVisual = cedulaPura ? formatCedulaVisual(cedulaPura) : null;

    let celularesArr = Array.isArray(r.celulares_arr) ? r.celulares_arr.filter(Boolean) : [];
    if (celularesArr.length === 0 && r.celular && r.celular !== 'NO REGISTRADO') {
      celularesArr = r.celular.split(/[\/\,\;]/).map(c => c.trim()).filter(Boolean);
    }

    res.json({
      id: r.id_registro,
      cedula: cedulaPura,
      cedulaVisual,
      nombreCompleto: clean(r.nombre_completo),
      nombre_completo: clean(r.nombre_completo),
      persona: clean(r.nombre_completo),
      primerApellido: esVacante ? 'VACANTE' : clean(r.primer_apellido),
      segundoApellido: esVacante ? '' : clean(r.segundo_apellido),
      nombres: esVacante ? 'PLAZA VACANTE' : clean(r.nombres),
      apellidos: esVacante ? 'VACANTE' : [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' ').trim(),
      expedida: esVacante ? null : clean(r.expedida),
      departamentoExpedicion: esVacante ? null : clean(r.departamento_expedicion),
      municipioExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
      ciudadExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
      tipoDiscapacidad: esVacante ? null : (r.tipo_discapacidad || parseSituacionYDiscapacidad(r.situacion).tipoDiscapacidad),
      tipoSangre: esVacante ? null : clean(r.tipo_sangre),
      fechaNacimiento: esVacante ? null : r.fecha_nacimiento,
      edadCalculada: esVacante ? null : (edadCalc ? edadCalc.texto : 'No disponible'),
      dependencia: clean(r.dependencia),
      cargoActual: clean(r.cargo_actual),
      cargo_actual: clean(r.cargo_actual),
      cargo: clean(r.cargo_actual || r.cargo_base),
      codigoActual: clean(r.codigo_actual),
      codigo_actual: clean(r.codigo_actual),
      codigo: clean(r.codigo_actual || r.codigo_base),
      gradoActual: clean(r.grado_actual),
      grado_actual: clean(r.grado_actual),
      grado: clean(r.grado_actual || r.grado_base),
      nivelActual: inferirNivelCargo(r.cargo_actual, r.codigo_actual, r.nivel_actual),
      nivel: inferirNivelCargo(r.cargo_actual, r.codigo_actual, r.nivel_actual),
      cargoBase: clean(r.cargo_base),
      codigoBase: clean(r.codigo_base),
      gradoBase: clean(r.grado_base),
      nivelBase: inferirNivelCargo(r.cargo_base, r.codigo_base, r.nivel_base),
      asignacion: r.asignacion,
      correo: esVacante ? null : r.correo,
      correoPersonal: esVacante ? null : r.correo_personal,
      celular: esVacante ? null : (celularesArr[0] || r.celular),
      celulares: esVacante ? [] : celularesArr,
      telefonoFijo: esVacante ? null : r.telefono_fijo,
      direccion: esVacante ? null : clean(r.direccion),
      ciudad: esVacante ? null : clean(r.ciudad),
      estudios: esVacante ? null : clean(r.estudios),
      matriculaProfesional: esVacante ? null : clean(r.matricula_profesional),
      institucionEstudios: esVacante ? null : clean(r.institucion_estudios),
      postgrado: esVacante ? null : clean(r.postgrado),
      institucionPostgrado: esVacante ? null : clean(r.institucion_postgrado),
      diplomadoCapSena: esVacante ? null : clean(r.diplomado_cap_sena),
      tieneDiplomado: esVacante ? false : Boolean(r.tiene_diplomado),
      situacion: esVacante ? 'VACANTE' : (parseSituacionYDiscapacidad(r.situacion).situacion || 'ACTIVO'),
      clasificacionEmpleo: esVacante
        ? (r.clasificacion_empleo ? normalizarClasificacionEmpleo(r.clasificacion_empleo) : 'Vacante Definitiva')
        : normalizarClasificacionEmpleo(r.clasificacion_empleo),
      estadoServidor: esVacante ? 'Activo' : (r.estado_servidor || 'Activo'),
      funciones: r.funciones || null,
      opec: esVacante ? null : r.opec,
      novedades: esVacante ? 'PLAZA VACANTE' : r.novedades,
      fechaIngreso: esVacante ? null : r.fecha_ingreso,
      fechaRetiro: esVacante ? null : (r.fecha_retiro || null),
      esRetirado: esRetirado,
      fechaEncargo: esVacante ? null : r.fecha_encargo,
      tiempoServicioCalculado: esVacante ? null : (tiempoCalc ? tiempoCalc.texto : 'No disponible'),
      otroTiempoGobernacion: esVacante ? null : r.otro_tiempo_gobernacion,
      otroTiempoCalculado: esVacante ? null : (otroTiempoCalc && otroTiempoCalc.tieneValor ? otroTiempoCalc.texto : '0 años, 0 meses, 0 días'),
      otroTiempoPeriodos: esVacante ? [] : (Array.isArray(r.otros_tiempos_periodos) ? r.otros_tiempos_periodos : []),
      tiempoTotalGobernacion: esVacante ? null : (tiempoTotalCalc ? tiempoTotalCalc.texto : (tiempoCalc ? tiempoCalc.texto : 'No disponible')),
      encargoDenominacion: clean(r.encargo_denominacion),
      encargoCodigo: clean(r.encargo_codigo),
      encargoGrado: clean(r.encargo_grado),
      encargoAsignacion: clean(r.encargo_asignacion),
      cargoTitular: clean(r.cargo_base || r.cargo_actual),
      codigoTitular: clean(r.codigo_base || r.codigo_actual),
      gradoTitular: clean(r.grado_base || r.grado_actual),
      sexo: esVacante ? null : r.sexo,
      documento_pendiente: esVacante ? false : Boolean(r.documento_pendiente),
      es_vacante: esVacante,
      numeroVacante,
      codigoVacante
    });
  } catch (err) {
    console.error('[employees] get by cedula error:', err.message);
    res.status(500).json({ error: 'Error al consultar el funcionario.' });
  }
});

// ─── PUT /api/employees/:cedula (Actualizar Servidor con 22 Reglas) ───────────
router.put('/:cedula', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { cedula } = req.params;
  const b = req.body || {};
  let nombreCompleto = b.nombreCompleto || b.nombre_completo || (b.nombres && b.apellidos ? `${b.nombres} ${b.apellidos}` : (b.nombres || b.apellidos));
  const nuevaCedula = b.nuevaCedula || b.nueva_cedula;
  const departamentoExpedicion = b.departamentoExpedicion || b.departamento_expedicion;
  const municipioExpedicion = b.municipioExpedicion || b.municipio_expedicion || b.municipio;
  const ciudadExpedicion = b.ciudadExpedicion || b.ciudad_expedicion;
  let sexo = b.sexo;
  let tipoSangre = b.tipoSangre || b.tipo_sangre;
  const fechaNacimiento = b.fechaNacimiento || b.fecha_nacimiento;
  const dependencia = b.dependencia || b.secretaria;
  const cargoActual = b.cargoActual || b.denominacion_cargo || b.cargo || b.cargo_actual;
  const codigoCargo = b.codigoCargo || b.codigo_cargo || b.codigo;
  const grado = b.grado || b.grado_cargo;
  const asignacion = b.asignacion || b.asignacion_basica || b.sueldo;
  const clasificacionEmpleo = b.clasificacionEmpleo || b.clasificacion_empleo || b.tipo_vinculacion;
  const estadoServidor = b.estadoServidor || b.estado_servidor || b.estado;
  const situacion = b.situacion || b.situacion_administrativa;
  const tipoDiscapacidad = b.tipoDiscapacidad || b.tipo_discapacidad;
  const opec = b.opec;
  const fechaIngreso = b.fechaIngreso || b.fecha_ingreso || b.fecha_posesion;
  const fechaEncargo = b.fechaEncargo || b.fecha_encargo;
  const encargoDenominacion = b.encargoDenominacion || b.encargo_denominacion;
  const encargoCodigo = b.encargoCodigo || b.encargo_codigo;
  const encargoGrado = b.encargoGrado || b.encargo_grado;
  const encargoAsignacion = b.encargoAsignacion || b.encargo_asignacion;
  const otroTiempoGobernacion = b.otroTiempoGobernacion || b.otro_tiempo_gobernacion;
  const otroTiempoPeriodos = b.otroTiempoPeriodos || b.otro_tiempo_periodos;
  const funciones = b.funciones;
  const novedades = b.novedades;
  const estudios = b.estudios || b.nivel_educativo || b.titulo;
  const matriculaProfesional = b.matriculaProfesional || b.matricula_profesional;
  const institucionEstudios = b.institucionEstudios || b.institucion_estudios;
  const postgrado = b.postgrado;
  const institucionPostgrado = b.institucionPostgrado || b.institucion_postgrado;
  const tieneDiplomado = b.tieneDiplomado ?? b.tiene_diplomado;
  const diplomadoCapSena = b.diplomadoCapSena || b.diplomado_cap_sena;
  const direccion = b.direccion;
  const ciudad = b.ciudad;
  const telefonoFijo = b.telefonoFijo || b.telefono_fijo || b.telefono;
  const celular = b.celular || b.telefono_movil;
  const celulares = b.celulares;
  const correo = b.correo || b.email || b.correo_institucional;
  const correoPersonal = b.correoPersonal || b.correo_personal;

  if (!nombreCompleto || !sexo) {
    try {
      const existCheck = await pool.query('SELECT nombre_completo, sexo, tipo_sangre FROM personas WHERE cedula = $1 OR id_persona = $1 LIMIT 1', [(cedula || '').trim()]);
      if (existCheck.rows.length > 0) {
        if (!nombreCompleto) nombreCompleto = existCheck.rows[0].nombre_completo;
        if (!sexo) sexo = existCheck.rows[0].sexo;
        if (tipoSangre === undefined) tipoSangre = existCheck.rows[0].tipo_sangre;
      }
    } catch (_) {}
  }

  // Validaciones
  const nombreValidado = validateAndSplitNombre(nombreCompleto);
  if (!nombreValidado.valido) return res.status(400).json({ error: nombreValidado.error });

  const codigoValidado = validateCodigoCargo(codigoCargo, true);
  if (!codigoValidado.valido) return res.status(400).json({ error: codigoValidado.error });

  const gradoValidado = validateGrado(grado);
  if (!gradoValidado.valido) return res.status(400).json({ error: gradoValidado.error });

  let estadoParaValidarPut = estadoServidor;
  const sitUpperPut = String(situacion || '').toUpperCase().trim();
  if (sitUpperPut === 'RETIRADO' || sitUpperPut === 'INACTIVO') {
    estadoParaValidarPut = 'Retirado';
  } else if (sitUpperPut.includes('PENSION') && !sitUpperPut.includes('PREPENSION')) {
    estadoParaValidarPut = 'Pensionado';
  } else if (!estadoParaValidarPut) {
    estadoParaValidarPut = 'Activo';
  }
  const estadoServidorValidado = validateEstadoServidor(estadoParaValidarPut);
  if (!estadoServidorValidado.valido) return res.status(400).json({ error: estadoServidorValidado.error });

  const sexoValidado = validateSexo(sexo);
  if (!sexoValidado.valido) return res.status(400).json({ error: sexoValidado.error });

  let tipoSangreValidado = null;
  if (tipoSangre !== undefined) {
    tipoSangreValidado = validateTipoSangre(tipoSangre);
    if (!tipoSangreValidado.valido) return res.status(400).json({ error: tipoSangreValidado.error });
  }

  let expValidada = null;
  if (otroTiempoPeriodos !== undefined || otroTiempoGobernacion !== undefined) {
    expValidada = validateOtroTiempoPeriodos(otroTiempoPeriodos !== undefined ? otroTiempoPeriodos : otroTiempoGobernacion);
    if (!expValidada.valido) return res.status(400).json({ error: expValidada.error });
  }

  const situacionValidada = validateSituacionDiscapacidad(situacion, tipoDiscapacidad);
  if (!situacionValidada.valido) return res.status(400).json({ error: situacionValidada.error });

  const funcionesValidadas = validateFunciones(funciones);
  if (!funcionesValidadas.valido) return res.status(400).json({ error: funcionesValidadas.error });

  const matriculaValidada = validateMatricula(matriculaProfesional);
  if (!matriculaValidada.valido) return res.status(400).json({ error: matriculaValidada.error });

  const telFijoValidado = validateTelefonoFijo(telefonoFijo);
  if (!telFijoValidado.valido) return res.status(400).json({ error: telFijoValidado.error });

  const celularesValidados = validateCelulares(celulares || celular);
  if (!celularesValidados.valido) return res.status(400).json({ error: celularesValidados.error });

  const correoInstValidado = validateEmail(correo, 'Correo Institucional');
  if (!correoInstValidado.valido) return res.status(400).json({ error: correoInstValidado.error });

  const correoPersValidado = validateEmail(correoPersonal, 'Correo Personal');
  if (!correoPersValidado.valido) return res.status(400).json({ error: correoPersValidado.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rawCedula = (cedula || '').trim();
    const cleanCedula = rawCedula.replace(/[.,\s]/g, '');
    const digitsOnly = rawCedula.replace(/\D/g, '');
    const normCedula = (cleanCedula !== rawCedula && cleanCedula.length > 0)
      ? cleanCedula
      : (digitsOnly.length >= 3 ? digitsOnly : '');

    const r = await client.query(
      `SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado, r.id_cargo_actual 
       FROM rel_principal r 
       JOIN personas p ON p.id_persona=r.id_persona 
       WHERE (p.cedula=$1 
              OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $1
              OR ($2 <> '' AND (p.cedula = $2 OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $2))
              OR r.id_registro=$1 
              OR p.id_persona=$1) 
       LIMIT 1`,
      [rawCedula, normCedula]);
    if (r.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Servidor no encontrado.' }); }
    const { id_registro, id_persona, id_contacto, id_educacion, id_estado, id_cargo_actual } = r.rows[0];

    // Actualizar cédula si se provee una nueva válida
    if (nuevaCedula && nuevaCedula.trim() && nuevaCedula.trim() !== cedula) {
      const cedNuevaVal = validateCedulaInput(nuevaCedula);
      if (!cedNuevaVal.valido) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: cedNuevaVal.error });
      }
      const cleanNueva = cedNuevaVal.valor;
      const dup = await client.query('SELECT 1 FROM personas WHERE cedula = $1 AND id_persona <> $2 LIMIT 1', [cleanNueva, id_persona]);
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `La nueva cédula ${cleanNueva} ya se encuentra registrada en otro servidor.` });
      }
      const esProvisional = cleanNueva.startsWith('PROV-');
      await client.query('UPDATE personas SET cedula = $1, documento_pendiente = $2 WHERE id_persona = $3', [cleanNueva, esProvisional, id_persona]);
    }

    // Actualizar personas
    const mpioExp = clean(municipioExpedicion || ciudadExpedicion)?.toUpperCase() || null;
    const deptoExp = clean(departamentoExpedicion)?.toUpperCase() || null;
    const expedidaLugar = (mpioExp && deptoExp) ? `${mpioExp}, ${deptoExp}` : (mpioExp || deptoExp || null);
    await client.query(
      `UPDATE personas
       SET nombre_completo=$1, primer_apellido=$2, segundo_apellido=$3, nombres=$4,
           sexo=$5, tipo_sangre=$6,
           fecha_nacimiento=$7,
           departamento_expedicion=$8,
           ciudad_expedicion=$9,
           municipio_expedicion=$9,
           tipo_discapacidad=$10,
           expedida=$11
       WHERE id_persona=$12`,
      [
        nombreValidado.nombreCompleto,
        nombreValidado.primerApellido,
        nombreValidado.segundoApellido,
        nombreValidado.nombres,
        sexoValidado.valor ? clean(sexoValidado.valor).toUpperCase() : null,
        tipoSangreValidado ? tipoSangreValidado.valor : null,
        fechaNacimiento || null,
        deptoExp || null,
        mpioExp || null,
        situacionValidada.tipoDiscapacidad,
        expedidaLugar,
        id_persona
      ]
    );

    // Actualizar contactos
    const primaryCelular = celularesValidados.celulares[0] || celular || null;
    await client.query(
      `UPDATE contactos
       SET correo_institucional=$1, correo_personal=$2, celular=$3, celulares=$4,
           telefono_fijo=$5, direccion=$6, ciudad=$7
       WHERE id_contacto=$8`,
      [
        correoInstValidado.valor,
        correoPersValidado.valor,
        primaryCelular,
        celularesValidados.celulares,
        telFijoValidado.valor,
        clean(direccion)?.toUpperCase() || null,
        clean(ciudad)?.toUpperCase() || null,
        id_contacto
      ]
    );

    // Actualizar educacion
    const tieneDip = Boolean(tieneDiplomado || (diplomadoCapSena && diplomadoCapSena.trim() !== ''));
    await client.query(
      `UPDATE educacion
       SET estudios=$1, matricula_profesional=$2,
           institucion_estudios=$3,
           postgrado=$4, institucion_postgrado=$5,
           diplomado_cap_sena=$6, tiene_diplomado=$7,
           correo_institucional=$8
       WHERE id_educacion=$9`,
      [
        clean(estudios)?.toUpperCase() || null,
        matriculaValidada.valor,
        clean(institucionEstudios)?.toUpperCase() || null,
        clean(postgrado)?.toUpperCase() || null,
        clean(institucionPostgrado)?.toUpperCase() || null,
        clean(diplomadoCapSena)?.toUpperCase() || null,
        tieneDip,
        correoInstValidado.valor,
        id_educacion
      ]
    );

    // Actualizar estados
    await client.query(
      `UPDATE estados
       SET clasificacion_empleo=$1,
           situacion=$2, funciones_pagadas=$3, funciones=$3,
           novedades=$4, opec=$5,
           estado_servidor=$6
       WHERE id_estado=$7`,
      [
        normalizarClasificacionEmpleo(clasificacionEmpleo),
        situacionValidada.situacion,
        funcionesValidadas.valor ? clean(funcionesValidadas.valor).toUpperCase() : null,
        clean(novedades)?.toUpperCase() || null,
        opec || null,
        estadoServidorValidado.valor ? clean(estadoServidorValidado.valor).toUpperCase() : 'ACTIVO',
        id_estado
      ]
    );

    // Actualizar o crear cargos
    const nextId = async (table, col, prefix, width) => {
      const seqMap = {
        dependencias: 'seq_dependencias_id',
        cargos: 'seq_cargos_id'
      };
      const seqName = seqMap[table] || `seq_${table}_id`;
      const qr = await client.query('SELECT next_formatted_id($1, $2, $3) AS id', [seqName, prefix, width]);
      return qr.rows[0].id;
    };

    const findOrCreate = async (table, idCol, nameCol, prefix, width, name, insertFn) => {
      const cleanName = clean(name)?.toUpperCase() || 'NO REGISTRADO';
      let existing = await client.query(`SELECT ${idCol} FROM ${table} WHERE UPPER(${nameCol}) = UPPER($1) LIMIT 1`, [cleanName]);
      if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];

      // Fallback para dependencias: buscar sin prefijo numérico
      if (table === 'dependencias') {
        const unnumbered = cleanName.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
        if (unnumbered) {
          existing = await client.query(
            `SELECT ${idCol} FROM ${table} WHERE REGEXP_REPLACE(UPPER(${nameCol}), '^[0-9]+(\\.[0-9]+)*\\.?\\s*', '') = UPPER($1) LIMIT 1`,
            [unnumbered]
          );
          if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];
        }
      }

      const id = await nextId(table, idCol, prefix, width);
      await insertFn(id, cleanName);
      return id;
    };

    let deptId = null;
    if (dependencia) {
      deptId = await findOrCreate('dependencias', 'id_dependencia', 'dependencia', 'DEP', 3, clean(dependencia).toUpperCase(), async (id, name) =>
        client.query('INSERT INTO dependencias(id_dependencia, dependencia) VALUES ($1,$2)', [id, name]));
    }

    let cargoId = null;
    if (cargoActual) {
      cargoId = await findOrCreate('cargos', 'id_cargo', 'cargo', 'CAR', 3, clean(cargoActual).toUpperCase(), async (id, name) =>
        client.query(
          "INSERT INTO cargos(id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES ($1,'PLANTA',$2,$3,$4,$5,$6)",
          [id, name, codigoValidado.valor, gradoValidado.valor, asignacion || '$0', inferirNivelCargo(name, codigoValidado.valor)]
        ));

      // Actualizar el código y grado en el cargo
      await client.query(
        'UPDATE cargos SET codigo = $1, grado = $2 WHERE id_cargo = $3',
        [codigoValidado.valor, gradoValidado.valor, cargoId]
      );
    }

    const updateParts = [];
    const updateVals  = [];
    let idx = 1;

    if (fechaIngreso) {
      updateParts.push(`fecha_ingreso=$${idx++}`);
      updateVals.push(fechaIngreso);
      const tiempoCalc = calcularDiferenciaFechasExacta(parseExcelDate(fechaIngreso));
      updateParts.push(`tiempo_servicio=$${idx++}`);
      updateVals.push(tiempoCalc.texto);
    }
    if (fechaEncargo !== undefined) {
      updateParts.push(`fecha_encargo=$${idx++}`);
      updateVals.push(fechaEncargo || null);
    }
    if (encargoDenominacion !== undefined) {
      updateParts.push(`encargo_denominacion=$${idx++}`);
      updateVals.push(clean(encargoDenominacion)?.toUpperCase() || null);
    }
    if (encargoCodigo !== undefined) {
      updateParts.push(`encargo_codigo=$${idx++}`);
      updateVals.push(clean(encargoCodigo)?.toUpperCase() || null);
    }
    if (encargoGrado !== undefined) {
      updateParts.push(`encargo_grado=$${idx++}`);
      updateVals.push(clean(encargoGrado)?.toUpperCase() || null);
    }
    if (encargoAsignacion !== undefined) {
      updateParts.push(`encargo_asignacion=$${idx++}`);
      updateVals.push(clean(encargoAsignacion) || null);
    }
    if (otroTiempoPeriodos !== undefined || otroTiempoGobernacion !== undefined) {
      updateParts.push(`otro_tiempo_gobernacion=$${idx++}`);
      updateVals.push(expValidada ? (expValidada.acumuladoTexto || null) : null);
      updateParts.push(`otros_tiempos_periodos=$${idx++}`);
      updateVals.push(expValidada ? JSON.stringify(expValidada.periodos) : '[]');
    }

    if (fechaIngreso !== undefined || otroTiempoPeriodos !== undefined || otroTiempoGobernacion !== undefined) {
      const curRelRes = await client.query(
        'SELECT fecha_ingreso, otro_tiempo_gobernacion, otros_tiempos_periodos FROM rel_principal WHERE id_registro = $1',
        [id_registro]
      );
      const curRel = curRelRes.rows[0] || {};
      const effIng = fechaIngreso !== undefined ? fechaIngreso : curRel.fecha_ingreso;
      const effDateIng = parseExcelDate(effIng);
      const effTiempoCalc = effDateIng ? calcularDiferenciaFechasExacta(effDateIng) : null;

      let effOtroTiempo = null;
      if (otroTiempoPeriodos !== undefined || otroTiempoGobernacion !== undefined) {
        effOtroTiempo = (expValidada && expValidada.periodos && expValidada.periodos.length > 0)
          ? expValidada.periodos
          : (expValidada ? expValidada.acumuladoTexto : null);
      } else {
        effOtroTiempo = (Array.isArray(curRel.otros_tiempos_periodos) && curRel.otros_tiempos_periodos.length > 0)
          ? curRel.otros_tiempos_periodos
          : curRel.otro_tiempo_gobernacion;
      }

      const effTotal = sumarTiemposExactos(effTiempoCalc, effOtroTiempo);
      updateParts.push(`tiempo_total_gobernacion=$${idx++}`);
      updateVals.push(effTotal ? effTotal.texto : null);
    }
    if (deptId) {
      updateParts.push(`id_dependencia=$${idx++}`);
      updateVals.push(deptId);
    }
    if (cargoId) {
      updateParts.push(`id_cargo_actual=$${idx++}`, `id_cargo_base=$${idx++}`);
      updateVals.push(cargoId, cargoId);
    }

    if (updateParts.length > 0) {
      updateVals.push(id_registro);
      await client.query(`UPDATE rel_principal SET ${updateParts.join(',')} WHERE id_registro=$${idx}`, updateVals);
    }

    await client.query('COMMIT');
    res.json({ message: 'Servidor actualizado exitosamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[employees] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar el servidor: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/employees/:cedula/status (Gestión de Activo, Retirado y Reactivación) ───
router.patch('/:cedula/status', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { cedula } = req.params;
  const b = req.body || {};
  let estadoServidor = b.estadoServidor || b.estado_servidor || b.estado;
  const fechaRetiro = b.fechaRetiro || b.fecha_retiro;
  const motivoRetiro = b.motivoRetiro || b.motivo_retiro;
  const action = b.action;
  const nuevaFechaIngreso = b.nuevaFechaIngreso || b.nueva_fecha_ingreso;

  if (!estadoServidor) return res.status(400).json({ error: 'estadoServidor es requerido.' });
  if (String(estadoServidor).trim().toLowerCase() === 'inactivo' || String(estadoServidor).trim().toLowerCase() === 'inactiva') {
    estadoServidor = 'Retirado';
  }

  const estadoServidorValidado = validateEstadoServidor(estadoServidor);
  if (!estadoServidorValidado.valido) return res.status(400).json({ error: estadoServidorValidado.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cleanTarget = (cedula || '').trim();
    const numericTarget = cleanTarget.replace(/\D/g, '');

    const r = await client.query(
      `SELECT r.id_registro, r.id_estado, r.id_cargo_actual, r.id_cargo_base,
              r.fecha_ingreso, r.fecha_retiro, r.tiempo_servicio, r.otro_tiempo_gobernacion,
              r.otros_tiempos_periodos, r.tiempo_total_gobernacion,
              e.estado_servidor, e.situacion,
              ca.cargo AS cargo_actual_nombre,
              p.nombre_completo, p.cedula
       FROM rel_principal r 
       LEFT JOIN personas p ON p.id_persona = r.id_persona 
       LEFT JOIN estados e ON e.id_estado = r.id_estado
       LEFT JOIN cargos ca ON ca.id_cargo = r.id_cargo_actual
       WHERE r.id_registro = $1 
          OR r.id_persona = $1 
          OR p.id_persona = $1 
          OR p.cedula = $1 
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $1 
          OR ($2 <> '' AND (p.cedula = $2 OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $2)) 
       LIMIT 1`,
      [cleanTarget, numericTarget]
    );

    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Servidor no encontrado.' });
    }

    const row = r.rows[0];
    const { id_registro, id_estado } = row;
    const nuevoEstado = estadoServidorValidado.valor;
    const estadoAnterior = row.estado_servidor || 'Activo';

    // ─── CASO 1: RETIRO (Activo -> Retirado) ───
    if (nuevoEstado === 'Retirado') {
      const fRetiro = fechaRetiro ? fechaRetiro.trim() : new Date().toISOString().split('T')[0];
      const dateIng = parseExcelDate(row.fecha_ingreso);
      const dateRet = parseExcelDate(fRetiro) || new Date();

      if (dateIng && dateRet < dateIng) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Inconsistencia cronológica: La fecha de retiro (${fRetiro}) no puede ser anterior a la fecha de ingreso actual del servidor (${row.fecha_ingreso}).`
        });
      }

      const tiempoCongelado = dateIng ? calcularDiferenciaFechasExacta(dateIng, dateRet) : { texto: '0 años, 0 meses, 0 días' };

      const otroCalc = calcularOtroTiempoNormalizado(row.otros_tiempos_periodos, row.otro_tiempo_gobernacion, dateIng);
      const totalCongelado = sumarTiemposExactos(tiempoCongelado, otroCalc);

      const textoServicio = (tiempoCongelado && tiempoCongelado.texto) ? tiempoCongelado.texto : '0 años, 0 meses, 0 días';
      const textoTotal = (totalCongelado && totalCongelado.texto) ? totalCongelado.texto : textoServicio;

      await client.query(
        `UPDATE estados SET estado_servidor = 'Retirado', situacion = 'RETIRADO' WHERE id_estado = $1`,
        [id_estado]
      );

      await client.query(
        `UPDATE rel_principal 
         SET fecha_retiro = $1, 
             tiempo_servicio = $2,
             tiempo_total_gobernacion = $3
         WHERE id_registro = $4`,
        [fRetiro, textoServicio, textoTotal, id_registro]
      );

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Servidor ${row.nombre_completo || cedula} marcado como Retirado el ${fRetiro}. Contador de servicio detenido.`,
        estadoServidor: 'Retirado',
        fechaRetiro: fRetiro,
        tiempoServicioCalculado: textoServicio,
        tiempoTotalGobernacion: textoTotal
      });
    }

    // ─── CASO 2: REACTIVACIÓN (Retirado -> Activo) ───
    if (nuevoEstado === 'Activo' && (estadoAnterior === 'Retirado' || action === 'reactivate')) {
      const fNuevaIngreso = nuevaFechaIngreso ? nuevaFechaIngreso.trim() : new Date().toISOString().split('T')[0];
      const fRetiroAnterior = row.fecha_retiro || new Date().toISOString().split('T')[0];

      if (row.fecha_retiro) {
        const dateRetAnt = parseExcelDate(row.fecha_retiro);
        const dateNuevoIng = parseExcelDate(fNuevaIngreso);
        if (dateRetAnt && dateNuevoIng && dateNuevoIng < dateRetAnt) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Inconsistencia cronológica: La nueva fecha de ingreso (${fNuevaIngreso}) no puede ser anterior a la fecha de retiro previa del servidor (${row.fecha_retiro}).`
          });
        }
      }
      const fIngresoAnterior = row.fecha_ingreso || null;

      // 1. Archivar periodo anterior en otros_tiempos_periodos
      let periodosExistentes = Array.isArray(row.otros_tiempos_periodos) ? [...row.otros_tiempos_periodos] : [];
      if (fIngresoAnterior) {
        const dateIngAnt = parseExcelDate(fIngresoAnterior);
        const dateRetAnt = parseExcelDate(fRetiroAnterior) || new Date();
        const duracionAnt = dateIngAnt ? calcularDiferenciaFechasExacta(dateIngAnt, dateRetAnt) : { texto: 'No disponible' };

        periodosExistentes.push({
          desde: fIngresoAnterior,
          hasta: fRetiroAnterior,
          duracionTexto: duracionAnt.texto,
          cargo: row.cargo_actual_nombre || 'Servidor Público',
          entidad: 'Gobernación de Boyacá',
          tipo: 'Periodo Gobernación Anterior'
        });
      }

      // 2. Calcular nuevo acumulado de Otro Tiempo
      const nuevoOtroTiempoCalc = calcularOtroTiempoNormalizado(periodosExistentes, null);
      const nuevoOtroTiempoTexto = nuevoOtroTiempoCalc.tieneValor ? nuevoOtroTiempoCalc.texto : row.otro_tiempo_gobernacion;

      // 3. Iniciar nuevo periodo de servicio actual desde la nueva fecha de ingreso
      const dateNuevoIng = parseExcelDate(fNuevaIngreso) || new Date();
      const nuevoServicioCalc = calcularDiferenciaFechasExacta(dateNuevoIng, new Date());

      // 4. Nuevo tiempo total sumado
      const nuevoTotalCalc = sumarTiemposExactos(nuevoServicioCalc, nuevoOtroTiempoCalc);

      await client.query(
        `UPDATE estados SET estado_servidor = 'Activo', situacion = 'ACTIVO' WHERE id_estado = $1`,
        [id_estado]
      );

      const nuevoServicioTexto = (nuevoServicioCalc && nuevoServicioCalc.texto) ? nuevoServicioCalc.texto : '0 años, 0 meses, 0 días';
      const nuevoTotalTexto = (nuevoTotalCalc && nuevoTotalCalc.texto) ? nuevoTotalCalc.texto : nuevoServicioTexto;

      await client.query(
        `UPDATE rel_principal 
         SET fecha_ingreso = $1,
             fecha_retiro = NULL,
             otros_tiempos_periodos = $2,
             otro_tiempo_gobernacion = $3,
             tiempo_servicio = $4,
             tiempo_total_gobernacion = $5
         WHERE id_registro = $6`,
        [
          fNuevaIngreso,
          JSON.stringify(periodosExistentes),
          nuevoOtroTiempoTexto,
          nuevoServicioTexto,
          nuevoTotalTexto,
          id_registro
        ]
      );

      await client.query('COMMIT');
      return res.json({
        success: true,
        message: `Servidor reactivado exitosamente con nueva vinculación desde el ${fNuevaIngreso}. Periodo anterior archivado en Otro Tiempo.`,
        estadoServidor: 'Activo',
        fechaIngreso: fNuevaIngreso,
        tiempoServicioCalculado: nuevoServicioTexto,
        otroTiempoPeriodos: periodosExistentes,
        otroTiempoGobernacion: nuevoOtroTiempoTexto,
        tiempoTotalGobernacion: nuevoTotalTexto
      });
    }

    // ─── OTROS CAMBIOS DIRECTOS DE ESTADO ───
    await client.query(
      `UPDATE estados SET estado_servidor = $1 WHERE id_estado = $2`,
      [nuevoEstado, id_estado]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Estado actualizado a ${nuevoEstado}`,
      estadoServidor: nuevoEstado
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[employees-service] error updating status:', err.message);
    res.status(500).json({ error: 'Error al actualizar el estado: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/employees/:cedula ───
router.delete('/:cedula', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { cedula } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cleanTarget = (cedula || '').trim();
    const numericTarget = cleanTarget.replace(/\D/g, '');

    const r = await client.query(
      `SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado
       FROM rel_principal r
       LEFT JOIN personas p ON p.id_persona = r.id_persona
       WHERE r.id_registro = $1
          OR r.id_persona = $1
          OR p.id_persona = $1
          OR p.cedula = $1
          OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $1
          OR ($2 <> '' AND (p.cedula = $2 OR REPLACE(REPLACE(p.cedula, '.', ''), ' ', '') = $2))
       LIMIT 1`,
      [cleanTarget, numericTarget]
    );

    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Servidor no encontrado.' });
    }

    const { id_registro, id_persona, id_contacto, id_educacion, id_estado } = r.rows[0];

    // 1. Eliminar la relación principal del servidor
    await client.query('DELETE FROM rel_principal WHERE id_registro = $1', [id_registro]);

    // 2. Eliminar contactos solo si ningún otro registro los referencia
    if (id_contacto) {
      const checkContacto = await client.query('SELECT 1 FROM rel_principal WHERE id_contacto = $1 LIMIT 1', [id_contacto]);
      if (checkContacto.rows.length === 0) {
        await client.query('DELETE FROM contactos WHERE id_contacto = $1', [id_contacto]);
      }
    }

    // 3. Eliminar educacion solo si ningún otro registro la referencia
    if (id_educacion) {
      const checkEducacion = await client.query('SELECT 1 FROM rel_principal WHERE id_educacion = $1 LIMIT 1', [id_educacion]);
      if (checkEducacion.rows.length === 0) {
        await client.query('DELETE FROM educacion WHERE id_educacion = $1', [id_educacion]);
      }
    }

    // 4. Eliminar persona solo si ningún otro registro la referencia
    if (id_persona) {
      const checkPersona = await client.query('SELECT 1 FROM rel_principal WHERE id_persona = $1 LIMIT 1', [id_persona]);
      if (checkPersona.rows.length === 0) {
        await client.query('DELETE FROM personas WHERE id_persona = $1', [id_persona]);
      }
    }

    // 5. Los estados del catálogo base (EST001..EST005) NUNCA se eliminan.
    // Solo si fuera un estado personalizado no perteneciente al catálogo se valida si está huérfano.
    if (id_estado && !/^EST00[1-5]$/i.test(id_estado)) {
      const checkEstado = await client.query('SELECT 1 FROM rel_principal WHERE id_estado = $1 LIMIT 1', [id_estado]);
      if (checkEstado.rows.length === 0) {
        await client.query('DELETE FROM estados WHERE id_estado = $1', [id_estado]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Servidor eliminado exitosamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[employees] delete error:', err.message);
    if (err.code === '23503' || (err.message && err.message.includes('foreign key constraint'))) {
      return res.status(409).json({
        success: false,
        error: 'No es posible eliminar el servidor público porque cuenta con registros históricos asociados (acuerdos de horarios, comisiones de viáticos o antecedentes). Para desvincular al servidor sin perder la trazabilidad institucional, utilice la opción de Retiro / Cambio de Estado.'
      });
    }
    res.status(500).json({ error: 'Error al eliminar el servidor: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/employees/admin/wipe-all (Limpieza total a estado cero de servidores públicos) ───
router.post('/admin/wipe-all', auth, async (req, res) => {
  const role = String(req.user?.rol || req.user?.role || '').toLowerCase();
  if (role !== 'administrador' && role !== 'admin') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol de Administrador.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Desacoplar restricciones de llaves foráneas dependientes
    await client.query(`
      ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
      ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;
      ALTER TABLE IF EXISTS vacaciones DROP CONSTRAINT IF EXISTS fk_vacaciones_personas;
      ALTER TABLE IF EXISTS historial_solicitudes DROP CONSTRAINT IF EXISTS fk_historial_personas;
      ALTER TABLE IF EXISTS solicitudes_admin DROP CONSTRAINT IF EXISTS fk_solicitudes_personas;
      ALTER TABLE IF EXISTS soportes_solicitudes DROP CONSTRAINT IF EXISTS fk_soportes_personas;
    `);

    // 2. Limpiar registros de servidores públicos
    const relCount = await client.query('SELECT COUNT(*) AS total FROM rel_principal');
    const perCount = await client.query('SELECT COUNT(*) AS total FROM personas');

    await client.query('DELETE FROM rel_principal');
    await client.query('DELETE FROM contactos');
    await client.query('DELETE FROM educacion');
    await client.query('DELETE FROM personas');
    await client.query("DELETE FROM estados WHERE id_estado NOT IN ('EST001', 'EST002', 'EST003', 'EST004', 'EST005')");

    // 3. Reiniciar secuencias autonuméricas
    await client.query(`
      ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
      ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
      ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
      ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
      ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
      ALTER SEQUENCE IF EXISTS seq_estados_id RESTART WITH 6;
    `);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Todos los servidores públicos han sido eliminados del sistema y las secuencias han sido reiniciadas a estado cero.',
      eliminados: {
        rel_principal: parseInt(relCount.rows[0]?.total || 0),
        personas: parseInt(perCount.rows[0]?.total || 0)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[employees] wipe-all error:', err.message);
    return res.status(500).json({ error: 'Error al limpiar servidores públicos: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
