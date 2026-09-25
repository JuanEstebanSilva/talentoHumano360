const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');

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

// ─── Catálogos Oficiales SST — Gobernación de Boyacá ─────────────────────────
const CATALOGO_EPP = [
  { codigo: 'A',  nombre: 'A. Casco de seguridad' },
  { codigo: 'B',  nombre: 'B. Gorro o Cofias' },
  { codigo: 'C',  nombre: 'C. Gorro Zafari' },
  { codigo: 'D',  nombre: 'D. Tapones externos' },
  { codigo: 'E',  nombre: 'E. Tapones de copa (orejeras)' },
  { codigo: 'F',  nombre: 'F. Careta (guadañar)' },
  { codigo: 'G',  nombre: 'G. Monogafas' },
  { codigo: 'H',  nombre: 'H. Gafas de seguridad' },
  { codigo: 'I',  nombre: 'I. Gafas de seguridad / UV' },
  { codigo: 'J',  nombre: 'J. Respirador con filtros' },
  { codigo: 'K',  nombre: 'K. Filtros para respiradores' },
  { codigo: 'L',  nombre: 'L. Respirador ffp2 o n95' },
  { codigo: 'M',  nombre: 'M. Mascarilla desechable' },
  { codigo: 'N',  nombre: 'N. Guantes de poliuretano' },
  { codigo: 'O',  nombre: 'O. Guantes de vaqueta' },
  { codigo: 'P',  nombre: 'P. Guantes de Nitrilo' },
  { codigo: 'Q',  nombre: 'Q. Guantes de látex' },
  { codigo: 'R',  nombre: 'R. Guantes de caucho' },
  { codigo: 'S',  nombre: 'S. Guantes sustancias químicas' },
  { codigo: 'T',  nombre: 'T. Chaleco Trabajo en campo' },
  { codigo: 'U',  nombre: 'U. Overol de dos piezas cinta reflectiva' },
  { codigo: 'V',  nombre: 'V. Overol antifluidos' },
  { codigo: 'W',  nombre: 'W. Bata manga larga antifluido' },
  { codigo: 'X',  nombre: 'X. Delantal Carnaza' },
  { codigo: 'Y',  nombre: 'Y. Zapato cerrado' },
  { codigo: 'Z',  nombre: 'Z. Botas de Seguridad' },
  { codigo: 'AA', nombre: 'AA. Botas pantaneras con puntera' },
  { codigo: 'AB', nombre: 'AB. Otros' }
];

const SEDES_TRABAJO = [
  'CASA DE LA TORRE',
  'EDIFICIO INTELIGENTE - BICENTENARIO',
  'ARCHIVO GENERAL DEL DEPARTAMENTO - Centro.',
  'ARCHIVO GENERAL DEL DEPARTAMENTO - Topo.',
  'AUDITORIO JOSE MOSSER Y OFICINAS.',
  'BIBLIOTECA DEPARTAMENTAL "EDUARDO TORRES QUINTERO" ARCHIVO COBRO COACTIVO.',
  'BIBLIOTECA PEDRO PASCACIO MARTÍNEZ. (CASA JUAN DE CASTELLANOS)',
  'BODEGA TALLERES DE OBRAS PÚBLICAS DEL DEPARTAMENTO DE BOYACÁ.',
  'BODEGA VECTORES',
  'CASA DE BOYACÁ EN BOGOTÁ.',
  'CASA PRIVADA DEL SEÑOR GOBERNADOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 203 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 206 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 207 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 208 B INTERIOR',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 209 B INTERIOR',
  'EDIFICIO CENTRO EXPERIMENTAL PILOTO - CEP.',
  'EDIFICIO LOTERÍA DE BOYACÁ',
  'EDIFICIO LOTERÍA DE BOYACÁ PISO 4',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 8° OFICINA 805',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1002',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1003',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1004',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1006',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1007',
  'SECRETARIA DE EDUCACION DE BOYACÁ.',
  'SECRETARÍA DE SALUD DE BOYACÁ - CRISDI',
  'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.',
  'VIVE DIGITAL Y VIVE LAB.'
];

const DEPENDENCIAS_OFICIALES = [
  'DES - Despacho del gobernador',
  'DES - Oficina Asesora de Control Interno de Gestión',
  'DES - Oficina Asesora de Control Interno Disciplinario',
  'DES - Unidad Administrativa de Comunicaciones y Protocolo',
  'DES - UCOM - Subdirección de Radio y Televisión',
  'DES - Unidad Administrativa de Relaciones Nacionales Internacionales',
  'DES - Unidad Administrativa Especial de Asesoría y Defensa Jurídica del Departamento',
  'DES - Unidad Administrativa para la Gestión del Riesgo y del Desastre',
  'SAGR - SECRETARIA DE AGRICULTURA (Despacho)',
  'SAGR - Dirección de Desarrollo Rural Integral',
  'SAGR - Dirección de Productividad Agropecuaria',
  'SAGR - Dirección de Bienestar Campesino',
  'SAMB - SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE (Despacho)',
  'SAMB - Dirección de Gestión del Recurso Hídrico y Saneamiento Básico',
  'SCON - SECRETARIA DE CONTRATACION (Despacho)',
  'SCON - Dirección Administrativa Contractual',
  'SCON - Dirección de Procesos de Selección',
  'SCUP - SECRETARIA DE CULTURA Y PATRIMONIO (Despacho)',
  'SDEM - SECRETARIA DE DESARROLLO EMPRESARIAL (Despacho)',
  'SDEM - Dirección de Desarrollo Empresarial',
  'SDEM - Dirección de Inversión y Comercio',
  'SEDU - SECRETARIA DE EDUCACIÓN (Despacho)',
  'SEDU - Oficina Asesora para la Gestión Estratégica del Sector Educación',
  'SGEN - SECRETARIA GENERAL (Despacho)',
  'SGEN - Dirección General de Talento Humano',
  'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo',
  'SGEN - Dirección de Servicios Administrativos y Logísticos',
  'SGEN - DSA - Subdirección de Gestión Documental',
  'SGEN - DSA - Subdirección de Atención al Ciudadano',
  'SGOB - SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL (Despacho)',
  'SGOB - Dirección de Participación y Acción Comunal',
  'SGOB - Dirección de Juventud',
  'SHAC - SECRETARIA DE HACIENDA (Despacho)',
  'SHAC - Dirección Financiera y Fiscal',
  'SHAC - Dirección de Recaudo y Fiscalización',
  'SHAC - Tesorería General',
  'SHAC - Dirección Departamental de Pasivos Pensionales',
  'SINF - SECRETARIA DE INFRAESTRUCTURA PÚBLICA (Despacho)',
  'SINF - Dirección de Vivienda Edificaciones y Obra Pública',
  'SINT - SECRETARIA DE INTEGRACIÓN SOCIAL (Despacho)',
  'SMIN - SECRETARIA DE MINAS Y ENERGÍA (Despacho)',
  'SPLA - SECRETARIA DE PLANEACIÓN (Despacho)',
  'SPLA - Dirección de Seguimiento y Planeación Territorial',
  'SSAL - SECRETARIA DE SALUD (Despacho)',
  'SSAL - Dirección de Aseguramiento en Salud',
  'SSAL - Dirección de Prestación de Servicios de Salud',
  'SSAL - Dirección de Promoción y Prevención en Salud',
  'SSAL - Oficina Asesora para la Gestión Estratégica del Sector Salud',
  'STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)',
  'STIC - Dirección de Apropiación de TIC',
  'STIC - Dirección de Sistemas de Información',
  'STUR - SECRETARIA DE TURISMO (Despacho)'
];

