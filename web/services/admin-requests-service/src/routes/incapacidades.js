/* ═══════════════════════════════════════════════════════════════════════════
   routes/incapacidades.js — Módulo General de Incapacidades y Ausentismo SST
   Formato Oficial: E-DO-ST-F-002 Versión 2 (9. INCAPACIDADES SST)
   Gobernación de Boyacá · Talento 360
   ═══════════════════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { Pool } = require('pg');
const trackImport = require('../utils/importHistory');
const cat    = require('../catalogs/incapacidades');
const {
  ensureAuditAndRbacSchema,
  getModulePermission,
  isSelfRequest,
  logAudit,
} = require('../utils/audit-rbac');

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
  const token = (req.headers.authorization || req.query.token || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido.' }); }
}

function clean(v) {
  return v == null ? '' : String(v).trim().replace(/\s+/g, ' ');
}

function upper(v) {
  return clean(v).toUpperCase();
}

function normalizeStatus(s) {
  if (!s) return 'Pendiente';
  const e = String(s).trim().toLowerCase();
  if (e.includes('aprobad')) return 'Aprobada';
  if (e.includes('finaliz')) return 'Finalizada';
  if (e.includes('rechazad')) return 'Rechazada';
  if (e.includes('revis')) return 'En revisión';
  return 'Pendiente';
}

function todayDMY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateDMY(raw) {
  const s = clean(raw);
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${String(m[3]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${m[1]}`;
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
  if (m) return `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${m[3]}`;
  return s;
}

function parseDMY(dmy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(dmy));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function calcDaysBetween(fiDMY, ffDMY, fallback = 1) {
  const d1 = parseDMY(fiDMY);
  const d2 = parseDMY(ffDMY);
  if (!d1 || !d2 || d2.getTime() < d1.getTime()) return Math.max(1, parseInt(fallback) || 1);
  return Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function calcularDescuento(salarioNum, diasNum, prorrogaStr, causaStr) {
  const sal = parseFloat(salarioNum) || 0;
  const dias = Math.max(1, parseInt(diasNum) || 1);
  if (sal <= 0) return 0;
  const c = clean(causaStr).toLowerCase();
  const isProrroga = upper(prorrogaStr) === 'SI' || upper(prorrogaStr) === 'SÍ';
  const valorDia = sal / 30;

  // Licencia de maternidad / Accidente de trabajo / Enfermedad laboral: 100% sobre días
  if (c.includes('maternidad') || c.includes('accidente') || c.includes('laboral')) {
    return Math.round(valorDia * dias * 100) / 100;
  }

  // Enfermedad general:
  // Si NO es prórroga: primeros 2 días los asume la entidad (0 descuento); del día 3 en adelante 1/3 del valor día.
  // Si SÍ es prórroga: todos los días tienen descuento de 1/3 del valor día.
  if (c.includes('enfermedad general') || !c) {
    if (isProrroga) {
      return Math.round(((valorDia * dias) / 3) * 100) / 100;
    }
    if (dias <= 2) return 0;
    return Math.round(((valorDia * (dias - 2)) / 3) * 100) / 100;
  }

  // Otras causas (ausencias no remuneradas / suspensiones): proporcional a días si aplica
  if (c.includes('no remunerada') || c.includes('suspensi')) {
    return Math.round(valorDia * dias * 100) / 100;
  }

  return 0;
}

function sniffMime(buf) {
  if (buf.length >= 4 && buf.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  return null;
}

function parseSoportes(list, keptCount = 0) {
  if (list == null) return { soportes: [] };
  if (!Array.isArray(list)) return { error: 'Formato de soportes inválido.' };
  if (keptCount + list.length > cat.SOPORTES.maxArchivos) {
    return { error: `Máximo ${cat.SOPORTES.maxArchivos} soportes por incapacidad.` };
  }
  const soportes = [];
  for (const f of list) {
    const nombre = clean((f && f.nombre) || '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 200);
    const b64 = String((f && (f.base64 || f.contenidoBase64)) || '').replace(/^data:[^;]+;base64,/, '');
    if (!nombre || !b64) return { error: 'Uno de los soportes está vacío o sin nombre.' };
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return { error: `El soporte «${nombre}» está vacío.` };
    if (buffer.length > cat.SOPORTES.maxBytes) {
      return { error: `El soporte «${nombre}» supera el límite de 5 MB.` };
    }
    const tipo = sniffMime(buffer);
    if (!tipo || !cat.SOPORTES.tipos.includes(tipo)) {
      return { error: `El soporte «${nombre}» debe ser un archivo PDF, JPG o PNG válido.` };
    }
    soportes.push({ nombre, tipo, buffer });
  }
  return { soportes };
}

async function insertSoportes(client, idSolicitud, soportes, username) {
  for (const s of soportes) {
    await client.query(
      `INSERT INTO solicitudes_admin_soportes(id_solicitud,nombre_archivo,tipo_mime,tamano_bytes,contenido,subido_por)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [idSolicitud, s.nombre, s.tipo, s.buffer.length, s.buffer, username || 'web']
    );
  }
}

// ─── Auto-migración e inicialización de datos del Formato 9. INCAPACIDADES SST ─
const SCHEMA_SQL = `
  ALTER TABLE solicitudes_admin
    ADD COLUMN IF NOT EXISTS fecha_radicacion    VARCHAR(40),
    ADD COLUMN IF NOT EXISTS sede                VARCHAR(280),
    ADD COLUMN IF NOT EXISTS eps                 VARCHAR(120),
    ADD COLUMN IF NOT EXISTS prorroga            VARCHAR(10),
    ADD COLUMN IF NOT EXISTS causa_motivo        VARCHAR(160),
    ADD COLUMN IF NOT EXISTS codigo_cie10        VARCHAR(40),
    ADD COLUMN IF NOT EXISTS salario             NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS descuento           NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS acto_administrativo VARCHAR(120),
    ADD COLUMN IF NOT EXISTS registrado_por      VARCHAR(120),
    ADD COLUMN IF NOT EXISTS correo_solicitante  VARCHAR(200);
  CREATE TABLE IF NOT EXISTS solicitudes_admin_soportes (
    id_soporte     SERIAL PRIMARY KEY,
    id_solicitud   INTEGER NOT NULL REFERENCES solicitudes_admin(id_solicitud) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime      VARCHAR(80)  NOT NULL,
    tamano_bytes   INTEGER      NOT NULL,
    contenido      BYTEA        NOT NULL,
    subido_por     VARCHAR(120),
    creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sol_admin_soportes_sol ON solicitudes_admin_soportes(id_solicitud);
`;

const EXCEL_SEED_ROWS = [
  {
    fecha_radicacion: '01/09/2026',
    persona: 'YANIRA GUARNIZO MANRIQUE',
    documento: '65776381',
    dependencia: 'SPLA - Dirección de Seguimiento y Planeación Territorial',
    sede: 'EDIFICIO INTELIGENTE - BICENTENARIO',
    cargo: 'PROFESIONAL UNIVERSITARIO (E)',
    eps: 'SANITAS',
    fecha_inicio: '18/08/2026',
    fecha_fin: '31/08/2026',
    prorroga: 'NO',
    causa_motivo: 'Enfermedad general',
    codigo_cie10: 'M797',
    dias: 14,
    salario: 7258783,
    descuento: 967837.73,
    acto_administrativo: '1107',
    motivo: 'Incapacidad médica por Enfermedad general (Diagnóstico CIE-10: M797)',
    estado: 'Aprobada',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1107'
  },
  {
    fecha_radicacion: '11/09/2026',
    persona: 'DIANA PATRICIA MONSALVE VALDERRAMA',
    documento: '1052384533',
    dependencia: 'SHAC - DPP - Subdirección Jurídica de Pasivos Pensionales',
    sede: 'FONDO TERRITORIAL DE PENSIONES DE BOYACÁ.',
    cargo: 'SUBDIRECTOR TECNICO',
    eps: 'NUEVA EPS',
    fecha_inicio: '29/08/2026',
    fecha_fin: '01/01/2027',
    prorroga: 'NO',
    causa_motivo: 'Licencia de maternidad',
    codigo_cie10: 'O800',
    dias: 126,
    salario: 11376768,
    descuento: 11376768,
    acto_administrativo: '1145',
    motivo: 'Licencia de maternidad (Diagnóstico CIE-10: O800)',
    estado: 'Aprobada',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1145'
  },
  {
    fecha_radicacion: '11/09/2026',
    persona: 'RODRIGO MAURICIO OCHOA SUAREZ',
    documento: '7180397',
    dependencia: 'DES - Unidad Administrativa de Comunicaciones y Protocolo',
    sede: 'PALACIO DE LA TORRE - CENTRO',
    cargo: 'PROFESIONAL UNIVERSITARIO',
    eps: 'SANITAS',
    fecha_inicio: '08/09/2026',
    fecha_fin: '10/09/2026',
    prorroga: 'NO',
    causa_motivo: 'Enfermedad general',
    codigo_cie10: 'I209',
    dias: 3,
    salario: 7258783,
    descuento: 80653.14,
    acto_administrativo: '1146',
    motivo: 'Incapacidad médica por Enfermedad general (Diagnóstico CIE-10: I209)',
    estado: 'Aprobada',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1146'
  },
  {
    fecha_radicacion: '17/09/2026',
    persona: 'NANCY CAROLINA HERNANDEZ',
    documento: '23810627',
    dependencia: 'SSAL - Dirección de Prestación de Servicios de Salud',
    sede: 'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.',
    cargo: 'PROFESIONAL UNIVERSITARIO',
    eps: 'SANITAS',
    fecha_inicio: '14/09/2026',
    fecha_fin: '19/09/2026',
    prorroga: 'NO',
    causa_motivo: 'Enfermedad general',
    codigo_cie10: 'R103',
    dias: 3,
    salario: 6144660,
    descuento: 68274,
    acto_administrativo: '1163',
    motivo: 'Incapacidad médica por Enfermedad general (Diagnóstico CIE-10: R103)',
    estado: 'Aprobada',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1163'
  },
  {
    fecha_radicacion: '25/09/2026',
    persona: 'CARLOS IVAN CORREDOR DIAZ',
    documento: '74362815',
    dependencia: 'SGEN - Dirección de Servicios Administrativos y Logísticos',
    sede: 'PARQUEADERO DEL DEPARTAMENTO.',
    cargo: 'CONDUCTOR',
    eps: 'ADRES',
    fecha_inicio: '12/09/2026',
    fecha_fin: '19/09/2026',
    prorroga: 'NO',
    causa_motivo: 'Enfermedad general',
    codigo_cie10: 'S829',
    dias: 8,
    salario: 3848492,
    descuento: 256566.13,
    acto_administrativo: '1190',
    motivo: 'Incapacidad médica por Enfermedad general (Diagnóstico CIE-10: S829)',
    estado: 'Aprobada',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1190'
  },
  {
    fecha_radicacion: '25/09/2026',
    persona: 'CARLOS IVAN CORREDOR DIAZ',
    documento: '74362815',
    dependencia: 'SGEN - Dirección de Servicios Administrativos y Logísticos',
    sede: 'PARQUEADERO DEL DEPARTAMENTO.',
    cargo: 'CONDUCTOR',
    eps: 'ADRES',
    fecha_inicio: '19/09/2026',
    fecha_fin: '18/10/2026',
    prorroga: 'SI',
    causa_motivo: 'Enfermedad general',
    codigo_cie10: 'S829',
    dias: 30,
    salario: 3848492,
    descuento: 1282830.67,
    acto_administrativo: '1191',
    motivo: 'Prórroga de incapacidad por Enfermedad general (Diagnóstico CIE-10: S829)',
    estado: 'En revisión',
    observaciones: 'Registro oficial Formato E-DO-ST-F-002 Septiembre 2026 - Acto Adm. 1191 (Prórroga)'
  }
];

let schemaPromise = null;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(SCHEMA_SQL);
      await ensureAuditAndRbacSchema(pool);
      // Normalizar filas antiguas de Incapacidad que aún no tengan campos SST
      await pool.query(`
        UPDATE solicitudes_admin
        SET fecha_radicacion = COALESCE(NULLIF(fecha_radicacion, ''), fecha_solicitud, '01/09/2026'),
            prorroga         = COALESCE(NULLIF(prorroga, ''), 'NO'),
            causa_motivo     = COALESCE(NULLIF(causa_motivo, ''), 'Enfermedad general'),
            eps              = COALESCE(NULLIF(eps, ''), 'SANITAS'),
            sede             = COALESCE(NULLIF(sede, ''), 'EDIFICIO LOTERÍA DE BOYACÁ')
        WHERE tipo = 'Incapacidad' AND (causa_motivo IS NULL OR causa_motivo = '');
      `);
      // Insertar los 6 registros reales de 9. INCAPACIDADES SST si aún no existen
      for (const s of EXCEL_SEED_ROWS) {
        const exists = await pool.query(
          `SELECT 1 FROM solicitudes_admin WHERE tipo = 'Incapacidad' AND acto_administrativo = $1 LIMIT 1`,
          [s.acto_administrativo]
        );
        if (!exists.rows.length) {
          await pool.query(
            `INSERT INTO solicitudes_admin(
               tipo, fecha_radicacion, fecha_solicitud, apellidos_nombres, documento,
               dependencia, sede, cargo, eps, fecha_inicio, fecha_fin, prorroga,
               causa_motivo, codigo_cie10, dias_solicitados, salario, descuento,
               acto_administrativo, motivo, estado, observaciones
             ) VALUES (
               'Incapacidad', $1, $1, $2, $3,
               $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15,
               $16, $17, $18, $19
             )`,
            [
              s.fecha_radicacion, s.persona, s.documento,
              s.dependencia, s.sede, s.cargo, s.eps, s.fecha_inicio, s.fecha_fin, s.prorroga,
              s.causa_motivo, s.codigo_cie10, s.dias, s.salario, s.descuento,
              s.acto_administrativo, s.motivo, s.estado, s.observaciones
            ]
          );
        }
      }
    })().catch(err => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

router.use(async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    console.error('[incapacidades] schema error:', err.message);
    res.status(503).json({ error: 'Base de datos inicializándose, intente nuevamente.' });
  }
});

function mapRow(r) {
  const salario = r.salario != null ? Number(r.salario) : 0;
  const descuento = r.descuento != null ? Number(r.descuento) : 0;
  return {
    id: r.id_solicitud,
    radicado: `INC-2026-${String(r.id_solicitud).padStart(5, '0')}`,
    tipo: 'Incapacidad',
    fechaRadicacion: r.fecha_radicacion || r.fecha_solicitud || '',
    fechaSolicitud: r.fecha_solicitud || r.fecha_radicacion || '',
    persona: upper(r.apellidos_nombres),
    apellidosNombres: upper(r.apellidos_nombres),
    documento: clean(r.documento),
    dependencia: clean(r.dependencia),
    sede: clean(r.sede),
    cargo: upper(r.cargo),
    eps: upper(r.eps),
    fechaInicio: clean(r.fecha_inicio),
    fechaFin: clean(r.fecha_fin),
    prorroga: upper(r.prorroga || 'NO') === 'SI' ? 'SI' : 'NO',
    causaMotivo: clean(r.causa_motivo || 'Enfermedad general'),
    codigoCie10: upper(r.codigo_cie10),
    dias: parseInt(r.dias_solicitados) || 1,
    diasSolicitados: parseInt(r.dias_solicitados) || 1,
    salario,
    descuento,
    actoAdministrativo: clean(r.acto_administrativo),
    motivo: clean(r.motivo),
    observaciones: clean(r.observaciones),
    estado: normalizeStatus(r.estado),
    aprobadoPor: clean(r.aprobado_por),
    notaGestion: clean(r.nota_gestion),
    soportesCount: r.soportes_count == null ? 0 : parseInt(r.soportes_count),
    creadoEn: r.creado_en
  };
}

// Expresión SQL para convertir fecha_inicio (DD/MM/YYYY o YYYY-MM-DD) a DATE
const SQL_FECHA_INICIO_DATE = `
  CASE
    WHEN s.fecha_inicio ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN TO_DATE(s.fecha_inicio, 'DD/MM/YYYY')
    WHEN s.fecha_inicio ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'  THEN TO_DATE(SUBSTRING(s.fecha_inicio, 1, 10), 'YYYY-MM-DD')
    ELSE s.creado_en::date
  END
`;
const SQL_FECHA_FIN_DATE = `
  CASE
    WHEN s.fecha_fin ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN TO_DATE(s.fecha_fin, 'DD/MM/YYYY')
    WHEN s.fecha_fin ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'  THEN TO_DATE(SUBSTRING(s.fecha_fin, 1, 10), 'YYYY-MM-DD')
    ELSE s.creado_en::date
  END
`;

// ─── GET /api/incapacidades/catalogs ──────────────────────────────────────────
router.get('/catalogs', auth, (_req, res) => {
  res.json({
    dependencias: cat.DEPENDENCIAS,
    sedes: cat.SEDES,
    causas: cat.CAUSAS_MOTIVOS,
    causasMotivos: cat.CAUSAS_MOTIVOS,
    epsList: cat.EPS_LIST,
    prorrogas: cat.PRORROGA_OPTS,
    prorrogaOpts: cat.PRORROGA_OPTS,
    soportes: cat.SOPORTES
  });
});

// ─── GET /api/incapacidades/stats (Dashboard 6.3 Incapacidades) ───────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const { anio = '', mes = '', fechaInicio = '', fechaFin = '', dependencia = '' } = req.query;
    const perm = await getModulePermission(pool, req.user, 'incapacidades');

    const conds = [`s.tipo = 'Incapacidad'`];
    const vals = [];
    let i = 1;

    if (!perm.canManage) {
      const uname = String(req.user.username || '').trim().toLowerCase();
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      conds.push(`(
        LOWER(COALESCE(s.apellidos_nombres, '')) = $${i}
        OR LOWER(COALESCE(s.registrado_por, '')) = $${i + 1}
        OR LOWER(COALESCE(s.correo_solicitante, '')) = $${i + 1}
        OR ($${i + 2} <> '' AND s.documento = $${i + 2})
      )`);
      vals.push(fullName, uname, userDoc);
      i += 3;
    }

    if (anio && anio !== 'Todos') {
      conds.push(`EXTRACT(YEAR FROM (${SQL_FECHA_INICIO_DATE}))::text = $${i++}`);
      vals.push(String(anio));
    }
    if (mes && mes !== 'Todos') {
      conds.push(`EXTRACT(MONTH FROM (${SQL_FECHA_INICIO_DATE}))::int = $${i++}`);
      vals.push(parseInt(mes, 10));
    }
    if (fechaInicio) {
      conds.push(`(${SQL_FECHA_INICIO_DATE}) >= $${i++}::date`);
      vals.push(fechaInicio);
    }
    if (fechaFin) {
      conds.push(`(${SQL_FECHA_INICIO_DATE}) <= $${i++}::date`);
      vals.push(fechaFin);
    }
    if (dependencia && dependencia !== 'Todas') {
      conds.push(`LOWER(s.dependencia) LIKE LOWER($${i++})`);
      vals.push(`%${dependencia}%`);
    }

    const where = conds.join(' AND ');

    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.estado = 'Pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE s.estado = 'En revisión')::int AS revision,
        COUNT(*) FILTER (WHERE s.estado IN ('Aprobada', 'Finalizada'))::int AS aprobadas,
        COUNT(*) FILTER (WHERE s.estado = 'Rechazada')::int AS rechazadas,
        COUNT(*) FILTER (
          WHERE s.estado IN ('Pendiente', 'En revisión')
             OR (s.estado = 'Aprobada' AND (${SQL_FECHA_FIN_DATE}) >= CURRENT_DATE)
        )::int AS activas,
        COUNT(*) FILTER (
          WHERE s.estado = 'Finalizada'
             OR (s.estado = 'Aprobada' AND (${SQL_FECHA_FIN_DATE}) < CURRENT_DATE)
        )::int AS finalizadas,
        COALESCE(SUM(s.dias_solicitados), 0)::int AS total_dias,
        COALESCE(SUM(s.descuento), 0)::numeric AS total_descuento,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(s.prorroga, 'NO')) = 'SI')::int AS prorrogas
      FROM solicitudes_admin s
      WHERE ${where}
    `, vals);

    const porCausaQ = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(s.causa_motivo), ''), 'Enfermedad general') AS causa,
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(s.dias_solicitados), 0)::int AS dias,
        COALESCE(SUM(s.descuento), 0)::numeric(15,2) AS descuento
      FROM solicitudes_admin s
      WHERE ${where}
      GROUP BY 1
      ORDER BY cantidad DESC, dias DESC
    `, vals);

    const porDepQ = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(s.dependencia), ''), 'SIN DEPENDENCIA') AS dependencia,
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(s.dias_solicitados), 0)::int AS dias
      FROM solicitudes_admin s
      WHERE ${where}
      GROUP BY 1
      ORDER BY dias DESC, cantidad DESC
      LIMIT 10
    `, vals);

    const porEpsQ = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(s.eps), ''), 'SIN EPS') AS eps,
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(s.dias_solicitados), 0)::int AS dias
      FROM solicitudes_admin s
      WHERE ${where}
      GROUP BY 1
      ORDER BY cantidad DESC
      LIMIT 8
    `, vals);

    const evolucionQ = await pool.query(`
      SELECT
        TO_CHAR((${SQL_FECHA_INICIO_DATE}), 'YYYY-MM') AS mes,
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(s.dias_solicitados), 0)::int AS dias,
        COALESCE(SUM(s.descuento), 0)::numeric(15,2) AS descuento
      FROM solicitudes_admin s
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 12
    `, vals);

    // Detección de acumulación de ausentismo médico >= 90 días (INC-ALRT-001 / INC-ALRT-002)
    const alertas90Q = await pool.query(`
      SELECT
        s.documento,
        s.apellidos_nombres AS persona,
        s.dependencia,
        SUM(s.dias_solicitados)::int AS total_dias_acum,
        COUNT(*)::int AS total_incapacidades
      FROM solicitudes_admin s
      WHERE ${where}
      GROUP BY s.documento, s.apellidos_nombres, s.dependencia
      HAVING SUM(s.dias_solicitados) >= 90
      ORDER BY total_dias_acum DESC
    `, vals);

    const row = r.rows[0] || {};
    res.json({
      total: row.total || 0,
      pendientes: (row.pendientes || 0) + (row.revision || 0),
      revision: row.revision || 0,
      aprobadas: row.aprobadas || 0,
      rechazadas: row.rechazadas || 0,
      activas: row.activas || 0,
      finalizadas: row.finalizadas || 0,
      totalDias: row.total_dias || 0,
      totalDescuento: parseFloat(row.total_descuento) || 0,
      prorrogas: row.prorrogas || 0,
      alertas90Dias: alertas90Q.rows.length,
      hasAlert90: alertas90Q.rows.length > 0,
      casosAlerta90: alertas90Q.rows.map(c => ({
        documento: c.documento,
        persona: c.persona,
        dependencia: c.dependencia,
        totalDiasAcum: c.total_dias_acum,
        totalIncapacidades: c.total_incapacidades,
      })),
      porCausa: porCausaQ.rows,
      porDependencia: porDepQ.rows,
      porEps: porEpsQ.rows,
      evolucionMensual: evolucionQ.rows,
    });
  } catch (err) {
    console.error('[incapacidades] stats error:', err.message);
    res.status(500).json({ error: 'Error al consultar estadísticas de incapacidades.' });
  }
});

// ─── GET /api/incapacidades ───────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { q = '', estado = '', causaMotivo = '', eps = '', prorroga = '', dependencia = '', fechaInicio = '', fechaFin = '', page = 1, limit = 20 } = req.query;
  try {
    const perm = await getModulePermission(pool, req.user, 'incapacidades');
    const conditions = [`s.tipo = 'Incapacidad'`];
    const params = [];
    let idx = 1;

    // Protección de datos sensibles (Ley 1581 / Sección 12 y RBAC Sección 7.1):
    // Un Funcionario solo consulta sus propias incapacidades; Luis Sánchez y Admin consultan todo el módulo.
    if (!perm.canManage) {
      const uname = String(req.user.username || '').trim().toLowerCase();
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      conditions.push(`(
        LOWER(COALESCE(s.apellidos_nombres, '')) = $${idx}
        OR LOWER(COALESCE(s.registrado_por, '')) = $${idx + 1}
        OR LOWER(COALESCE(s.correo_solicitante, '')) = $${idx + 1}
        OR ($${idx + 2} <> '' AND s.documento = $${idx + 2})
      )`);
      params.push(fullName, uname, userDoc);
      idx += 3;
    }

    if (estado && estado !== 'Todos') {
      conditions.push(`s.estado = $${idx++}`);
      params.push(normalizeStatus(estado));
    }
    if (causaMotivo && causaMotivo !== 'Todas' && causaMotivo !== 'Todos') {
      conditions.push(`LOWER(COALESCE(s.causa_motivo, '')) = LOWER($${idx++})`);
      params.push(clean(causaMotivo));
    }
    if (eps && eps !== 'Todas' && eps !== 'Todos') {
      conditions.push(`UPPER(COALESCE(s.eps, '')) = UPPER($${idx++})`);
      params.push(clean(eps));
    }
    if (prorroga && prorroga !== 'Todos' && prorroga !== 'Todas') {
      conditions.push(`UPPER(COALESCE(s.prorroga, 'NO')) = UPPER($${idx++})`);
      params.push(clean(prorroga));
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(COALESCE(s.dependencia, '')) LIKE LOWER($${idx++})`);
      params.push(`%${clean(dependencia)}%`);
    }
    if (fechaInicio) {
      conditions.push(`(${SQL_FECHA_INICIO_DATE}) >= $${idx++}::date`);
      params.push(fechaInicio);
    }
    if (fechaFin) {
      conditions.push(`(${SQL_FECHA_INICIO_DATE}) <= $${idx++}::date`);
      params.push(fechaFin);
    }
    if (q && clean(q)) {
      const qClean = clean(q);
      conditions.push(`(
        LOWER(COALESCE(s.apellidos_nombres, '')) LIKE LOWER($${idx})
        OR COALESCE(s.documento, '') LIKE $${idx}
        OR LOWER(COALESCE(s.dependencia, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(s.sede, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(s.codigo_cie10, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(s.acto_administrativo, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(s.eps, '')) LIKE LOWER($${idx})
      )`);
      params.push(`%${qClean}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM solicitudes_admin s WHERE ${where}`, params);
    const total = countRes.rows[0]?.total || 0;

    const lim = Math.max(1, parseInt(limit) || 20);
    const pg = Math.max(1, parseInt(page) || 1);
    const offset = (pg - 1) * lim;
    params.push(lim, offset);

    const rows = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM solicitudes_admin_soportes sp WHERE sp.id_solicitud = s.id_solicitud) AS soportes_count
       FROM solicitudes_admin s
       WHERE ${where}
       ORDER BY s.id_solicitud DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(mapRow),
      total,
      page: pg,
      totalPages: Math.max(1, Math.ceil(total / lim)),
      permission: perm
    });
  } catch (err) {
    console.error('[incapacidades] list error:', err.message);
    res.status(500).json({ error: 'Error al listar incapacidades.' });
  }
});

// ─── POST /api/incapacidades (Radicación de Incapacidad) ──────────────────────
router.post('/', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'incapacidades');

  const b = req.body || {};
  const persona = upper(b.persona || b.apellidosNombres);
  const documento = clean(b.documento).replace(/[.\s]/g, '');
  const dependencia = clean(b.dependencia);
  const sede = clean(b.sede);
  const cargo = upper(b.cargo);
  const eps = upper(b.eps);
  const fechaRadicacion = formatDateDMY(b.fechaRadicacion) || todayDMY();
  const fechaInicio = formatDateDMY(b.fechaInicio);
  const fechaFin = formatDateDMY(b.fechaFin) || fechaInicio;
  const prorroga = upper(b.prorroga) === 'SI' ? 'SI' : 'NO';
  const causaMotivo = clean(b.causaMotivo) || 'Enfermedad general';
  const codigoCie10 = upper(b.codigoCie10);
  const dias = Math.max(1, parseInt(b.dias || b.diasSolicitados) || calcDaysBetween(fechaInicio, fechaFin, 1));
  const salario = Math.max(0, parseFloat(b.salario) || 0);
  const descuento = b.descuento !== undefined && b.descuento !== '' && b.descuento !== null
    ? Math.max(0, parseFloat(b.descuento) || 0)
    : calcularDescuento(salario, dias, prorroga, causaMotivo);
  const actoAdministrativo = perm.canManage ? clean(b.actoAdministrativo) : '';
  const motivo = clean(b.motivo) || `${causaMotivo}${codigoCie10 ? ` (CIE-10: ${codigoCie10})` : ''}`;
  const observaciones = clean(b.observaciones);
  const estado = perm.canApprove ? normalizeStatus(b.estado || 'Pendiente') : 'Pendiente';
  const aprobadoPor = perm.canApprove ? clean(b.aprobadoPor) : '';

  if (!persona || persona.length < 3) return res.status(400).json({ error: 'Los nombres y apellidos del servidor son obligatorios.' });
  if (!documento) return res.status(400).json({ error: 'El número de cédula es obligatorio.' });
  if (!dependencia) return res.status(400).json({ error: 'Seleccione la dependencia en la que trabaja.' });
  if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'Las fechas inicial y final de la incapacidad son obligatorias.' });

  const parsedSoportes = parseSoportes(b.soportes, 0);
  if (parsedSoportes.error) return res.status(400).json({ error: parsedSoportes.error });

  const username = req.user.username || 'web';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO solicitudes_admin(
         tipo, fecha_radicacion, fecha_solicitud, apellidos_nombres, documento,
         dependencia, sede, cargo, eps, fecha_inicio, fecha_fin, prorroga,
         causa_motivo, codigo_cie10, dias_solicitados, salario, descuento,
         acto_administrativo, motivo, observaciones, estado, aprobado_por, nota_gestion,
         registrado_por, correo_solicitante
       ) VALUES (
         'Incapacidad', $1, $1, $2, $3,
         $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $18,
         $21, $22
       ) RETURNING *`,
      [
        fechaRadicacion, persona, documento,
        dependencia, sede, cargo, eps, fechaInicio, fechaFin, prorroga,
        causaMotivo, codigoCie10, dias, salario, descuento,
        actoAdministrativo, motivo, observaciones, estado, aprobadoPor,
        username, b.correoSolicitante || username
      ]
    );
    const newId = r.rows[0].id_solicitud;
    await insertSoportes(client, newId, parsedSoportes.soportes, username);
    await client.query(
      `INSERT INTO historial_solicitudes_admin(id_solicitud, estado_nuevo, nota, actualizado_por)
       VALUES ($1, $2, $3, $4)`,
      [newId, estado, 'Incapacidad registrada en el módulo SST', username]
    );

    await logAudit(client, {
      modulo: 'incapacidades',
      idRegistro: newId,
      radicado: `INC-2026-${String(newId).padStart(5, '0')}`,
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapRow(r.rows[0]),
      observaciones: `Radicación de incapacidad (${causaMotivo} - ${dias} días) para ${persona}`,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Incapacidad registrada exitosamente.',
      id: newId,
      radicado: `INC-2026-${String(newId).padStart(5, '0')}`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[incapacidades] create error:', err.message);
    res.status(500).json({ error: 'Error al registrar la incapacidad.' });
  } finally {
    client.release();
  }
});

// ─── POST /api/incapacidades/bulk (Importación Masiva Transaccional - 9.3) ────
router.post('/bulk', auth, trackImport(pool, 'incapacidades'), async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'incapacidades');
  if (!perm.canImport) {
    return res.status(403).json({ error: 'Solo el responsable asignado al módulo de Incapacidades o el Administrador pueden realizar importaciones masivas.' });
  }

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  try {
    await client.query('BEGIN');

    // Consultar claves existentes para evitar duplicados (documento + fecha_inicio + fecha_fin)
    const existingRes = await client.query(
      `SELECT documento, fecha_inicio, fecha_fin FROM solicitudes_admin WHERE tipo = 'Incapacidad'`
    );
    const seenKeys = new Set(
      existingRes.rows.map(r => `${clean(r.documento)}|${formatDateDMY(r.fecha_inicio)}|${formatDateDMY(r.fecha_fin)}`)
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filaExcel = row._rowNum || (i + 2);
      const persona = upper(row.persona || row.apellidosNombres || row['NOMBRES Y APELLIDOS']);
      const documento = clean(row.documento || row['CÉDULA']).replace(/[.\s]/g, '');
      const dependencia = clean(row.dependencia || row['DEPENDENCIA EN LA QUE TRABAJA']);

      if (!persona || !documento || !dependencia) {
        errors.push({
          fila: filaExcel,
          columna: !documento ? 'CÉDULA' : !persona ? 'NOMBRES Y APELLIDOS' : 'DEPENDENCIA EN LA QUE TRABAJA',
          motivo: 'Campos obligatorios faltantes (Nombre, Cédula o Dependencia).'
        });
        skipped++;
        continue;
      }

      const fechaRadicacion = formatDateDMY(row.fechaRadicacion || row['FECHA DE RADICACIÓN']) || todayDMY();
      const sede = clean(row.sede || row['SEDE EN LA QUE TRABAJA']);
      const cargo = upper(row.cargo || row['CARGO']);
      const eps = upper(row.eps || row['EPS'] || 'SANITAS');
      const fechaInicio = formatDateDMY(row.fechaInicio || row['FECHA INICIAL DE LA INCAPACIDAD']) || todayDMY();
      const fechaFin = formatDateDMY(row.fechaFin || row['FECHA FINAL DE LA INCAPACIDAD']) || fechaInicio;

      const dupKey = `${documento}|${fechaInicio}|${fechaFin}`;
      if (seenKeys.has(dupKey)) {
        errors.push({
          fila: filaExcel,
          columna: 'CÉDULA / FECHAS',
          motivo: `Registro duplicado para documento ${documento} en el periodo ${fechaInicio} - ${fechaFin}.`
        });
        skipped++;
        continue;
      }
      seenKeys.add(dupKey);

      const prorroga = upper(row.prorroga || row['PRORROGA'] || 'NO') === 'SI' ? 'SI' : 'NO';
      const causaMotivo = clean(row.causaMotivo || row['CAUSA O MOTIVO'] || 'Enfermedad general');
      const codigoCie10 = upper(row.codigoCie10 || row['CÓDIGO CIE 10']);
      const dias = Math.max(1, parseInt(row.dias || row['DÍAS']) || calcDaysBetween(fechaInicio, fechaFin, 1));
      const salario = Math.max(0, parseFloat(row.salario || row['SALARIO']) || 0);
      const descuento = row.descuento !== undefined && row.descuento !== ''
        ? Math.max(0, parseFloat(row.descuento) || 0)
        : calcularDescuento(salario, dias, prorroga, causaMotivo);
      const actoAdministrativo = clean(row.actoAdministrativo || row['ACTO ADMINISTRATIVO']);
      const motivo = clean(row.motivo) || `${causaMotivo}${codigoCie10 ? ` (CIE-10: ${codigoCie10})` : ''}`;
      const observaciones = clean(row.observaciones);
      const estado = normalizeStatus(row.estado || 'Aprobada');

      await client.query(
        `INSERT INTO solicitudes_admin(
           tipo, fecha_radicacion, fecha_solicitud, apellidos_nombres, documento,
           dependencia, sede, cargo, eps, fecha_inicio, fecha_fin, prorroga,
           causa_motivo, codigo_cie10, dias_solicitados, salario, descuento,
           acto_administrativo, motivo, observaciones, estado, registrado_por
         ) VALUES (
           'Incapacidad', $1, $1, $2, $3,
           $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15,
           $16, $17, $18, $19, $20
         )`,
        [
          fechaRadicacion, persona, documento,
          dependencia, sede, cargo, eps, fechaInicio, fechaFin, prorroga,
          causaMotivo, codigoCie10, dias, salario, descuento,
          actoAdministrativo, motivo, observaciones, estado, req.user.username || 'web'
        ]
      );
      inserted++;
    }

    await logAudit(client, {
      modulo: 'incapacidades',
      idRegistro: `BULK-${Date.now()}`,
      radicado: 'IMPORT-INC',
      user: req.user,
      tipoOperacion: 'IMPORTACION_MASIVA',
      valoresAnteriores: null,
      valoresNuevos: { totalRecibidos: rows.length, insertados: inserted, omitidos: skipped },
      observaciones: `Importación masiva Formato E-DO-ST-F-002: ${inserted} insertados, ${skipped} omitidos/duplicados.`,
    });

    await client.query('COMMIT');
    res.status(201).json({
      inserted,
      skipped,
      duplicatesSkipped: skipped,
      errors,
      message: `Se importaron ${inserted} registros de incapacidad exitosamente (${skipped} omitidos/duplicados).`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[incapacidades] bulk error:', err.message);
    res.status(500).json({ error: 'Error en la importación masiva de incapacidades. Se revirtió la transacción para proteger la integridad de los datos.' });
  } finally {
    client.release();
  }
});

// ─── PUT /api/incapacidades/:id ───────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const perm = await getModulePermission(pool, req.user, 'incapacidades');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo el responsable asignado al módulo de Incapacidades o el Administrador pueden editar registros.' });
  }

  const prevRes = await pool.query(`SELECT * FROM solicitudes_admin WHERE id_solicitud = $1 AND tipo = 'Incapacidad'`, [id]);
  if (!prevRes.rows.length) return res.status(404).json({ error: 'Incapacidad no encontrada.' });
  const prevRow = prevRes.rows[0];

  const b = req.body || {};
  const persona = upper(b.persona || b.apellidosNombres);
  const documento = clean(b.documento).replace(/[.\s]/g, '');
  const dependencia = clean(b.dependencia);
  const sede = clean(b.sede);
  const cargo = upper(b.cargo);
  const eps = upper(b.eps);
  const fechaRadicacion = formatDateDMY(b.fechaRadicacion) || todayDMY();
  const fechaInicio = formatDateDMY(b.fechaInicio);
  const fechaFin = formatDateDMY(b.fechaFin) || fechaInicio;
  const prorroga = upper(b.prorroga) === 'SI' ? 'SI' : 'NO';
  const causaMotivo = clean(b.causaMotivo) || 'Enfermedad general';
  const codigoCie10 = upper(b.codigoCie10);
  const dias = Math.max(1, parseInt(b.dias || b.diasSolicitados) || calcDaysBetween(fechaInicio, fechaFin, 1));
  const salario = Math.max(0, parseFloat(b.salario) || 0);
  const descuento = b.descuento !== undefined && b.descuento !== '' && b.descuento !== null
    ? Math.max(0, parseFloat(b.descuento) || 0)
    : calcularDescuento(salario, dias, prorroga, causaMotivo);
  const actoAdministrativo = clean(b.actoAdministrativo);
  const motivo = clean(b.motivo) || `${causaMotivo}${codigoCie10 ? ` (CIE-10: ${codigoCie10})` : ''}`;
  const observaciones = clean(b.observaciones);
  const estado = normalizeStatus(b.estado || prevRow.estado || 'Pendiente');
  const prevEstado = normalizeStatus(prevRow.estado);
  const aprobadoPor = clean(b.aprobadoPor || prevRow.aprobado_por);

  if (estado !== prevEstado && (estado === 'Aprobada' || estado === 'Rechazada')) {
    if (!perm.canApprove) {
      return res.status(403).json({ error: 'No tiene permisos para aprobar o rechazar incapacidades.' });
    }
    if (!perm.isAdmin && isSelfRequest(req.user, prevRow)) {
      return res.status(403).json({ error: 'Por control interno, no puede aprobar ni rechazar su propia incapacidad.' });
    }
  }

  if (!persona || !documento || !dependencia) {
    return res.status(400).json({ error: 'Nombre, cédula y dependencia son obligatorios.' });
  }

  const eliminar = (Array.isArray(b.soportesEliminar) ? b.soportesEliminar : [])
    .map(n => parseInt(n)).filter(n => n > 0);
  const curSops = await pool.query('SELECT id_soporte FROM solicitudes_admin_soportes WHERE id_solicitud=$1', [id]);
  const aEliminar = curSops.rows.map(r => r.id_soporte).filter(sid => eliminar.includes(sid));
  const kept = curSops.rows.length - aEliminar.length;

  const parsedSoportes = parseSoportes(b.soportes, kept);
  if (parsedSoportes.error) return res.status(400).json({ error: parsedSoportes.error });

  const username = req.user.username || 'web';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE solicitudes_admin SET
         fecha_radicacion = $1,
         apellidos_nombres = $2,
         documento = $3,
         dependencia = $4,
         sede = $5,
         cargo = $6,
         eps = $7,
         fecha_inicio = $8,
         fecha_fin = $9,
         prorroga = $10,
         causa_motivo = $11,
         codigo_cie10 = $12,
         dias_solicitados = $13,
         salario = $14,
         descuento = $15,
         acto_administrativo = $16,
         motivo = $17,
         observaciones = $18,
         estado = $19,
         aprobado_por = $20,
         nota_gestion = $18
       WHERE id_solicitud = $21 AND tipo = 'Incapacidad'
       RETURNING *`,
      [
        fechaRadicacion, persona, documento,
        dependencia, sede, cargo, eps, fechaInicio, fechaFin, prorroga,
        causaMotivo, codigoCie10, dias, salario, descuento,
        actoAdministrativo, motivo, observaciones, estado, aprobadoPor,
        id
      ]
    );
    if (aEliminar.length) {
      await client.query(
        'DELETE FROM solicitudes_admin_soportes WHERE id_solicitud=$1 AND id_soporte = ANY($2::int[])',
        [id, aEliminar]
      );
    }
    await insertSoportes(client, id, parsedSoportes.soportes, username);
    await client.query(
      `INSERT INTO historial_solicitudes_admin(id_solicitud, estado_nuevo, nota, actualizado_por)
       VALUES ($1, $2, $3, $4)`,
      [id, estado, observaciones || 'Actualizado desde módulo de Incapacidades', username]
    );

    const opType = estado !== prevEstado
      ? (estado === 'Aprobada' ? 'APROBACION' : estado === 'Rechazada' ? 'RECHAZO' : 'CAMBIO_ESTADO')
      : 'MODIFICACION';

    await logAudit(client, {
      modulo: 'incapacidades',
      idRegistro: id,
      radicado: `INC-2026-${String(id).padStart(5, '0')}`,
      user: req.user,
      tipoOperacion: opType,
      valoresAnteriores: mapRow(prevRow),
      valoresNuevos: mapRow(r.rows[0]),
      observaciones: observaciones || `Actualización de incapacidad (${prevEstado} -> ${estado})`,
    });

    await client.query('COMMIT');
    res.json({ message: 'Incapacidad actualizada correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[incapacidades] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar la incapacidad.' });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/incapacidades/:id/status ──────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const perm = await getModulePermission(pool, req.user, 'incapacidades');
  if (!perm.canApprove) {
    return res.status(403).json({ error: 'Solo el responsable asignado al módulo de Incapacidades o el Administrador pueden cambiar el estado.' });
  }

  const newStatus = normalizeStatus(req.body?.estado);
  const note = clean(req.body?.observaciones || req.body?.notaGestion || '');
  try {
    const prevRes = await pool.query(`SELECT * FROM solicitudes_admin WHERE id_solicitud = $1 AND tipo = 'Incapacidad'`, [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Incapacidad no encontrada.' });
    const prevRow = prevRes.rows[0];
    const prevEstado = normalizeStatus(prevRow.estado);

    if (!perm.isAdmin && isSelfRequest(req.user, prevRow)) {
      return res.status(403).json({ error: 'Por control interno, no puede aprobar ni rechazar su propia incapacidad.' });
    }

    const r = await pool.query(
      `UPDATE solicitudes_admin
       SET estado = $1,
           aprobado_por = CASE WHEN $1 = 'Aprobada' THEN $4 ELSE aprobado_por END,
           observaciones = CASE WHEN $2 <> '' THEN $2 ELSE observaciones END,
           nota_gestion  = CASE WHEN $2 <> '' THEN $2 ELSE nota_gestion END
       WHERE id_solicitud = $3 AND tipo = 'Incapacidad'
       RETURNING *`,
      [newStatus, note, id, req.user.name || req.user.username || 'Responsable']
    );

    await pool.query(
      `INSERT INTO historial_solicitudes_admin(id_solicitud, estado_nuevo, nota, actualizado_por)
       VALUES ($1, $2, $3, $4)`,
      [id, newStatus, note || `Cambio rápido de estado a ${newStatus}`, req.user.username || 'web']
    );

    const opType = newStatus === 'Aprobada' ? 'APROBACION' : newStatus === 'Rechazada' ? 'RECHAZO' : 'CAMBIO_ESTADO';
    await logAudit(pool, {
      modulo: 'incapacidades',
      idRegistro: id,
      radicado: `INC-2026-${String(id).padStart(5, '0')}`,
      user: req.user,
      tipoOperacion: opType,
      valoresAnteriores: { estado: prevEstado, observaciones: prevRow.observaciones },
      valoresNuevos: { estado: newStatus, observaciones: r.rows[0].observaciones },
      observaciones: note || `Cambio de estado de ${prevEstado} a ${newStatus}`,
    });

    res.json({ message: `Estado actualizado a ${newStatus}.` });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado de la incapacidad.' });
  }
});

// ─── DELETE /api/incapacidades/:id ────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const perm = await getModulePermission(pool, req.user, 'incapacidades');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo el responsable asignado al módulo de Incapacidades o el Administrador pueden eliminar registros.' });
  }

  try {
    const prevRes = await pool.query(`SELECT * FROM solicitudes_admin WHERE id_solicitud = $1 AND tipo = 'Incapacidad'`, [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Incapacidad no encontrada.' });
    const prevRow = prevRes.rows[0];

    await pool.query(`DELETE FROM solicitudes_admin WHERE id_solicitud = $1 AND tipo = 'Incapacidad'`, [id]);

    await logAudit(pool, {
      modulo: 'incapacidades',
      idRegistro: id,
      radicado: `INC-2026-${String(id).padStart(5, '0')}`,
      user: req.user,
      tipoOperacion: 'ELIMINACION',
      valoresAnteriores: mapRow(prevRow),
      valoresNuevos: null,
      observaciones: `Eliminación de registro de incapacidad INC-2026-${String(id).padStart(5, '0')} (${upper(prevRow.apellidos_nombres)})`,
    });

    res.json({ message: 'Incapacidad eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la incapacidad.' });
  }
});

// ─── GET /api/incapacidades/:id/soportes ──────────────────────────────────────
router.get('/:id/soportes', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id_soporte, nombre_archivo, tipo_mime, tamano_bytes, subido_por, creado_en
       FROM solicitudes_admin_soportes
       WHERE id_solicitud = $1
       ORDER BY id_soporte`,
      [parseInt(req.params.id)]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar soportes de la incapacidad.' });
  }
});

// ─── GET /api/incapacidades/:id/soportes/:sid ─────────────────────────────────
router.get('/:id/soportes/:sid', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT nombre_archivo, tipo_mime, tamano_bytes, contenido
       FROM solicitudes_admin_soportes
       WHERE id_solicitud = $1 AND id_soporte = $2`,
      [parseInt(req.params.id), parseInt(req.params.sid)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Soporte no encontrado.' });
    const s = r.rows[0];
    const safe = String(s.nombre_archivo || 'soporte').replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Type', s.tipo_mime);
    res.setHeader('Content-Length', s.tamano_bytes);
    res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
    res.send(s.contenido);
  } catch (err) {
    res.status(500).json({ error: 'Error al descargar soporte.' });
  }
});

module.exports = router;
