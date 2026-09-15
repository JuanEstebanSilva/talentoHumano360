const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { Pool } = require('pg');
const { uploadMiddleware, importarExcel } = require('../controllers/employeeImportController');
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
  validateFunciones,
  validateMatricula,
  validateTelefonoFijo,
  validateCelulares,
  validateEmail,
  validateOtroTiempoPeriodos,
  sumarTiemposExactos,
  calcularOtroTiempoNormalizado
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
const JWT_SECRET = process.env.JWT_SECRET || 'talento360_secret_2026';

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido.' }); }
}
function canEdit(role) {
  return role && (role.toLowerCase().includes('administrador') || role.toLowerCase().includes('coordinador'));
}
function clean(v) { return v == null ? '' : String(v).trim().replace(/\s+/g,' ').toUpperCase(); }

// ─── POST /api/employees/importar-excel (Carga Masiva de Archivo Excel) ─────────
router.post(['/importar-excel', '/import-excel', '/upload-excel'], auth, (req, res) => {
  if (!canEdit(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Permisos insuficientes para realizar la importación masiva.' });
  }

  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    importarExcel(req, res, pool);
  });
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { q = '', page = 1, limit = 30 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  try {
    const whereClause = q
      ? `WHERE LOWER(p.nombre_completo) LIKE LOWER($1) OR p.cedula LIKE $1
              OR LOWER(d.dependencia) LIKE LOWER($1) OR LOWER(ca.cargo) LIKE LOWER($1)
              OR (ve.numero_vacante IS NOT NULL AND ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0')) ILIKE $1)`
      : '';
    const params = q ? [`%${q.trim()}%`] : [];
    const limitParam = q ? `$2` : `$1`;
    const offsetParam = q ? `$3` : `$2`;

    const sql = `
      WITH vacantes_enum AS (
        SELECT r_sub.id_registro,
               ROW_NUMBER() OVER (ORDER BY r_sub.id_registro) AS numero_vacante
        FROM rel_principal r_sub
        JOIN personas p_sub ON p_sub.id_persona = r_sub.id_persona
        LEFT JOIN estados e_sub ON e_sub.id_estado = r_sub.id_estado
        WHERE p_sub.es_vacante = true OR e_sub.situacion = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
      )
      SELECT r.id_registro,
             ve.numero_vacante,
             CASE
               WHEN ve.numero_vacante IS NOT NULL THEN ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0'))
               ELSE NULL
             END AS codigo_vacante,
             COALESCE(p.cedula,'') AS cedula,
             COALESCE(p.documento_pendiente, (p.cedula LIKE 'PROV-%')) AS documento_pendiente,
             COALESCE(p.es_vacante, (e.situacion = 'VACANTE')) AS es_vacante,
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
             COALESCE(cb.cargo,'') AS cargo_base,
             COALESCE(cb.codigo,'') AS codigo_base,
             COALESCE(cb.grado,'') AS grado_base,
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
             COALESCE(r.fecha_encargo,'') AS fecha_encargo,
             COALESCE(r.otro_tiempo_gobernacion,'') AS otro_tiempo_gobernacion,
             COALESCE(r.tiempo_total_gobernacion,'') AS tiempo_total_gobernacion,
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
      ORDER BY 
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
            OR e.situacion = 'VACANTE'
            OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            THEN 1
          -- 3. Activos con cédula de primeras (prioridad 0)
          ELSE 0 
        END ASC,
        p.nombre_completo ASC
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
        WHERE p_sub.es_vacante = true OR e_sub.situacion = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
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
        const edadCalc = dateNac ? calcularDiferenciaFechasExacta(dateNac) : null;
        const tiempoCalc = dateIng ? calcularDiferenciaFechasExacta(dateIng) : null;
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
          primerApellido: esVacante ? 'VACANTE' : clean(r.primer_apellido),
          segundoApellido: esVacante ? '' : clean(r.segundo_apellido),
          apellidos: esVacante ? 'VACANTE' : (apellidosJuntos || clean(r.primer_apellido)),
          nombres: esVacante ? 'PLAZA VACANTE' : clean(r.nombres),
          expedida: esVacante ? null : clean(r.expedida),
          departamentoExpedicion: esVacante ? null : clean(r.departamento_expedicion),
          municipioExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
          ciudadExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
          tipoDiscapacidad: esVacante ? null : r.tipo_discapacidad,
          tipoSangre: esVacante ? null : clean(r.tipo_sangre),
          fechaNacimiento: esVacante ? null : r.fecha_nacimiento,
          edadCalculada: esVacante ? null : (edadCalc ? edadCalc.texto : 'No disponible'),
          edadAnios: esVacante ? null : (edadCalc ? edadCalc.anios : null),
          dependencia: clean(r.dependencia),
          cargoActual: clean(r.cargo_actual),
          codigoActual: clean(r.codigo_actual),
          gradoActual: clean(r.grado_actual),
          cargoBase: clean(r.cargo_base),
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
          situacion: esVacante ? 'VACANTE' : (r.situacion || 'ACTIVO'),
          clasificacionEmpleo: esVacante ? 'VACANTE' : r.clasificacion_empleo,
          estadoServidor: esVacante ? 'Activo' : (r.estado_servidor || 'Activo'),
          funciones: esVacante ? null : r.funciones,
          opec: esVacante ? null : r.opec,
          novedades: esVacante ? 'PLAZA VACANTE' : r.novedades,
          fechaIngreso: esVacante ? null : r.fecha_ingreso,
          fechaEncargo: esVacante ? null : r.fecha_encargo,
          tiempoServicioCalculado: esVacante ? null : (tiempoCalc ? tiempoCalc.texto : 'No disponible'),
          otroTiempoGobernacion: esVacante ? null : r.otro_tiempo_gobernacion,
          otroTiempoCalculado: esVacante ? null : (otroTiempoCalc && otroTiempoCalc.tieneValor ? otroTiempoCalc.texto : '0 años, 0 meses, 0 días'),
          otroTiempoPeriodos: esVacante ? [] : (Array.isArray(r.otros_tiempos_periodos) ? r.otros_tiempos_periodos : []),
          tiempoTotalGobernacion: esVacante ? null : (tiempoTotalCalc ? tiempoTotalCalc.texto : (tiempoCalc ? tiempoCalc.texto : 'No disponible')),
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
    res.status(500).json({ error: 'Error al listar servidores.' });
  }
});

// ─── GET /api/employees/catalogs ─────────────────────────────────────────────
router.get('/catalogs', auth, async (_, res) => {
  try {
    const [depsRes, cargosRes, cargosPorDepRes, divipolaRes] = await Promise.all([
      pool.query('SELECT DISTINCT dependencia FROM dependencias WHERE dependencia IS NOT NULL AND dependencia <> \'\' ORDER BY dependencia'),
      pool.query('SELECT DISTINCT cargo, codigo, grado, asignacion_sueldo FROM cargos WHERE cargo IS NOT NULL AND cargo <> \'\' ORDER BY cargo'),
      pool.query(`
        SELECT DISTINCT d.dependencia, c.cargo, c.codigo, c.grado, c.asignacion_sueldo
        FROM rel_principal r
        JOIN dependencias d ON d.id_dependencia = r.id_dependencia
        JOIN cargos c ON (c.id_cargo = r.id_cargo_actual OR c.id_cargo = r.id_cargo_base)
        WHERE d.dependencia IS NOT NULL AND c.cargo IS NOT NULL
        ORDER BY d.dependencia, c.cargo
      `),
      pool.query('SELECT departamento, municipio FROM divipola ORDER BY departamento, municipio')
    ]);

    // Mapeo dinámico: Dependencia -> Lista de Cargos
    const cargosPorDependencia = {};
    for (const row of cargosPorDepRes.rows) {
      const dep = clean(row.dependencia);
      if (!cargosPorDependencia[dep]) cargosPorDependencia[dep] = [];
      cargosPorDependencia[dep].push({
        cargo: clean(row.cargo),
        codigo: clean(row.codigo),
        grado: clean(row.grado),
        asignacion: row.asignacion_sueldo
      });
    }

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

    res.json({
      dependencias: depsRes.rows.map(r => clean(r.dependencia)).filter(Boolean),
      departamentos: depsRes.rows.map(r => clean(r.dependencia)).filter(Boolean),
      cargos: cargosRes.rows.map(r => ({
        cargo: clean(r.cargo),
        codigo: clean(r.codigo),
        grado: clean(r.grado),
        asignacion: r.asignacion_sueldo
      })).filter(c => Boolean(c.cargo)),
      cargosPorDependencia,
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
      discapacidades: DISCAPACIDADES_VALIDAS,
      tiposSangre: TIPOS_SANGRE_VALIDOS,
      diplomados: DIPLOMADOS_OPCIONES
    });
  } catch (err) {
    console.error('[employees] catalogs error:', err);
    res.status(500).json({ error: 'Error al cargar catálogos.' });
  }
});

// ─── POST /api/employees (Crear Servidor con 22 Reglas Estrictas) ─────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });

  const {
    nombreCompleto,
    cedula,
    departamentoExpedicion,
    municipioExpedicion,
    ciudadExpedicion,
    sexo,
    tipoSangre,
    fechaNacimiento,
    dependencia,
    cargoActual,
    codigoCargo,
    grado,
    asignacion,
    clasificacionEmpleo,
    estadoServidor,
    situacion,
    tipoDiscapacidad,
    opec,
    fechaIngreso,
    fechaEncargo,
    otroTiempoGobernacion,
    otroTiempoPeriodos,
    funciones,
    novedades,
    estudios,
    matriculaProfesional,
    institucionEstudios,
    postgrado,
    institucionPostgrado,
    tieneDiplomado,
    diplomadoCapSena,
    direccion,
    ciudad,
    telefonoFijo,
    celular,
    celulares,
    correo,
    correoPersonal
  } = req.body;

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

  // 5. Validar Estado del Servidor (Regla 6: Activo, Inactivo, Pensionado)
  const estadoServidorValidado = validateEstadoServidor(estadoServidor);
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
      const r = await client.query(`SELECT ${col} FROM ${table}`);
      let max = 0;
      r.rows.forEach(row => {
        const digits = (row[col.toLowerCase()] || '').replace(/\D/g, '');
        if (digits) max = Math.max(max, parseInt(digits));
      });
      return prefix + String(max + 1).padStart(width, '0');
    };

    const findOrCreate = async (table, idCol, nameCol, prefix, width, name, insertFn) => {
      const cleanName = clean(name) || 'NO REGISTRADO';
      const existing = await client.query(`SELECT ${idCol} FROM ${table} WHERE LOWER(${nameCol}) = LOWER($1) LIMIT 1`, [cleanName]);
      if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];
      const id = await nextId(table, idCol, prefix, width);
      await insertFn(id, cleanName);
      return id;
    };

    const personId = await nextId('personas', 'id_persona', 'PER', 4);
    const contactId = await nextId('contactos', 'id_contacto', 'CON', 4);
    const educationId = await nextId('educacion', 'id_educacion', 'EDU', 4);
    const statusId = await nextId('estados', 'id_estado', 'EST', 4);
    const recordId = await nextId('rel_principal', 'id_registro', 'REL', 4);

    const deptId = await findOrCreate('dependencias', 'id_dependencia', 'dependencia', 'DEP', 3, dependencia || 'NO REGISTRADO', async (id, name) =>
      client.query('INSERT INTO dependencias(id_dependencia, dependencia) VALUES ($1,$2)', [id, name]));

    const cargoId = await findOrCreate('cargos', 'id_cargo', 'cargo', 'CAR', 3, cargoActual || 'NO REGISTRADO', async (id, name) =>
      client.query(
        "INSERT INTO cargos(id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES ($1,'PLANTA',$2,$3,$4,$5,'PROFESIONAL')",
        [id, name, codigoValidado.valor, gradoValidado.valor, asignacion || '$0']
      ));

    // Inserción en personas
    const mpioExp = clean(municipioExpedicion || ciudadExpedicion || 'TUNJA');
    const deptoExp = clean(departamentoExpedicion || 'BOYACÁ');
    const expedidaLugar = `${mpioExp}, ${deptoExp}`;
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
        sexoValidado.valor,
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
        clean(direccion) || 'NO REGISTRADO',
        clean(ciudad) || 'TUNJA, BOYACÁ',
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
        clean(estudios) || 'NO REGISTRADO',
        matriculaValidada.valor,
        clean(institucionEstudios) || 'NO REGISTRADO',
        clean(postgrado) || null,
        clean(institucionPostgrado) || null,
        clean(diplomadoCapSena) || null,
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
        clean(clasificacionEmpleo) || 'CARRERA ADMINISTRATIVA',
        situacionValidada.situacion,
        funcionesValidadas.valor,
        clean(novedades) || '',
        opec || null,
        estadoServidorValidado.valor,
        funcionesValidadas.valor
      ]
    );

    // Cálculo de tiempo de servicio y tiempo total en gobernación
    const dateIngPost = parseExcelDate(fechaIngreso);
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
         tiempo_total_gobernacion, fecha_ingreso, tiempo_servicio, fecha_encargo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
        fechaIngreso || null,
        tiempoCalcPost ? tiempoCalcPost.texto : null,
        fechaEncargo || null
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
  const { cedula } = req.params;
  try {
    const sql = `
      WITH vacantes_enum AS (
        SELECT r_sub.id_registro,
               ROW_NUMBER() OVER (ORDER BY r_sub.id_registro) AS numero_vacante
        FROM rel_principal r_sub
        JOIN personas p_sub ON p_sub.id_persona = r_sub.id_persona
        LEFT JOIN estados e_sub ON e_sub.id_estado = r_sub.id_estado
        WHERE p_sub.es_vacante = true OR e_sub.situacion = 'VACANTE' OR p_sub.nombre_completo LIKE 'PLAZA VACANTE%'
      )
      SELECT r.id_registro,
             ve.numero_vacante,
             CASE
               WHEN ve.numero_vacante IS NOT NULL THEN ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0'))
               ELSE NULL
             END AS codigo_vacante,
             COALESCE(p.cedula,'') AS cedula,
             COALESCE(p.documento_pendiente, (p.cedula LIKE 'PROV-%')) AS documento_pendiente,
             COALESCE(p.es_vacante, (e.situacion = 'VACANTE')) AS es_vacante,
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
             COALESCE(ca.asignacion_sueldo,'') AS asignacion,
             COALESCE(cb.cargo,'') AS cargo_base,
             COALESCE(cb.codigo,'') AS codigo_base,
             COALESCE(cb.grado,'') AS grado_base,
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
             COALESCE(r.fecha_encargo,'') AS fecha_encargo,
             COALESCE(r.otro_tiempo_gobernacion,'') AS otro_tiempo_gobernacion,
             COALESCE(r.tiempo_total_gobernacion,'') AS tiempo_total_gobernacion,
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
      WHERE (p.cedula = $1 OR r.id_registro = $1 OR p.id_persona = $1
             OR (ve.numero_vacante IS NOT NULL AND ('PLAZA VACANTE ' || LPAD(ve.numero_vacante::text, 4, '0')) ILIKE $1))
      LIMIT 1`;

    const result = await pool.query(sql, [cedula.trim()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funcionario no encontrado.' });
    }

    const r = result.rows[0];
    const dateNac = parseExcelDate(r.fecha_nacimiento);
    const dateIng = parseExcelDate(r.fecha_ingreso);
    const edadCalc = dateNac ? calcularDiferenciaFechasExacta(dateNac) : null;
    const tiempoCalc = dateIng ? calcularDiferenciaFechasExacta(dateIng) : null;
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
      primerApellido: esVacante ? 'VACANTE' : clean(r.primer_apellido),
      segundoApellido: esVacante ? '' : clean(r.segundo_apellido),
      nombres: esVacante ? 'PLAZA VACANTE' : clean(r.nombres),
      apellidos: esVacante ? 'VACANTE' : [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' ').trim(),
      expedida: esVacante ? null : clean(r.expedida),
      departamentoExpedicion: esVacante ? null : clean(r.departamento_expedicion),
      municipioExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
      ciudadExpedicion: esVacante ? null : clean(r.municipio_expedicion || r.ciudad_expedicion),
      tipoDiscapacidad: esVacante ? null : r.tipo_discapacidad,
      tipoSangre: esVacante ? null : clean(r.tipo_sangre),
      fechaNacimiento: esVacante ? null : r.fecha_nacimiento,
      edadCalculada: esVacante ? null : (edadCalc ? edadCalc.texto : 'No disponible'),
      dependencia: clean(r.dependencia),
      cargoActual: clean(r.cargo_actual),
      codigoActual: clean(r.codigo_actual),
      gradoActual: clean(r.grado_actual),
      cargoBase: clean(r.cargo_base),
      codigoBase: clean(r.codigo_base),
      gradoBase: clean(r.grado_base),
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
      situacion: esVacante ? 'VACANTE' : (r.situacion || 'ACTIVO'),
      clasificacionEmpleo: esVacante ? 'VACANTE' : r.clasificacion_empleo,
      estadoServidor: esVacante ? 'Activo' : (r.estado_servidor || 'Activo'),
      funciones: esVacante ? null : r.funciones,
      opec: esVacante ? null : r.opec,
      novedades: esVacante ? 'PLAZA VACANTE' : r.novedades,
      fechaIngreso: esVacante ? null : r.fecha_ingreso,
      fechaEncargo: esVacante ? null : r.fecha_encargo,
      tiempoServicioCalculado: esVacante ? null : (tiempoCalc ? tiempoCalc.texto : 'No disponible'),
      otroTiempoGobernacion: esVacante ? null : r.otro_tiempo_gobernacion,
      otroTiempoCalculado: esVacante ? null : (otroTiempoCalc && otroTiempoCalc.tieneValor ? otroTiempoCalc.texto : '0 años, 0 meses, 0 días'),
      otroTiempoPeriodos: esVacante ? [] : (Array.isArray(r.otros_tiempos_periodos) ? r.otros_tiempos_periodos : []),
      tiempoTotalGobernacion: esVacante ? null : (tiempoTotalCalc ? tiempoTotalCalc.texto : (tiempoCalc ? tiempoCalc.texto : 'No disponible')),
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
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { cedula } = req.params;
  const {
    nombreCompleto,
    nuevaCedula,
    departamentoExpedicion,
    municipioExpedicion,
    ciudadExpedicion,
    sexo,
    tipoSangre,
    fechaNacimiento,
    dependencia,
    cargoActual,
    codigoCargo,
    grado,
    asignacion,
    clasificacionEmpleo,
    estadoServidor,
    situacion,
    tipoDiscapacidad,
    opec,
    fechaIngreso,
    fechaEncargo,
    otroTiempoGobernacion,
    otroTiempoPeriodos,
    funciones,
    novedades,
    estudios,
    matriculaProfesional,
    institucionEstudios,
    postgrado,
    institucionPostgrado,
    tieneDiplomado,
    diplomadoCapSena,
    direccion,
    ciudad,
    telefonoFijo,
    celular,
    celulares,
    correo,
    correoPersonal
  } = req.body;

  // Validaciones
  const nombreValidado = validateAndSplitNombre(nombreCompleto);
  if (!nombreValidado.valido) return res.status(400).json({ error: nombreValidado.error });

  const codigoValidado = validateCodigoCargo(codigoCargo, true);
  if (!codigoValidado.valido) return res.status(400).json({ error: codigoValidado.error });

  const gradoValidado = validateGrado(grado);
  if (!gradoValidado.valido) return res.status(400).json({ error: gradoValidado.error });

  const estadoServidorValidado = validateEstadoServidor(estadoServidor);
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
    const r = await client.query(
      'SELECT r.id_registro, r.id_persona, r.id_contacto, r.id_educacion, r.id_estado, r.id_cargo_actual FROM rel_principal r JOIN personas p ON p.id_persona=r.id_persona WHERE (p.cedula=$1 OR r.id_registro=$1 OR p.id_persona=$1) LIMIT 1',
      [cedula]);
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
    const mpioExp = clean(municipioExpedicion || ciudadExpedicion);
    const deptoExp = clean(departamentoExpedicion);
    const expedidaLugar = mpioExp ? `${mpioExp}${deptoExp ? ', ' + deptoExp : ''}` : null;
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
        sexoValidado.valor,
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
        clean(direccion) || null,
        clean(ciudad) || null,
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
        clean(estudios) || null,
        matriculaValidada.valor,
        clean(institucionEstudios) || null,
        clean(postgrado) || null,
        clean(institucionPostgrado) || null,
        clean(diplomadoCapSena) || null,
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
        clean(clasificacionEmpleo) || null,
        situacionValidada.situacion,
        funcionesValidadas.valor,
        clean(novedades) || null,
        opec || null,
        estadoServidorValidado.valor,
        id_estado
      ]
    );

    // Actualizar o crear cargos
    const nextId = async (table, col, prefix, width) => {
      const qr = await client.query(`SELECT ${col} FROM ${table}`);
      let max = 0;
      qr.rows.forEach(row => {
        const digits = (row[col.toLowerCase()] || '').replace(/\D/g, '');
        if (digits) max = Math.max(max, parseInt(digits));
      });
      return prefix + String(max + 1).padStart(width, '0');
    };

    const findOrCreate = async (table, idCol, nameCol, prefix, width, name, insertFn) => {
      const cleanName = clean(name) || 'NO REGISTRADO';
      const existing = await client.query(`SELECT ${idCol} FROM ${table} WHERE LOWER(${nameCol}) = LOWER($1) LIMIT 1`, [cleanName]);
      if (existing.rows.length > 0) return existing.rows[0][idCol.toLowerCase()];
      const id = await nextId(table, idCol, prefix, width);
      await insertFn(id, cleanName);
      return id;
    };

    let deptId = null;
    if (dependencia) {
      deptId = await findOrCreate('dependencias', 'id_dependencia', 'dependencia', 'DEP', 3, dependencia, async (id, name) =>
        client.query('INSERT INTO dependencias(id_dependencia, dependencia) VALUES ($1,$2)', [id, name]));
    }

    let cargoId = null;
    if (cargoActual) {
      cargoId = await findOrCreate('cargos', 'id_cargo', 'cargo', 'CAR', 3, cargoActual, async (id, name) =>
        client.query("INSERT INTO cargos(id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES ($1,'PLANTA',$2,$3,$4,$5,'PROFESIONAL')",
          [id, name, codigoValidado.valor, gradoValidado.valor, asignacion || '$0']));

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

// ─── DELETE /api/employees/:cedula ───────────────────────────────────────────
router.delete('/:cedula', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
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
          OR ($2 <> '' AND p.cedula = $2)
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
    res.status(500).json({ error: 'Error al eliminar el servidor: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