const TIPOS_EMO = ['Ingreso', 'Periódico', 'Egreso', 'Post Incapacidad', 'Trabajo en alturas'];
const ESTADOS_CASO = ['Vigente', 'En Seguimiento', 'En Rehabilitación', 'Próximo a Vencer', 'Vencido', 'Cerrado'];
const PROGRAMAS_PVE = [
  'No aplica',
  'PVE Biomecánico / Osteomuscular',
  'PVE Psicosocial',
  'PVE Visual',
  'PVE Auditivo',
  'PVE Cardiovascular y Metabólico',
  'PVE Respiratorio',
  'PVE Voz'
];

// ─── Auto-Inicialización Segura de Esquema SST ──────────────────────────────
async function ensureSstSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sst_perfil_epidemiologico (
          id_epidemiologico         SERIAL PRIMARY KEY,
          tipo_identificacion       VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
          documento                 VARCHAR(60)   NOT NULL,
          apellidos                 VARCHAR(160)  NOT NULL,
          nombres                   VARCHAR(160)  NOT NULL,
          nombre_completo           VARCHAR(320)  NOT NULL,
          telefono                  VARCHAR(60),
          edad                      INTEGER,
          fecha_ingreso             VARCHAR(60),
          dependencia               VARCHAR(300)  NOT NULL,
          sede_trabajo              VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          cargo                     VARCHAR(280),
          fecha_emo                 DATE,
          tipo_emo                  VARCHAR(80)   NOT NULL DEFAULT 'Periódico',
          restricciones             TEXT          DEFAULT 'NINGUNA',
          recomendaciones           TEXT          DEFAULT 'Pausas activas e higiene postural',
          direccionado_pve          VARCHAR(200)  DEFAULT 'No aplica',
          direccionado_eps          VARCHAR(200)  DEFAULT 'No aplica',
          fecha_proximo_emo         DATE,
          accidente_trabajo         VARCHAR(20)   NOT NULL DEFAULT 'NO',
          fecha_accidente           DATE,
          estado_actual_accidente   VARCHAR(250),
          cumplio_rehabilitacion    VARCHAR(15)   DEFAULT 'N/A',
          enfermedad_laboral        VARCHAR(20)   NOT NULL DEFAULT 'NO',
          fecha_enfermedad          DATE,
          estado_actual_enfermedad  VARCHAR(250),
          estado_final_caso         VARCHAR(100)  NOT NULL DEFAULT 'Vigente',
          actividades_pendientes    TEXT,
          soporte                   TEXT,
          creado_por                VARCHAR(120)  DEFAULT 'admin',
          creado_en                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sst_entrega_epp (
          id_entrega_epp                SERIAL PRIMARY KEY,
          documento                     VARCHAR(60)   NOT NULL,
          nombre_completo               VARCHAR(320)  NOT NULL,
          telefono                      VARCHAR(60),
          secretaria                    VARCHAR(280)  DEFAULT 'SECRETARIA GENERAL',
          dependencia                   VARCHAR(300)  NOT NULL,
          sede_trabajo                  VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          cargo                         VARCHAR(280)  DEFAULT 'PROFESIONAL UNIVERSITARIO',
          tipo_vinculacion              VARCHAR(120)  DEFAULT 'CARRERA ADMINISTRATIVA',
          restricciones_recomendaciones TEXT          DEFAULT 'NINGUNA',
          codigo_elemento               VARCHAR(20)   NOT NULL DEFAULT 'A',
          elemento_epp                  VARCHAR(200)  NOT NULL,
          talla                         VARCHAR(40)   DEFAULT 'N/A',
          cantidad                      VARCHAR(60)   NOT NULL DEFAULT '1 UNIDAD',
          fecha_entrega                 DATE          NOT NULL DEFAULT CURRENT_DATE,
          estado_entrega                VARCHAR(60)   NOT NULL DEFAULT 'Entregado',
          firmado_funcionario           BOOLEAN       DEFAULT TRUE,
          observaciones                 TEXT,
          soporte                       TEXT,
          creado_por                    VARCHAR(120)  DEFAULT 'admin',
          creado_en                     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sst_perfil_sociodemografico (
          id_sociodemografico   SERIAL PRIMARY KEY,
          tipo_identificacion   VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
          documento             VARCHAR(60)   NOT NULL,
          apellidos             VARCHAR(160)  NOT NULL,
          nombres               VARCHAR(160)  NOT NULL,
          nombre_completo       VARCHAR(320)  NOT NULL,
          sexo                  VARCHAR(40)   DEFAULT 'Masculino',
          anio_nacimiento       INTEGER,
          edad                  INTEGER,
          raza_etnia            VARCHAR(80)   DEFAULT 'Blanco/Mestizo',
          estado_civil          VARCHAR(60)   DEFAULT 'Soltero (a)',
          composicion_familiar  VARCHAR(250)  DEFAULT 'Conyuge Permanente, Hijos',
          tipo_vivienda         VARCHAR(60)   DEFAULT 'Propia',
          estrato               VARCHAR(10)   DEFAULT '3',
          municipio_residencia  VARCHAR(120)  DEFAULT 'Tunja',
          municipio_trabajo     VARCHAR(120)  DEFAULT 'Tunja',
          escolaridad           VARCHAR(100)  DEFAULT 'Profesional',
          ocupacion_profesion   VARCHAR(200),
          rango_ingresos        VARCHAR(80)   DEFAULT 'Entre 3 y 6 SMMLV',
          denominacion_cargo    VARCHAR(200)  DEFAULT 'Profesional Universitario',
          tipo_cargo            VARCHAR(80)   DEFAULT 'Profesional',
          tipo_vinculacion      VARCHAR(100)  DEFAULT 'Carrera Administrativa',
          antiguedad_cargo      VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
          antiguedad_entidad    VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
          dependencia           VARCHAR(300)  NOT NULL,
          sede_trabajo          VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          creado_por            VARCHAR(120)  DEFAULT 'admin',
          creado_en             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sst_historial (
          id_historial    SERIAL PRIMARY KEY,
          submodulo       VARCHAR(60)  NOT NULL,
          id_registro     INTEGER      NOT NULL,
          accion          VARCHAR(120) NOT NULL,
          detalle         VARCHAR(500),
          realizado_por   VARCHAR(120) DEFAULT 'Sistema',
          fecha           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar datos semilla de los formatos oficiales si están vacías
    const epiCount = await pool.query('SELECT COUNT(*) FROM sst_perfil_epidemiologico');
    if (parseInt(epiCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_perfil_epidemiologico (
            tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
            fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
            restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
            accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
            enfermedad_laboral, estado_final_caso, actividades_pendientes
        ) VALUES
        (
            'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', '3213938142', 31,
            '2023-02-15', 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE', 'PROFESIONAL UNIVERSITARIO',
            '2026-01-15', 'Periódico', 'NINGUNA', 'Pausas activas visuales y ergonómicas cada 2 horas',
            'PVE Biomecánico / Osteomuscular', 'No aplica', '2027-01-15',
            'NO', NULL, NULL, 'N/A', 'NO', 'Vigente', 'Control periódico anual programado'
        ),
        (
            'Cédula de Ciudadanía', '40028155', 'SAAVEDRA RODRIGUEZ', 'YAZMIN ROCIO', 'SAAVEDRA RODRIGUEZ YAZMIN ROCIO', '3104589210', 44,
            '2018-06-01', 'SSAL - Dirección de Aseguramiento en Salud', 'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.', 'AUXILIAR ADMINISTRATIVO',
            '2026-02-20', 'Post Incapacidad', 'Evitar levantamiento de cargas mayores a 5 kg y bipedestación prolongada',
            'Adecuación de puesto de trabajo y seguimiento por medicina laboral ARL Positiva',
            'PVE Biomecánico / Osteomuscular', 'Control por Ortopedia EPS / ARL Positiva', '2026-08-20',
            'SI', '2025-12-26', 'En recuperación de fractura de peroné (CIE-10 S824)', 'SI', 'NO', 'En Seguimiento',
            'Verificar cumplimiento de recomendaciones médicas en puesto de trabajo'
        );
      `);
    }

    const eppCount = await pool.query('SELECT COUNT(*) FROM sst_entrega_epp');
    if (parseInt(eppCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_entrega_epp (
            documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo, cargo,
            tipo_vinculacion, restricciones_recomendaciones, codigo_elemento, elemento_epp,
            talla, cantidad, fecha_entrega, estado_entrega, firmado_funcionario, observaciones
        ) VALUES
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'A', 'A. Casco de seguridad', 'N/A', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
            'Entrega oficial según Formato E-DO-ST-F-028 V4 e Instructivo E-DO-ST-I-007'
        ),
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'T', 'T. Chaleco Trabajo en campo', 'L', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
            'Dotación para visitas técnicas de inspección SST'
        ),
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'P', 'P. Guantes de Nitrilo', 'M', '1 CAJA', '2026-01-15', 'Entregado', TRUE,
            'Suministro de bioseguridad SST'
        );
      `);
    }

    const socCount = await pool.query('SELECT COUNT(*) FROM sst_perfil_sociodemografico');
    if (parseInt(socCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_perfil_sociodemografico (
            tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
            anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
            tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
            escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
            tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
            dependencia, sede_trabajo
        ) VALUES (
            'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', 'Masculino',
            1994, 31, 'Blanco/Mestizo', 'Soltero (a)', 'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )',
            'Arriendo', '3', 'Tunja', 'Tunja',
            'Especialización', 'Ingeniero Industrial', 'Entre 3 y 6 SMMLV', 'Profesional Universitario',
            'Profesional', 'Carrera Administrativa', 'Entre 1 y 4 años', 'Entre 1 y 4 años',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE'
        );
      `);
    }
    console.log('[sst-service] Tablas SST verificadas correctamente.');
  } catch (err) {
    console.error('[sst-service] Error verificando esquema SST:', err.message);
  }
}

ensureSstSchema();

// ─── Middleware de Autenticación y Utilidades ────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o sesión expirada.' });
  }
}

function canEdit(role) {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes('administrador') || r.includes('coordinador');
}

function upper(v) {
  return v == null ? '' : String(v).trim().replace(/\s+/g, ' ').toUpperCase();
}

function toIsoDateOrNull(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function addOneYear(isoDate) {
  if (!isoDate) return null;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10) + 1;
  return `${y}-${parts[1]}-${parts[2]}`;
}

function resolveEppItem(raw) {
  if (!raw) return CATALOGO_EPP[0];
  const s = String(raw).trim().toUpperCase();
  const byCode = CATALOGO_EPP.find(e => e.codigo === s || s.startsWith(e.codigo + '.'));
  if (byCode) return byCode;
  const byName = CATALOGO_EPP.find(e => e.nombre.toUpperCase().includes(s));
  return byName || { codigo: 'AB', nombre: String(raw).trim() };
}

// ─── GET /api/sst/catalogs ───────────────────────────────────────────────────
router.get('/catalogs', auth, async (_, res) => {
  try {
    const dbDeps = await pool.query(
      `SELECT DISTINCT TRIM(dependencia) AS dep FROM dependencias WHERE dependencia IS NOT NULL AND TRIM(dependencia) <> '' ORDER BY dep`
    ).catch(() => ({ rows: [] }));

    const mergedDeps = Array.from(new Set([
      ...DEPENDENCIAS_OFICIALES,
      ...dbDeps.rows.map(r => r.dep)
    ]));

    res.json({
      eppCatalogo: CATALOGO_EPP,
      sedes: SEDES_TRABAJO,
      dependencias: mergedDeps,
      tiposEmo: TIPOS_EMO,
      estadosCaso: ESTADOS_CASO,
      programasPve: PROGRAMAS_PVE,
      tiposIdentificacion: ['Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'Tarjeta de Identidad'],
      razas: ['Blanco/Mestizo', 'Afrodescendiente', 'Indígena', 'Raizal', 'Palenquero', 'Gitano', 'OTRA'],
      estadosCiviles: ['Soltero (a)', 'Casado(a)', 'Unión Libre', 'Divorciado(a)', 'Viudo(a)'],
      composicionesFamiliares: [
        'Padre',
        'Madre',
        'Conyuge Permanente, Hijos',
        'Hijos',
        'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )'
      ],
      tiposVivienda: ['Propia', 'Arriendo', 'Familiar'],
      estratos: ['1', '2', '3', '4', '5', '6'],
      escolaridades: [
        'Ninguna', 'Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo',
        'Profesional', 'Especialización', 'Maestría', 'Doctorado', 'Posdoctorado'
      ],
      rangosIngresos: ['Entre 1 y 3 SMMLV', 'Entre 3 y 6 SMMLV', 'Mas de 6 SMMLV'],
      tiposCargo: ['Asistencial', 'Técnico', 'Profesional', 'Asesor', 'Directivo', 'Libre Nombramiento', 'N/A'],
      tiposVinculacion: [
        'Carrera Administrativa', 'Provisional', 'Libre Nombramiento',
        'Planta Temporal', 'CPS', 'Estudiante/Aprendiz', 'Judicante', 'Tercerizado'
      ],
      rangosAntiguedad: [
        'Menos de 1 año.', 'Entre 1 y 4 años', 'Entre 4 y 10 años',
        'Entre 10 y 20 años', 'Entre 20 y 30 años', 'Mas de 30 años', 'N/A - CPS.'
      ]
    });
  } catch (err) {
    console.error('[sst-service] catalogs error:', err.message);
    res.status(500).json({ error: 'Error al obtener catálogos SST.' });
  }
});

// ─── GET /api/sst/stats ──────────────────────────────────────────────────────
router.get('/stats', auth, async (_, res) => {
  try {
    const [epiStats, eppStats, socStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_emo,
          COUNT(*) FILTER (WHERE estado_final_caso = 'Vigente') AS emo_vigentes,
          COUNT(*) FILTER (
            WHERE estado_final_caso IN ('Vencido', 'Próximo a Vencer')
               OR (fecha_proximo_emo IS NOT NULL AND fecha_proximo_emo <= CURRENT_DATE + INTERVAL '30 days')
          ) AS emo_alertas,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(accidente_trabajo, 'NO')) = 'SI'
               OR UPPER(COALESCE(enfermedad_laboral, 'NO')) = 'SI'
               OR estado_final_caso IN ('En Seguimiento', 'En Rehabilitación')
          ) AS casos_seguimiento,
          COUNT(*) FILTER (
            WHERE direccionado_pve IS NOT NULL
              AND LOWER(TRIM(direccionado_pve)) NOT IN ('', 'no aplica', 'ninguno', 'n/a')
          ) AS direccionados_pve
        FROM sst_perfil_epidemiologico
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_epp,
          COUNT(DISTINCT documento) AS servidores_dotados,
          COUNT(*) FILTER (WHERE estado_entrega = 'Entregado') AS entregados
        FROM sst_entrega_epp
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_sociodemografico,
          COUNT(DISTINCT dependencia) AS dependencias_cubiertas
        FROM sst_perfil_sociodemografico
      `)
    ]);

    const ep = epiStats.rows[0] || {};
    const pp = eppStats.rows[0] || {};
    const sc = socStats.rows[0] || {};

    res.json({
      totalEmo: parseInt(ep.total_emo) || 0,
      emoVigentes: parseInt(ep.emo_vigentes) || 0,
      emoAlertas: parseInt(ep.emo_alertas) || 0,
      casosSeguimiento: parseInt(ep.casos_seguimiento) || 0,
      direccionadosPve: parseInt(ep.direccionados_pve) || 0,
      totalEpp: parseInt(pp.total_epp) || 0,
      servidoresDotados: parseInt(pp.servidores_dotados) || 0,
      eppEntregados: parseInt(pp.entregados) || 0,
      totalSociodemografico: parseInt(sc.total_sociodemografico) || 0,
      dependenciasCubiertas: parseInt(sc.dependencias_cubiertas) || 0
    });
  } catch (err) {
    console.error('[sst-service] stats error:', err.message);
    res.status(500).json({ error: 'Error al cargar estadísticas de SST.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 1: PERFIL EPIDEMIOLÓGICO Y EMO (Formato E-DO-ST-F-024 V3)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/epidemiologico', auth, async (req, res) => {
  const { q = '', tipoEmo = '', estadoCaso = '', dependencia = '', page = 1, limit = 20 } = req.query;
  try {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (tipoEmo && tipoEmo !== 'Todos') {
      conditions.push(`LOWER(tipo_emo) = LOWER($${idx++})`);
      params.push(tipoEmo.trim());
    }
    if (estadoCaso && estadoCaso !== 'Todos') {
      conditions.push(`LOWER(estado_final_caso) = LOWER($${idx++})`);
      params.push(estadoCaso.trim());
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(dependencia) LIKE LOWER($${idx})
        OR LOWER(COALESCE(direccionado_pve, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(restricciones, '')) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_perfil_epidemiologico WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_perfil_epidemiologico WHERE ${where} ORDER BY id_epidemiologico DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_epidemiologico,
        radicado: `EMO-2026-${String(r.id_epidemiologico).padStart(4, '0')}`,
        tipoIdentificacion: r.tipo_identificacion,
        documento: r.documento,
        apellidos: r.apellidos,
        nombres: r.nombres,
        nombreCompleto: r.nombre_completo,
        telefono: r.telefono,
        edad: r.edad,
        fechaIngreso: r.fecha_ingreso,
        dependencia: r.dependencia,
        sedeTrabajo: r.sede_trabajo,
        cargo: r.cargo,
        fechaEmo: r.fecha_emo ? r.fecha_emo.toISOString().split('T')[0] : '',
        tipoEmo: r.tipo_emo,
        restricciones: r.restricciones,
        recomendaciones: r.recomendaciones,
        direccionadoPve: r.direccionado_pve,
        direccionadoEps: r.direccionado_eps,
        fechaProximoEmo: r.fecha_proximo_emo ? r.fecha_proximo_emo.toISOString().split('T')[0] : '',
        accidenteTrabajo: r.accidente_trabajo,
        fechaAccidente: r.fecha_accidente ? r.fecha_accidente.toISOString().split('T')[0] : '',
        estadoActualAccidente: r.estado_actual_accidente,
        cumplioRehabilitacion: r.cumplio_rehabilitacion,
        enfermedadLaboral: r.enfermedad_laboral,
        fechaEnfermedad: r.fecha_enfermedad ? r.fecha_enfermedad.toISOString().split('T')[0] : '',
        estadoActualEnfermedad: r.estado_actual_enfermedad,
        estadoFinalCaso: r.estado_final_caso,
        actividadesPendientes: r.actividades_pendientes,
        soporte: r.soporte
      })),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum))
    });
  } catch (err) {
    console.error('[sst-service] list epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al listar el Perfil Epidemiológico.' });
  }
});

router.post('/epidemiologico', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const b = req.body;
  if (!b.documento || (!b.nombreCompleto && (!b.apellidos || !b.nombres))) {
    return res.status(400).json({ error: 'El documento y nombre del servidor público son obligatorios.' });
  }

  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const fechaEmo = toIsoDateOrNull(b.fechaEmo) || new Date().toISOString().split('T')[0];
  const tipoEmo = b.tipoEmo || 'Periódico';
  const fechaProximoEmo = toIsoDateOrNull(b.fechaProximoEmo) || (tipoEmo === 'Egreso' ? null : addOneYear(fechaEmo));

  try {
    const r = await pool.query(
      `INSERT INTO sst_perfil_epidemiologico (
        tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
        fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
        restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
        accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
        enfermedad_laboral, fecha_enfermedad, estado_actual_enfermedad,
        estado_final_caso, actividades_pendientes, soporte, creado_por
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
      ) RETURNING id_epidemiologico`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento).trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.telefono || '',
        parseInt(b.edad) || null,
        b.fechaIngreso || '',
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || 'PROFESIONAL UNIVERSITARIO'),
        fechaEmo,
        tipoEmo,
        b.restricciones || 'NINGUNA',
        b.recomendaciones || 'Pausas activas e higiene postural',
        b.direccionadoPve || 'No aplica',
        b.direccionadoEps || 'No aplica',
        fechaProximoEmo,
        upper(b.accidenteTrabajo || 'NO'),
        toIsoDateOrNull(b.fechaAccidente),
        b.estadoActualAccidente || '',
        upper(b.cumplioRehabilitacion || 'N/A'),
        upper(b.enfermedadLaboral || 'NO'),
        toIsoDateOrNull(b.fechaEnfermedad),
        b.estadoActualEnfermedad || '',
        b.estadoFinalCaso || 'Vigente',
        b.actividadesPendientes || '',
        b.soporte || null,
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_epidemiologico;
    await pool.query(
      `INSERT INTO sst_historial (submodulo, id_registro, accion, detalle, realizado_por)
       VALUES ('epidemiologico', $1, 'Creación EMO', $2, $3)`,
      [newId, `Registro de EMO (${tipoEmo}) para ${nombreCompleto}`, req.user.username || 'admin']
    );

    res.status(201).json({
      message: 'Registro epidemiológico creado exitosamente.',
      id: newId,
      radicado: `EMO-2026-${String(newId).padStart(4, '0')}`
    });
  } catch (err) {
    console.error('[sst-service] create epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al crear el registro epidemiológico.' });
  }
});

router.put('/epidemiologico/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  const b = req.body;
  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const fechaEmo = toIsoDateOrNull(b.fechaEmo);
  const fechaProximoEmo = toIsoDateOrNull(b.fechaProximoEmo);

  try {
    const r = await pool.query(
      `UPDATE sst_perfil_epidemiologico SET
        tipo_identificacion=$1, documento=$2, apellidos=$3, nombres=$4, nombre_completo=$5,
        telefono=$6, edad=$7, fecha_ingreso=$8, dependencia=$9, sede_trabajo=$10, cargo=$11,
        fecha_emo=$12, tipo_emo=$13, restricciones=$14, recomendaciones=$15,
        direccionado_pve=$16, direccionado_eps=$17, fecha_proximo_emo=$18,
        accidente_trabajo=$19, fecha_accidente=$20, estado_actual_accidente=$21,
        cumplio_rehabilitacion=$22, enfermedad_laboral=$23, fecha_enfermedad=$24,
        estado_actual_enfermedad=$25, estado_final_caso=$26, actividades_pendientes=$27,
        soporte=COALESCE($28, soporte), actualizado_en=CURRENT_TIMESTAMP
       WHERE id_epidemiologico=$29 RETURNING id_epidemiologico`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento || '').trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.telefono || '',
        parseInt(b.edad) || null,
        b.fechaIngreso || '',
        b.dependencia || '',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || ''),
        fechaEmo,
        b.tipoEmo || 'Periódico',
        b.restricciones || 'NINGUNA',
        b.recomendaciones || '',
        b.direccionadoPve || 'No aplica',
        b.direccionadoEps || 'No aplica',
        fechaProximoEmo,
        upper(b.accidenteTrabajo || 'NO'),
        toIsoDateOrNull(b.fechaAccidente),
        b.estadoActualAccidente || '',
        upper(b.cumplioRehabilitacion || 'N/A'),
        upper(b.enfermedadLaboral || 'NO'),
        toIsoDateOrNull(b.fechaEnfermedad),
        b.estadoActualEnfermedad || '',
        b.estadoFinalCaso || 'Vigente',
        b.actividadesPendientes || '',
        b.soporte !== undefined ? b.soporte : null,
        id
      ]
    );

    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    await pool.query(
      `INSERT INTO sst_historial (submodulo, id_registro, accion, detalle, realizado_por)
       VALUES ('epidemiologico', $1, 'Actualización', $2, $3)`,
      [id, `Actualizado estado: ${b.estadoFinalCaso || 'Vigente'}`, req.user.username || 'admin']
    );

    res.json({ message: 'Registro epidemiológico actualizado correctamente.' });
  } catch (err) {
    console.error('[sst-service] update epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al actualizar registro epidemiológico.' });
  }
});

router.patch('/epidemiologico/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  const { estadoFinalCaso, actividadesPendientes } = req.body;
  try {
    const r = await pool.query(
      `UPDATE sst_perfil_epidemiologico
       SET estado_final_caso = $1,
           actividades_pendientes = CASE WHEN $2 <> '' THEN $2 ELSE actividades_pendientes END,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id_epidemiologico = $3 RETURNING id_epidemiologico`,
      [estadoFinalCaso || 'Vigente', (actividadesPendientes || '').trim(), id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ message: 'Estado del caso SST actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del caso.' });
  }
});

router.post('/epidemiologico/check-vencimientos', auth, async (_, res) => {
  try {
    const expired = await pool.query(`
      UPDATE sst_perfil_epidemiologico
      SET estado_final_caso = 'Vencido', actualizado_en = CURRENT_TIMESTAMP
      WHERE fecha_proximo_emo IS NOT NULL
        AND fecha_proximo_emo < CURRENT_DATE
        AND estado_final_caso NOT IN ('Cerrado', 'Vencido')
      RETURNING id_epidemiologico
    `);

    const soon = await pool.query(`
      UPDATE sst_perfil_epidemiologico
      SET estado_final_caso = 'Próximo a Vencer', actualizado_en = CURRENT_TIMESTAMP
      WHERE fecha_proximo_emo IS NOT NULL
        AND fecha_proximo_emo >= CURRENT_DATE
        AND fecha_proximo_emo <= CURRENT_DATE + INTERVAL '30 days'
        AND estado_final_caso = 'Vigente'
      RETURNING id_epidemiologico
    `);

    res.json({
      message: `Verificación completada: ${expired.rowCount} EMOs vencidos y ${soon.rowCount} próximos a vencer detectados.`,
      vencidos: expired.rowCount,
      proximos: soon.rowCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar vencimientos de EMO.' });
  }
});

router.post('/epidemiologico/bulk', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron filas para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      const doc = String(r.documento || r['NÚMERO DOCUMENTO DE IDENTIFICACIÓN'] || r['Cédula'] || '').trim();
      const nom = upper(r.nombreCompleto || `${r.apellidos || ''} ${r.nombres || ''}`.trim());
      if (!doc || !nom) continue;
      const fechaEmo = toIsoDateOrNull(r.fechaEmo) || new Date().toISOString().split('T')[0];
      const fechaProx = toIsoDateOrNull(r.fechaProximoEmo) || addOneYear(fechaEmo);

      await client.query(
        `INSERT INTO sst_perfil_epidemiologico (
          tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
          fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
          restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
          accidente_trabajo, enfermedad_laboral, estado_final_caso, actividades_pendientes, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          r.tipoIdentificacion || 'Cédula de Ciudadanía',
          doc,
          upper(r.apellidos || nom.split(' ').slice(0, 2).join(' ')),
          upper(r.nombres || nom.split(' ').slice(2).join(' ') || nom),
          nom,
          r.telefono || '',
          parseInt(r.edad) || null,
          r.fechaIngreso || '',
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
          r.sedeTrabajo || 'CASA DE LA TORRE',
          upper(r.cargo || 'PROFESIONAL UNIVERSITARIO'),
          fechaEmo,
          r.tipoEmo || 'Periódico',
          r.restricciones || 'NINGUNA',
          r.recomendaciones || 'Pausas activas',
          r.direccionadoPve || 'No aplica',
          r.direccionadoEps || 'No aplica',
          fechaProx,
          upper(r.accidenteTrabajo || 'NO'),
          upper(r.enfermedadLaboral || 'NO'),
          r.estadoFinalCaso || 'Vigente',
          r.actividadesPendientes || '',
          req.user.username || 'admin'
        ]
      );
      inserted++;
    }
    await client.query('COMMIT');
    res.json({ message: `Se importaron ${inserted} registros al Perfil Epidemiológico.`, inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de Perfil Epidemiológico.' });
  } finally {
    client.release();
  }
});

router.delete('/epidemiologico/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  try {
    const r = await pool.query('DELETE FROM sst_perfil_epidemiologico WHERE id_epidemiologico=$1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ message: 'Registro eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar registro.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 2: ENTREGA DE EPP (Formato E-DO-ST-F-028 V4)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/epp', auth, async (req, res) => {
  const { q = '', elemento = '', estado = '', dependencia = '', page = 1, limit = 20 } = req.query;
  try {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (elemento && elemento !== 'Todos') {
      conditions.push(`(codigo_elemento = $${idx} OR LOWER(elemento_epp) LIKE LOWER($${idx + 1}))`);
      params.push(elemento.trim(), `%${elemento.trim()}%`);
      idx += 2;
    }
    if (estado && estado !== 'Todos') {
      conditions.push(`LOWER(estado_entrega) = LOWER($${idx++})`);
      params.push(estado.trim());
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(elemento_epp) LIKE LOWER($${idx})
        OR LOWER(dependencia) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_entrega_epp WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_entrega_epp WHERE ${where} ORDER BY id_entrega_epp DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_entrega_epp,
        radicado: `EPP-2026-${String(r.id_entrega_epp).padStart(4, '0')}`,
        documento: r.documento,
        nombreCompleto: r.nombre_completo,
        telefono: r.telefono,
        secretaria: r.secretaria,
        dependencia: r.dependencia,
        sedeTrabajo: r.sede_trabajo,
        cargo: r.cargo,
        tipoVinculacion: r.tipo_vinculacion,
        restriccionesRecomendaciones: r.restricciones_recomendaciones,
        codigoElemento: r.codigo_elemento,
        elementoEpp: r.elemento_epp,
        talla: r.talla,
        cantidad: r.cantidad,
        fechaEntrega: r.fecha_entrega ? r.fecha_entrega.toISOString().split('T')[0] : '',
        estadoEntrega: r.estado_entrega,
        firmadoFuncionario: r.firmado_funcionario,
        observaciones: r.observaciones,
        soporte: r.soporte
      })),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum))
    });
  } catch (err) {
    console.error('[sst-service] list epp error:', err.message);
    res.status(500).json({ error: 'Error al listar entregas de EPP.' });
  }
});

router.post('/epp', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const b = req.body;
  if (!b.documento || !b.nombreCompleto) {
    return res.status(400).json({ error: 'Documento y nombre completo son obligatorios.' });
  }

  const resolved = resolveEppItem(b.elementoEpp || b.codigoElemento);
  const fechaEntrega = toIsoDateOrNull(b.fechaEntrega) || new Date().toISOString().split('T')[0];

  try {
    const r = await pool.query(
      `INSERT INTO sst_entrega_epp (
        documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo,
        cargo, tipo_vinculacion, restricciones_recomendaciones, codigo_elemento,
        elemento_epp, talla, cantidad, fecha_entrega, estado_entrega,
        firmado_funcionario, observaciones, soporte, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id_entrega_epp`,
      [
        String(b.documento).trim(),
        upper(b.nombreCompleto),
        b.telefono || '',
        upper(b.secretaria || 'SECRETARIA GENERAL'),
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || 'PROFESIONAL UNIVERSITARIO'),
        upper(b.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
        b.restriccionesRecomendaciones || 'NINGUNA',
        resolved.codigo,
        resolved.nombre,
        upper(b.talla || 'N/A'),
        upper(b.cantidad || '1 UNIDAD'),
        fechaEntrega,
        b.estadoEntrega || 'Entregado',
        b.firmadoFuncionario !== false,
        b.observaciones || '',
        b.soporte || null,
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_entrega_epp;
    res.status(201).json({
      message: 'Entrega de EPP registrada exitosamente.',
      id: newId,
      radicado: `EPP-2026-${String(newId).padStart(4, '0')}`
    });
  } catch (err) {
    console.error('[sst-service] create epp error:', err.message);
    res.status(500).json({ error: 'Error al registrar entrega de EPP.' });
  }
});

router.put('/epp/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  const b = req.body;
  const resolved = resolveEppItem(b.elementoEpp || b.codigoElemento);
  const fechaEntrega = toIsoDateOrNull(b.fechaEntrega) || new Date().toISOString().split('T')[0];

  try {
    const r = await pool.query(
      `UPDATE sst_entrega_epp SET
        documento=$1, nombre_completo=$2, telefono=$3, secretaria=$4, dependencia=$5,
        sede_trabajo=$6, cargo=$7, tipo_vinculacion=$8, restricciones_recomendaciones=$9,
        codigo_elemento=$10, elemento_epp=$11, talla=$12, cantidad=$13, fecha_entrega=$14,
        estado_entrega=$15, firmado_funcionario=$16, observaciones=$17,
        soporte=COALESCE($18, soporte)
       WHERE id_entrega_epp=$19 RETURNING id_entrega_epp`,
      [
        String(b.documento || '').trim(),
        upper(b.nombreCompleto),
        b.telefono || '',
        upper(b.secretaria || 'SECRETARIA GENERAL'),
        b.dependencia || '',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || ''),
        upper(b.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
        b.restriccionesRecomendaciones || 'NINGUNA',
        resolved.codigo,
        resolved.nombre,
        upper(b.talla || 'N/A'),
        upper(b.cantidad || '1 UNIDAD'),
        fechaEntrega,
        b.estadoEntrega || 'Entregado',
        b.firmadoFuncionario !== false,
        b.observaciones || '',
        b.soporte !== undefined ? b.soporte : null,
        id
      ]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Entrega de EPP no encontrada.' });
    res.json({ message: 'Entrega de EPP actualizada.' });
  } catch (err) {
    console.error('[sst-service] update epp error:', err.message);
    res.status(500).json({ error: 'Error al actualizar entrega de EPP.' });
  }
});

router.post('/epp/bulk', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      const doc = String(r.documento || '').trim();
      const nom = upper(r.nombreCompleto || '');
      if (!doc || !nom) continue;
      const resolved = resolveEppItem(r.elementoEpp || r.codigoElemento);
      const fechaEntrega = toIsoDateOrNull(r.fechaEntrega) || new Date().toISOString().split('T')[0];

      await client.query(
        `INSERT INTO sst_entrega_epp (
          documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo,
          cargo, tipo_vinculacion, restricciones_recomendaciones, codigo_elemento,
          elemento_epp, talla, cantidad, fecha_entrega, estado_entrega, observaciones, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          doc, nom, r.telefono || '', upper(r.secretaria || 'SECRETARIA GENERAL'),
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)', r.sedeTrabajo || 'CASA DE LA TORRE',
          upper(r.cargo || 'PROFESIONAL UNIVERSITARIO'), upper(r.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
          r.restriccionesRecomendaciones || 'NINGUNA', resolved.codigo, resolved.nombre,
          upper(r.talla || 'N/A'), upper(r.cantidad || '1 UNIDAD'), fechaEntrega,
          r.estadoEntrega || 'Entregado', r.observaciones || '', req.user.username || 'admin'
        ]
      );
      inserted++;
    }
    await client.query('COMMIT');
    res.json({ message: `Se importaron ${inserted} entregas de EPP exitosamente.`, inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de EPP.' });
  } finally {
    client.release();
  }
});

router.delete('/epp/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  try {
    const r = await pool.query('DELETE FROM sst_entrega_epp WHERE id_entrega_epp=$1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ message: 'Registro de EPP eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar entrega de EPP.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 3: PERFIL SOCIODEMOGRÁFICO (Formato E-DO-ST-F-011 V5)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/sociodemografico', auth, async (req, res) => {
  const { q = '', escolaridad = '', tipoVinculacion = '', dependencia = '', page = 1, limit = 20 } = req.query;
  try {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (escolaridad && escolaridad !== 'Todas') {
      conditions.push(`LOWER(escolaridad) = LOWER($${idx++})`);
      params.push(escolaridad.trim());
    }
    if (tipoVinculacion && tipoVinculacion !== 'Todos') {
      conditions.push(`LOWER(tipo_vinculacion) = LOWER($${idx++})`);
      params.push(tipoVinculacion.trim());
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(dependencia) LIKE LOWER($${idx})
        OR LOWER(COALESCE(ocupacion_profesion, '')) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_perfil_sociodemografico WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_perfil_sociodemografico WHERE ${where} ORDER BY id_sociodemografico DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_sociodemografico,
        radicado: `SOC-2026-${String(r.id_sociodemografico).padStart(4, '0')}`,
        tipoIdentificacion: r.tipo_identificacion,
        documento: r.documento,
        apellidos: r.apellidos,
        nombres: r.nombres,
        nombreCompleto: r.nombre_completo,
        sexo: r.sexo,
        anioNacimiento: r.anio_nacimiento,
        edad: r.edad,
        razaEtnia: r.raza_etnia,
        estadoCivil: r.estado_civil,
        composicionFamiliar: r.composicion_familiar,
        tipoVivienda: r.tipo_vivienda,
        estrato: r.estrato,
        municipioResidencia: r.municipio_residencia,
        municipioTrabajo: r.municipio_trabajo,
        escolaridad: r.escolaridad,
        ocupacionProfesion: r.ocupacion_profesion,
        rangoIngresos: r.rango_ingresos,
        denominacionCargo: r.denominacion_cargo,
        tipoCargo: r.tipo_cargo,
        tipoVinculacion: r.tipo_vinculacion,
        antiguedadCargo: r.antiguedad_cargo,
        antiguedadEntidad: r.antiguedad_entidad,
        dependencia: r.dependencia,
        sedeTrabajo: r.sede_trabajo
      })),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum))
    });
  } catch (err) {
    console.error('[sst-service] list sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al listar el Perfil Sociodemográfico.' });
  }
});

router.post('/sociodemografico', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const b = req.body;
  if (!b.documento || (!b.nombreCompleto && (!b.apellidos || !b.nombres))) {
    return res.status(400).json({ error: 'Documento y nombre son obligatorios.' });
  }

  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const currentYear = new Date().getFullYear();
  const anioNac = parseInt(b.anioNacimiento) || null;
  const edad = parseInt(b.edad) || (anioNac ? currentYear - anioNac : null);

  try {
    const r = await pool.query(
      `INSERT INTO sst_perfil_sociodemografico (
        tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
        anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
        tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
        escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
        tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
        dependencia, sede_trabajo, creado_por
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING id_sociodemografico`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento).trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.sexo || 'Masculino',
        anioNac,
        edad,
        b.razaEtnia || 'Blanco/Mestizo',
        b.estadoCivil || 'Soltero (a)',
        b.composicionFamiliar || 'Conyuge Permanente, Hijos',
        b.tipoVivienda || 'Arriendo',
        String(b.estrato || '3'),
        b.municipioResidencia || 'Tunja',
        b.municipioTrabajo || 'Tunja',
        b.escolaridad || 'Profesional',
        b.ocupacionProfesion || '',
        b.rangoIngresos || 'Entre 3 y 6 SMMLV',
        b.denominacionCargo || 'Profesional Universitario',
        b.tipoCargo || 'Profesional',
        b.tipoVinculacion || 'Carrera Administrativa',
        b.antiguedadCargo || 'Entre 1 y 4 años',
        b.antiguedadEntidad || 'Entre 1 y 4 años',
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_sociodemografico;
    res.status(201).json({
      message: 'Perfil Sociodemográfico registrado exitosamente.',
      id: newId,
      radicado: `SOC-2026-${String(newId).padStart(4, '0')}`
    });
  } catch (err) {
    console.error('[sst-service] create sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al registrar Perfil Sociodemográfico.' });
  }
});

router.put('/sociodemografico/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  const b = req.body;
  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const currentYear = new Date().getFullYear();
  const anioNac = parseInt(b.anioNacimiento) || null;
  const edad = parseInt(b.edad) || (anioNac ? currentYear - anioNac : null);

  try {
    const r = await pool.query(
      `UPDATE sst_perfil_sociodemografico SET
        tipo_identificacion=$1, documento=$2, apellidos=$3, nombres=$4, nombre_completo=$5,
        sexo=$6, anio_nacimiento=$7, edad=$8, raza_etnia=$9, estado_civil=$10,
        composicion_familiar=$11, tipo_vivienda=$12, estrato=$13, municipio_residencia=$14,
        municipio_trabajo=$15, escolaridad=$16, ocupacion_profesion=$17, rango_ingresos=$18,
        denominacion_cargo=$19, tipo_cargo=$20, tipo_vinculacion=$21, antiguedad_cargo=$22,
        antiguedad_entidad=$23, dependencia=$24, sede_trabajo=$25, actualizado_en=CURRENT_TIMESTAMP
       WHERE id_sociodemografico=$26 RETURNING id_sociodemografico`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento || '').trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.sexo || 'Masculino',
        anioNac,
        edad,
        b.razaEtnia || 'Blanco/Mestizo',
        b.estadoCivil || 'Soltero (a)',
        b.composicionFamiliar || '',
        b.tipoVivienda || 'Arriendo',
        String(b.estrato || '3'),
        b.municipioResidencia || 'Tunja',
        b.municipioTrabajo || 'Tunja',
        b.escolaridad || 'Profesional',
        b.ocupacionProfesion || '',
        b.rangoIngresos || 'Entre 3 y 6 SMMLV',
        b.denominacionCargo || '',
        b.tipoCargo || 'Profesional',
        b.tipoVinculacion || 'Carrera Administrativa',
        b.antiguedadCargo || 'Entre 1 y 4 años',
        b.antiguedadEntidad || 'Entre 1 y 4 años',
        b.dependencia || '',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        id
      ]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ message: 'Perfil Sociodemográfico actualizado.' });
  } catch (err) {
    console.error('[sst-service] update sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al actualizar Perfil Sociodemográfico.' });
  }
});

router.post('/sociodemografico/bulk', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const currentYear = new Date().getFullYear();
    for (const r of rows) {
      const doc = String(r.documento || '').trim();
      const nom = upper(r.nombreCompleto || `${r.apellidos || ''} ${r.nombres || ''}`.trim());
      if (!doc || !nom) continue;
      const anioNac = parseInt(r.anioNacimiento) || null;
      const edad = parseInt(r.edad) || (anioNac ? currentYear - anioNac : null);

      await client.query(
        `INSERT INTO sst_perfil_sociodemografico (
          tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
          anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
          tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
          escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
          tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
          dependencia, sede_trabajo, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          r.tipoIdentificacion || 'Cédula de Ciudadanía',
          doc,
          upper(r.apellidos || nom.split(' ').slice(0, 2).join(' ')),
          upper(r.nombres || nom.split(' ').slice(2).join(' ') || nom),
          nom,
          r.sexo || 'Masculino',
          anioNac,
          edad,
          r.razaEtnia || 'Blanco/Mestizo',
          r.estadoCivil || 'Soltero (a)',
          r.composicionFamiliar || 'Conyuge Permanente, Hijos',
          r.tipoVivienda || 'Arriendo',
          String(r.estrato || '3'),
          r.municipioResidencia || 'Tunja',
          r.municipioTrabajo || 'Tunja',
          r.escolaridad || 'Profesional',
          r.ocupacionProfesion || '',
          r.rangoIngresos || 'Entre 3 y 6 SMMLV',
          r.denominacionCargo || 'Profesional Universitario',
          r.tipoCargo || 'Profesional',
          r.tipoVinculacion || 'Carrera Administrativa',
          r.antiguedadCargo || 'Entre 1 y 4 años',
          r.antiguedadEntidad || 'Entre 1 y 4 años',
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
          r.sedeTrabajo || 'CASA DE LA TORRE',
          req.user.username || 'admin'
        ]
      );
      inserted++;
    }
    await client.query('COMMIT');
    res.json({ message: `Se importaron ${inserted} registros al Perfil Sociodemográfico.`, inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de Perfil Sociodemográfico.' });
  } finally {
    client.release();
  }
});

router.delete('/sociodemografico/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  try {
    const r = await pool.query('DELETE FROM sst_perfil_sociodemografico WHERE id_sociodemografico=$1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ message: 'Registro sociodemográfico eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar registro sociodemográfico.' });
  }
});

module.exports = router;
