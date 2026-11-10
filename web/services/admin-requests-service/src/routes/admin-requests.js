const router = require('express').Router();
const jwt    = require('jsonwebtoken');
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

const VALID_TIPOS = ['Permiso Laboral', 'Incapacidad', 'Licencia'];

const {
  ensureAuditAndRbacSchema,
  isAdminUser,
  getModulePermission,
  isSelfRequest,
  logAudit,
  mountGovernanceRoutes,
} = require('../utils/audit-rbac');

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido.' }); }
}

function moduloFromTipo(tipo) {
  if (tipo === 'Permiso Laboral') return 'permisos';
  if (tipo === 'Licencia') return 'licencias';
  if (tipo === 'Incapacidad') return 'incapacidades';
  return 'permisos';
}

function upper(v) { return v == null ? '' : String(v).trim().replace(/\s+/g,' ').toUpperCase(); }
function normalizeStatus(s) {
  if (!s) return 'Pendiente';
  const e = String(s).trim().toLowerCase();
  if (e.includes('aprobad')) return 'Aprobada';
  if (e.includes('finaliz')) return 'Finalizada';
  if (e.includes('rechazad')) return 'Rechazada';
  if (e.includes('revis')) return 'En revisión';
  return 'Pendiente';
}
function filingPrefix(tipo) {
  if (tipo === 'Permiso Laboral') return 'PL';
  if (tipo === 'Incapacidad')     return 'INC';
  if (tipo === 'Licencia')        return 'LIC';
  return 'SOL';
}
function radicadoOf(tipo, id) { return `${filingPrefix(tipo)}-2026-${String(id).padStart(5,'0')}`; }
function todayDMY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ─── Formulario de Permisos Laborales (CamposFormulario.xlsx) ────────────────
const permisosCatalog = require('../catalogs/permisos');
const licenciasCatalog = require('../catalogs/licencias');
const { validatePermiso, formatHoras } = require('../utils/permisos-validator');
const { notifyPermiso } = require('../utils/mailer');

// Migración idempotente: agrega las columnas/tablas del formulario nuevo si aún no existen.
// Se ejecuta de forma perezosa (y se reintenta) para tolerar que la BD arranque después.
const SCHEMA_SQL = `
  ALTER TABLE solicitudes_admin
    ADD COLUMN IF NOT EXISTS correo_solicitante   VARCHAR(200),
    ADD COLUMN IF NOT EXISTS codigo               VARCHAR(80),
    ADD COLUMN IF NOT EXISTS grado                VARCHAR(80),
    ADD COLUMN IF NOT EXISTS sectorial            VARCHAR(200),
    ADD COLUMN IF NOT EXISTS nivel                VARCHAR(80),
    ADD COLUMN IF NOT EXISTS modalidad            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS jornada              VARCHAR(40),
    ADD COLUMN IF NOT EXISTS hora_entrada         VARCHAR(5),
    ADD COLUMN IF NOT EXISTS hora_salida          VARCHAR(5),
    ADD COLUMN IF NOT EXISTS horas_solicitadas    NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS motivo_categoria     VARCHAR(40),
    ADD COLUMN IF NOT EXISTS motivo_incentivo     VARCHAR(40),
    ADD COLUMN IF NOT EXISTS jefe_nombre          VARCHAR(200),
    ADD COLUMN IF NOT EXISTS jefe_correo          VARCHAR(200),
    ADD COLUMN IF NOT EXISTS registrado_por       VARCHAR(120),
    ADD COLUMN IF NOT EXISTS notificacion_estado  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS notificacion_detalle VARCHAR(500),
    ADD COLUMN IF NOT EXISTS notificacion_fecha   TIMESTAMP;
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
let schemaPromise = null;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(SCHEMA_SQL);
      await ensureAuditAndRbacSchema(pool);
    })().catch(err => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}
ensureSchema().catch(err => console.warn('[admin-requests] init schema retry on first request:', err.message));
router.use(async (_req, res, next) => {
  try { await ensureSchema(); next(); }
  catch (err) {
    console.error('[admin-requests] schema error:', err.message);
    res.status(503).json({ error: 'La base de datos aún no está lista. Intente de nuevo en unos segundos.' });
  }
});

// Montar rutas de gobernanza (RBAC, Responsables, Auditoría Inmutable y Documentos Institucionales)
mountGovernanceRoutes(router, pool, auth);

function duracionLabel(r) {
  if (r.modalidad === 'horas' && r.horas_solicitadas != null) return formatHoras(Number(r.horas_solicitadas));
  if (r.modalidad === 'dia') return r.jornada === 'Todo el día' ? '1 día' : 'Medio día';
  if (r.modalidad === 'varios_dias') return `${r.dias_solicitados} días hábiles`;
  return null;
}

function mapRow(r) {
  return {
    id: r.id_solicitud,
    radicado: radicadoOf(r.tipo, r.id_solicitud),
    tipo: r.tipo, persona: upper(r.apellidos_nombres), documento: r.documento,
    dependencia: upper(r.dependencia), cargo: upper(r.cargo),
    fechaInicio: r.fecha_inicio, fechaFin: r.fecha_fin,
    diasSolicitados: r.dias_solicitados, motivo: r.motivo,
    estado: normalizeStatus(r.estado), observaciones: r.observaciones,
    fechaSolicitud: r.fecha_solicitud, aprobadoPor: r.aprobado_por,
    notaGestion: r.nota_gestion,
    // Formulario de permisos laborales
    correoSolicitante: r.correo_solicitante, codigo: r.codigo || "", grado: r.grado || "", sectorial: r.sectorial, nivel: r.nivel,
    modalidad: r.modalidad, jornada: r.jornada,
    horaEntrada: r.hora_entrada, horaSalida: r.hora_salida,
    horasSolicitadas: r.horas_solicitadas == null ? null : Number(r.horas_solicitadas),
    motivoCategoria: r.motivo_categoria, motivoIncentivo: r.motivo_incentivo,
    jefeNombre: r.jefe_nombre, jefeCorreo: r.jefe_correo,
    registradoPor: r.registrado_por,
    notificacionEstado: r.notificacion_estado, notificacionDetalle: r.notificacion_detalle,
    soportesCount: r.soportes_count == null ? 0 : parseInt(r.soportes_count),
    duracion: duracionLabel(r),
    creadoEn: r.creado_en,
  };
}

// Datos para las plantillas de correo a partir de una fila ya guardada
function notificationPayload(r, soportesCount) {
  let jornadaTexto = r.jornada || '';
  if (r.modalidad === 'horas') jornadaTexto = `${r.jornada}: salida ${r.hora_salida} · entrada ${r.hora_entrada}`;
  if (r.modalidad === 'varios_dias') jornadaTexto = 'Todo el día (varios días)';
  return {
    radicado: radicadoOf(r.tipo, r.id_solicitud),
    persona: upper(r.apellidos_nombres), documento: r.documento,
    correoSolicitante: r.correo_solicitante, sectorial: r.sectorial, dependencia: r.dependencia,
    nivel: r.nivel, cargo: r.cargo,
    fechaTexto: r.fecha_inicio === r.fecha_fin ? r.fecha_inicio : `${r.fecha_inicio} al ${r.fecha_fin}`,
    jornadaTexto, duracion: duracionLabel(r), motivo: r.motivo,
    soportesCount, observaciones: r.observaciones,
    jefeNombre: r.jefe_nombre, jefeCorreo: r.jefe_correo,
  };
}

async function sendAndStoreNotification(id) {
  const { rows } = await pool.query('SELECT * FROM solicitudes_admin WHERE id_solicitud=$1', [id]);
  if (!rows.length) return null;
  const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM solicitudes_admin_soportes WHERE id_solicitud=$1', [id]);
  const noti = await notifyPermiso(notificationPayload(rows[0], cnt.rows[0].n));
  await pool.query(
    'UPDATE solicitudes_admin SET notificacion_estado=$1, notificacion_detalle=$2, notificacion_fecha=NOW() WHERE id_solicitud=$3',
    [noti.estado, noti.detalle, id]);
  return noti;
}

async function insertSoportes(client, idSolicitud, soportes, username) {
  for (const s of soportes) {
    await client.query(
      `INSERT INTO solicitudes_admin_soportes(id_solicitud,nombre_archivo,tipo_mime,tamano_bytes,contenido,subido_por)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [idSolicitud, s.nombre, s.tipo, s.buffer.length, s.buffer, username || 'web']);
  }
}

// Sub-router del Módulo Independiente de Incapacidades SST (también montado en /api/incapacidades)
router.use('/incapacidades', require('./incapacidades'));

// ─── GET /api/admin-requests/catalogs/permisos ────────────────────────────────
// Catálogos y reglas del formulario de Permisos Laborales (sectoriales, cargos, motivos…)
router.get('/catalogs/permisos', auth, (_req, res) => {
  const c = permisosCatalog;
  res.json({
    emailDomain: c.EMAIL_DOMAIN,
    sectoriales: c.SECTORIALES, niveles: c.NIVELES,
    modalidades: c.MODALIDADES, jornadas: c.JORNADAS, motivos: c.MOTIVOS, soportes: c.SOPORTES,
  });
});

function parseGenericSoportes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const f of list) {
    if (!f || !f.base64 || !f.nombre) continue;
    const b64 = String(f.base64).replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) continue;
    const tipo = f.tipo || 'application/pdf';
    out.push({
      nombre: String(f.nombre).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 200),
      tipo,
      buffer: buf
    });
  }
  return out;
}

// ─── GET /api/admin-requests/catalogs/licencias ───────────────────────────────
router.get('/catalogs/licencias', auth, (_req, res) => {
  res.json(licenciasCatalog);
});

// ─── GET /api/admin-requests ──────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { tipo='', q='', estado='', departamento='', fechaInicio='', fechaFin='', anio='', mes='', page=1, limit=20 } = req.query;
  if (tipo && !VALID_TIPOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido. Use: ${VALID_TIPOS.join(', ')}` });

  try {
    const permPermisos = await getModulePermission(pool, req.user, 'permisos');
    const permLicencias = await getModulePermission(pool, req.user, 'licencias');

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (tipo) {
      conditions.push(`tipo = $${idx++}`);
      params.push(tipo);
    } else {
      conditions.push(`tipo IN ('Permiso Laboral', 'Licencia')`);
    }

    // Control de acceso RBAC (Sección 7.1):
    // Si el usuario es Funcionario en el módulo consultado, solo puede ver sus propias solicitudes.
    const activePerm = tipo === 'Licencia' ? permLicencias : tipo === 'Permiso Laboral' ? permPermisos : (permPermisos.canManage || permLicencias.canManage ? { canManage: true } : { canManage: false });
    if (!activePerm.canManage) {
      const uname = String(req.user.username || '').trim().toLowerCase();
      const unamePrefix = uname.split('@')[0];
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      conditions.push(`(
        LOWER(COALESCE(correo_solicitante, '')) = $${idx}
        OR LOWER(SPLIT_PART(COALESCE(correo_solicitante, ''), '@', 1)) = $${idx + 1}
        OR LOWER(COALESCE(registrado_por, '')) = $${idx}
        OR LOWER(COALESCE(apellidos_nombres, '')) = $${idx + 2}
        OR ($${idx + 3} <> '' AND documento = $${idx + 3})
      )`);
      params.push(uname, unamePrefix, fullName, userDoc);
      idx += 4;
    }

    if (estado && estado !== 'Todos') { conditions.push(`estado = $${idx++}`); params.push(normalizeStatus(estado)); }
    if (departamento && departamento !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`); params.push(`%${departamento}%`);
    }
    if (fechaInicio) {
      conditions.push(`fecha_inicio >= $${idx++}`); params.push(fechaInicio);
    }
    if (fechaFin) {
      conditions.push(`fecha_inicio <= $${idx++}`); params.push(fechaFin);
    }
    if (anio) {
      conditions.push(`SUBSTRING(COALESCE(fecha_inicio,''), 1, 4) = $${idx++}`); params.push(String(anio));
    }
    if (mes) {
      const mesPad = String(mes).padStart(2, '0');
      conditions.push(`SUBSTRING(COALESCE(fecha_inicio,''), 6, 2) = $${idx++}`); params.push(mesPad);
    }
    if (q) {
      conditions.push(`(LOWER(apellidos_nombres) LIKE LOWER($${idx}) OR documento LIKE $${idx} OR LOWER(dependencia) LIKE LOWER($${idx}) OR LOWER(COALESCE(motivo,'')) LIKE LOWER($${idx}))`);
      params.push(`%${q}%`); idx++;
    }

    const where = conditions.join(' AND ');
    const total = parseInt((await pool.query(`SELECT COUNT(*) FROM solicitudes_admin WHERE ${where}`, params)).rows[0].count);

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const rows = await pool.query(
      `SELECT sa.*,
              (SELECT COUNT(*) FROM solicitudes_admin_soportes s WHERE s.id_solicitud = sa.id_solicitud) AS soportes_count
         FROM solicitudes_admin sa WHERE ${where} ORDER BY id_solicitud DESC LIMIT $${idx} OFFSET $${idx+1}`,
      params);

    res.json({
      data: rows.rows.map(mapRow),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      permissions: {
        permisos: permPermisos,
        licencias: permLicencias,
      }
    });
  } catch (err) {
    console.error('[admin-requests] list error:', err.message);
    res.status(500).json({ error: 'Error al listar solicitudes administrativas.' });
  }
});

// ─── GET /api/admin-requests/stats (Dashboards 6.1 Permisos y 6.2 Licencias) ──
router.get('/stats', auth, async (req, res) => {
  try {
    const { detailed = '', tipo = '', anio = '', mes = '', fechaInicio = '', fechaFin = '', dependencia = '' } = req.query;

    const permPermisos = await getModulePermission(pool, req.user, 'permisos');
    const permLicencias = await getModulePermission(pool, req.user, 'licencias');

    // Construir filtro de periodo/dependencia/RBAC para estadísticas
    const buildFilter = (targetTipo, perm) => {
      const conds = [`tipo = $1`];
      const vals = [targetTipo];
      let i = 2;

      if (!perm.canManage) {
        const uname = String(req.user.username || '').trim().toLowerCase();
        const unamePrefix = uname.split('@')[0];
        const fullName = String(req.user.name || '').trim().toLowerCase();
        const userDoc = String(req.user.documento || '').trim();
        conds.push(`(
          LOWER(COALESCE(correo_solicitante, '')) = $${i}
          OR LOWER(SPLIT_PART(COALESCE(correo_solicitante, ''), '@', 1)) = $${i + 1}
          OR LOWER(COALESCE(registrado_por, '')) = $${i}
          OR LOWER(COALESCE(apellidos_nombres, '')) = $${i + 2}
          OR ($${i + 3} <> '' AND documento = $${i + 3})
        )`);
        vals.push(uname, unamePrefix, fullName, userDoc);
        i += 4;
      }

      if (anio && anio !== 'Todos') {
        conds.push(`SUBSTRING(COALESCE(fecha_inicio,''), 1, 4) = $${i++}`);
        vals.push(String(anio));
      }
      if (mes && mes !== 'Todos') {
        conds.push(`SUBSTRING(COALESCE(fecha_inicio,''), 6, 2) = $${i++}`);
        vals.push(String(mes).padStart(2, '0'));
      }
      if (fechaInicio) {
        conds.push(`fecha_inicio >= $${i++}`);
        vals.push(fechaInicio);
      }
      if (fechaFin) {
        conds.push(`fecha_inicio <= $${i++}`);
        vals.push(fechaFin);
      }
      if (dependencia && dependencia !== 'Todas') {
        conds.push(`LOWER(dependencia) LIKE LOWER($${i++})`);
        vals.push(`%${dependencia}%`);
      }
      return { where: conds.join(' AND '), vals };
    };

    const baseByType = await pool.query(
      `SELECT tipo,
              COUNT(*)::int FILTER (WHERE estado='Pendiente') AS pendientes,
              COUNT(*)::int FILTER (WHERE estado='En revisión') AS revision,
              COUNT(*)::int FILTER (WHERE estado='Aprobada' OR estado='Finalizada') AS aprobadas,
              COUNT(*)::int FILTER (WHERE estado='Rechazada') AS rechazadas,
              COUNT(*)::int FILTER (WHERE estado='Finalizada') AS finalizadas,
              COUNT(*)::int AS total
       FROM solicitudes_admin GROUP BY tipo`
    );

    if (!detailed && !tipo) {
      return res.json(baseByType.rows);
    }

    const computeDetailedFor = async (targetTipo, perm) => {
      const { where, vals } = buildFilter(targetTipo, perm);

      const kpiQ = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*)::int FILTER (WHERE estado = 'Pendiente') AS pendientes,
            COUNT(*)::int FILTER (WHERE estado = 'En revisión') AS revision,
            COUNT(*)::int FILTER (WHERE estado = 'Aprobada') AS aprobadas,
            COUNT(*)::int FILTER (WHERE estado = 'Finalizada' OR (estado = 'Aprobada' AND fecha_fin <> '' AND fecha_fin < TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'))) AS finalizadas,
            COUNT(*)::int FILTER (WHERE estado = 'Aprobada' AND (fecha_fin = '' OR fecha_fin >= TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'))) AS activas,
            COUNT(*)::int FILTER (WHERE estado = 'Rechazada') AS rechazadas,
            COALESCE(SUM(dias_solicitados), 0)::int AS total_dias,
            COALESCE(SUM(horas_solicitadas), 0)::numeric(10,2) AS total_horas
           FROM solicitudes_admin
          WHERE ${where}`,
        vals
      );

      // Distribución por tipo de permiso / tipo de licencia
      const porMotivoQ = await pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(motivo), ''), NULLIF(TRIM(motivo_categoria), ''), 'Sin especificar') AS etiqueta,
            COUNT(*)::int AS cantidad,
            COALESCE(SUM(dias_solicitados), 0)::int AS dias
           FROM solicitudes_admin
          WHERE ${where}
          GROUP BY 1
          ORDER BY cantidad DESC
          LIMIT 10`,
        vals
      );

      // Solicitudes por dependencia
      const porDepQ = await pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(dependencia), ''), 'SIN DEPENDENCIA') AS dependencia,
            COUNT(*)::int AS cantidad,
            COUNT(*)::int FILTER (WHERE estado = 'Aprobada' OR estado = 'Finalizada') AS aprobadas,
            COUNT(*)::int FILTER (WHERE estado = 'Pendiente' OR estado = 'En revisión') AS pendientes
           FROM solicitudes_admin
          WHERE ${where}
          GROUP BY 1
          ORDER BY cantidad DESC
          LIMIT 10`,
        vals
      );

      // Evolución mensual (YYYY-MM)
      const porMesQ = await pool.query(
        `SELECT
            CASE
              WHEN fecha_inicio ~ '^[0-9]{4}-[0-9]{2}' THEN SUBSTRING(fecha_inicio, 1, 7)
              ELSE TO_CHAR(creado_en, 'YYYY-MM')
            END AS mes,
            COUNT(*)::int AS cantidad,
            COUNT(*)::int FILTER (WHERE estado = 'Aprobada' OR estado = 'Finalizada') AS aprobadas,
            COUNT(*)::int FILTER (WHERE estado = 'Rechazada') AS rechazadas,
            COALESCE(SUM(dias_solicitados), 0)::int AS dias
           FROM solicitudes_admin
          WHERE ${where}
          GROUP BY 1
          ORDER BY 1 ASC
          LIMIT 12`,
        vals
      );

      // Distribución por modalidad (horas, dia, varios_dias)
      const porModalidadQ = await pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(modalidad), ''), 'dia') AS modalidad,
            COUNT(*)::int AS cantidad
           FROM solicitudes_admin
          WHERE ${where}
          GROUP BY 1
          ORDER BY cantidad DESC`,
        vals
      );

      const k = kpiQ.rows[0] || {};
      return {
        total: k.total || 0,
        pendientes: k.pendientes || 0,
        revision: k.revision || 0,
        aprobadas: k.aprobadas || 0,
        activas: k.activas || 0,
        finalizadas: k.finalizadas || 0,
        rechazadas: k.rechazadas || 0,
        totalDias: k.total_dias || 0,
        totalHoras: Number(k.total_horas || 0),
        porTipoMotivo: porMotivoQ.rows,
        porDependencia: porDepQ.rows,
        evolucionMensual: porMesQ.rows,
        porModalidad: porModalidadQ.rows,
      };
    };

    const permisosStats = (!tipo || tipo === 'Permiso Laboral')
      ? await computeDetailedFor('Permiso Laboral', permPermisos)
      : null;
    const licenciasStats = (!tipo || tipo === 'Licencia')
      ? await computeDetailedFor('Licencia', permLicencias)
      : null;

    res.json({
      byType: baseByType.rows,
      permisos: permisosStats,
      licencias: licenciasStats,
    });
  } catch (err) {
    console.error('[admin-requests/stats] error:', err.message);
    res.status(500).json({ error: 'Error al consultar estadísticas.' });
  }
});

// ─── Creación de Permiso Laboral (formulario oficial de la Gobernación) ──────
async function createPermiso(req, res) {
  const v = await validatePermiso(req.body, { pool });
  if (v.error) return res.status(400).json({ error: v.error, campo: v.campo });
  const d = v.data;
  const username = req.user.username || 'web';

  const client = await pool.connect();
  let newId;
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO solicitudes_admin(tipo,dependencia,apellidos_nombres,documento,cargo,fecha_inicio,fecha_fin,
         dias_solicitados,motivo,estado,observaciones,fecha_solicitud,nota_gestion,
         correo_solicitante,codigo,grado,sectorial,nivel,modalidad,jornada,hora_entrada,hora_salida,horas_solicitadas,
         motivo_categoria,motivo_incentivo,jefe_nombre,jefe_correo,registrado_por,notificacion_estado)
       VALUES('Permiso Laboral',$1,$2,$3,$4,$5,$6,$7,$8,'Pendiente',$9,$10,$11,
              $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'pendiente')
       RETURNING *`,
      [d.dependencia, d.persona, d.documento, d.cargo, d.fechaInicio, d.fechaFin,
       d.dias, d.motivoLabel, d.observaciones, todayDMY(),
       d.advertencias.length ? `Alerta: ${d.advertencias.join(' ')}`.slice(0, 480) : '',
       d.correoSolicitante, d.codigo, d.grado, d.sectorial, d.nivel, d.modalidad, d.jornada, d.horaEntrada, d.horaSalida, d.horasSolicitadas,
       d.motivoCategoria, d.motivoIncentivo, d.jefeNombre, d.jefeCorreo, username]);
    newId = r.rows[0].id_solicitud;
    await insertSoportes(client, newId, d.soportes, username);
    await client.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [newId, 'Pendiente', 'Radicado desde el formulario de permisos laborales', username]);

    await logAudit(client, {
      modulo: 'permisos',
      idRegistro: newId,
      radicado: radicadoOf('Permiso Laboral', newId),
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapRow(r.rows[0]),
      observaciones: `Radicación de Permiso Laboral (${d.motivoLabel}) para ${d.persona}`,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin-requests] create permiso error:', err.message);
    return res.status(500).json({ error: 'Error al crear la solicitud de permiso.' });
  } finally {
    client.release();
  }

  // La solicitud ya quedó guardada; un fallo de correo NO la invalida (se puede reenviar).
  let notificacion = { estado: 'fallida', detalle: 'No se pudo procesar la notificación.' };
  try { notificacion = await sendAndStoreNotification(newId) || notificacion; }
  catch (err) { console.error('[admin-requests] notificación error:', err.message); }

  res.status(201).json({
    message: 'Solicitud de permiso radicada.',
    id: newId,
    radicado: radicadoOf('Permiso Laboral', newId),
    notificacion: { estado: notificacion.estado, detalle: notificacion.detalle },
    advertencias: d.advertencias,
  });
}

// ─── POST /api/admin-requests ─────────────────────────────────────────────────
// Tanto Funcionario como Responsable de módulo y Administrador pueden radicar solicitudes de Permiso o Licencia.
router.post('/', auth, async (req, res) => {
  const { tipo, persona, documento, dependencia, cargo, fechaInicio, fechaFin, diasSolicitados, motivo, estado, observaciones } = req.body;

  if (!tipo || !VALID_TIPOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido. Use: ${VALID_TIPOS.join(', ')}` });

  // Permisos Laborales: flujo validado del formulario oficial
  if (tipo === 'Permiso Laboral') {
    try { return await createPermiso(req, res); }
    catch (err) {
      console.error('[admin-requests] create permiso (unexpected):', err.message);
      return res.status(500).json({ error: 'Error al crear la solicitud de permiso.' });
    }
  }

  if (!persona || !documento)
    return res.status(400).json({ error: 'Persona y documento son requeridos.' });

  const modulo = moduloFromTipo(tipo);
  const perm = await getModulePermission(pool, req.user, modulo);
  // Si el usuario es Funcionario, el estado inicial siempre es 'Pendiente'
  const estadoInicial = perm.canApprove ? normalizeStatus(estado) : 'Pendiente';

  const today = todayDMY();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO solicitudes_admin(tipo,dependencia,apellidos_nombres,documento,cargo,fecha_inicio,fecha_fin,
        dias_solicitados,motivo,estado,observaciones,fecha_solicitud,motivo_categoria,codigo,grado,sectorial,correo_solicitante,registrado_por)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [tipo, upper(dependencia), upper(persona), documento, upper(cargo),
       fechaInicio||'', fechaFin||'', parseInt(diasSolicitados)||1, motivo||'',
       estadoInicial, observaciones||'', today,
       req.body.motivoCategoria || req.body.motivo_categoria || '',
       req.body.codigo || '', req.body.grado || '', req.body.sectorial || '',
       req.body.correoSolicitante || req.body.correo || req.user.username || '',
       req.user.username || 'web']);

    const newId = r.rows[0].id_solicitud;
    const soportesParsed = parseGenericSoportes(req.body.soportes);
    if (soportesParsed.length) {
      await insertSoportes(client, newId, soportesParsed, req.user.username || 'web');
    }

    await client.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [newId, estadoInicial, 'Creado desde interfaz web', req.user.username||'web']);

    await logAudit(client, {
      modulo,
      idRegistro: newId,
      radicado: radicadoOf(tipo, newId),
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapRow(r.rows[0]),
      observaciones: `Radicación de ${tipo} (${motivo || 'Sin motivo'}) para ${upper(persona)}`,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Solicitud creada.',
      id: newId,
      radicado: `${filingPrefix(tipo)}-2026-${String(newId).padStart(5,'0')}`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin-requests] create error:', err.message);
    res.status(500).json({ error: 'Error al crear solicitud.' });
  } finally {
    client.release();
  }
});

// ─── Edición de Permiso Laboral (misma validación que la creación) ───────────
async function updatePermiso(req, res, id, prevRow, perm) {
  const eliminar = (Array.isArray(req.body.soportesEliminar) ? req.body.soportesEliminar : [])
    .map(n => parseInt(n)).filter(n => n > 0);
  const cur = await pool.query(
    'SELECT id_soporte FROM solicitudes_admin_soportes WHERE id_solicitud=$1', [id]);
  const aEliminar = cur.rows.map(r => r.id_soporte).filter(sid => eliminar.includes(sid));
  const kept = cur.rows.length - aEliminar.length;

  const v = await validatePermiso(req.body, { pool, excludeId: id, keptSoportes: kept });
  if (v.error) return res.status(400).json({ error: v.error, campo: v.campo });
  const d = v.data;
  const username = req.user.username || 'web';
  const estado = normalizeStatus(req.body.estado || prevRow.estado);
  const prevEstado = normalizeStatus(prevRow.estado);

  if (estado !== prevEstado && (estado === 'Aprobada' || estado === 'Rechazada')) {
    if (!perm.canApprove) {
      return res.status(403).json({ error: 'No tiene permisos para aprobar o rechazar permisos laborales.' });
    }
    if (!perm.isAdmin && isSelfRequest(req.user, prevRow)) {
      return res.status(403).json({ error: 'Por control interno, no puede aprobar ni rechazar su propia solicitud de permiso.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE solicitudes_admin SET dependencia=$1,apellidos_nombres=$2,documento=$3,cargo=$4,fecha_inicio=$5,fecha_fin=$6,
         dias_solicitados=$7,motivo=$8,estado=$9,observaciones=$10,nota_gestion=$11,aprobado_por=$12,
         correo_solicitante=$13,codigo=$14,grado=$15,sectorial=$16,nivel=$17,modalidad=$18,jornada=$19,hora_entrada=$20,hora_salida=$21,
         horas_solicitadas=$22,motivo_categoria=$23,motivo_incentivo=$24,jefe_nombre=$25,jefe_correo=$26
       WHERE id_solicitud=$27 RETURNING *`,
      [d.dependencia, d.persona, d.documento, d.cargo, d.fechaInicio, d.fechaFin,
       d.dias, d.motivoLabel, estado, d.observaciones,
       String(req.body.notaGestion || '').trim().slice(0, 480), String(req.body.aprobadoPor || req.user.name || username).trim().slice(0, 150),
       d.correoSolicitante, d.codigo, d.grado, d.sectorial, d.nivel, d.modalidad, d.jornada, d.horaEntrada, d.horaSalida,
       d.horasSolicitadas, d.motivoCategoria, d.motivoIncentivo, d.jefeNombre, d.jefeCorreo, id]);
    if (aEliminar.length)
      await client.query('DELETE FROM solicitudes_admin_soportes WHERE id_solicitud=$1 AND id_soporte = ANY($2::int[])', [id, aEliminar]);
    await insertSoportes(client, id, d.soportes, username);
    await client.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [id, estado, String(req.body.notaGestion || '').trim() || 'Actualizado desde web', username]);

    const opType = estado !== prevEstado
      ? (estado === 'Aprobada' ? 'APROBACION' : estado === 'Rechazada' ? 'RECHAZO' : 'CAMBIO_ESTADO')
      : 'MODIFICACION';

    await logAudit(client, {
      modulo: 'permisos',
      idRegistro: id,
      radicado: radicadoOf('Permiso Laboral', id),
      user: req.user,
      tipoOperacion: opType,
      valoresAnteriores: mapRow(prevRow),
      valoresNuevos: mapRow(upd.rows[0]),
      observaciones: String(req.body.notaGestion || '').trim() || `Actualización de Permiso Laboral (${prevEstado} -> ${estado})`,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin-requests] update permiso error:', err.message);
    return res.status(500).json({ error: 'Error al actualizar la solicitud de permiso.' });
  } finally {
    client.release();
  }
  res.json({ message: 'Solicitud actualizada.', advertencias: d.advertencias });
}

// ─── PUT /api/admin-requests/:id ─────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const numId = parseInt(req.params.id, 10);
  if (!numId) return res.status(400).json({ error: 'ID inválido.' });

  const prevRes = await pool.query('SELECT * FROM solicitudes_admin WHERE id_solicitud=$1', [numId]);
  if (!prevRes.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const prevRow = prevRes.rows[0];
  const modulo = moduloFromTipo(prevRow.tipo);
  const perm = await getModulePermission(pool, req.user, modulo);

  if (!perm.canManage) {
    return res.status(403).json({ error: `Solo el responsable asignado al módulo de ${prevRow.tipo} o el Administrador pueden editar solicitudes.` });
  }

  // Permisos Laborales editados desde el formulario nuevo
  if (req.body.modalidad && prevRow.tipo === 'Permiso Laboral') {
    try {
      return await updatePermiso(req, res, numId, prevRow, perm);
    } catch (err) {
      console.error('[admin-requests] update permiso (unexpected):', err.message);
      return res.status(500).json({ error: 'Error al actualizar la solicitud de permiso.' });
    }
  }

  const { persona, documento, dependencia, cargo, fechaInicio, fechaFin, diasSolicitados, motivo, estado, observaciones, notaGestion, aprobadoPor } = req.body;
  const nuevoEstado = normalizeStatus(estado || prevRow.estado);
  const prevEstado = normalizeStatus(prevRow.estado);

  if (nuevoEstado !== prevEstado && (nuevoEstado === 'Aprobada' || nuevoEstado === 'Rechazada')) {
    if (!perm.canApprove) {
      return res.status(403).json({ error: 'No tiene permisos para aprobar o rechazar solicitudes en este módulo.' });
    }
    if (!perm.isAdmin && isSelfRequest(req.user, prevRow)) {
      return res.status(403).json({ error: 'Por control interno, no puede aprobar ni rechazar su propia solicitud.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE solicitudes_admin SET apellidos_nombres=$1,documento=$2,dependencia=$3,cargo=$4,fecha_inicio=$5,
        fecha_fin=$6,dias_solicitados=$7,motivo=$8,estado=$9,observaciones=$10,nota_gestion=$11,aprobado_por=$12,
        motivo_categoria=COALESCE($13, motivo_categoria), codigo=COALESCE($14, codigo), grado=COALESCE($15, grado),
        correo_solicitante=COALESCE($16, correo_solicitante)
       WHERE id_solicitud=$17 RETURNING *`,
      [upper(persona), documento, upper(dependencia), upper(cargo), fechaInicio||'', fechaFin||'',
       parseInt(diasSolicitados)||1, motivo||'', nuevoEstado, observaciones||'',
       notaGestion||'', aprobadoPor||req.user.name||req.user.username||'', req.body.motivoCategoria || null, req.body.codigo || null,
       req.body.grado || null, req.body.correoSolicitante || null, numId]);

    const eliminar = (Array.isArray(req.body.soportesEliminar) ? req.body.soportesEliminar : [])
      .map(n => parseInt(n)).filter(n => n > 0);
    if (eliminar.length) {
      await client.query('DELETE FROM solicitudes_admin_soportes WHERE id_solicitud=$1 AND id_soporte = ANY($2::int[])', [numId, eliminar]);
    }

    const soportesParsed = parseGenericSoportes(req.body.soportes);
    if (soportesParsed.length) {
      await insertSoportes(client, numId, soportesParsed, req.user.username || 'web');
    }

    await client.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [numId, nuevoEstado, notaGestion||'Actualizado desde web', req.user.username||'web']);

    const opType = nuevoEstado !== prevEstado
      ? (nuevoEstado === 'Aprobada' ? 'APROBACION' : nuevoEstado === 'Rechazada' ? 'RECHAZO' : 'CAMBIO_ESTADO')
      : 'MODIFICACION';

    await logAudit(client, {
      modulo,
      idRegistro: numId,
      radicado: radicadoOf(prevRow.tipo, numId),
      user: req.user,
      tipoOperacion: opType,
      valoresAnteriores: mapRow(prevRow),
      valoresNuevos: mapRow(r.rows[0]),
      observaciones: notaGestion || `Actualización de ${prevRow.tipo} (${prevEstado} -> ${nuevoEstado})`,
    });

    await client.query('COMMIT');
    res.json({ message: 'Solicitud actualizada.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin-requests] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar.' });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/admin-requests/:id/status ────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  const numId = parseInt(req.params.id, 10);
  const { estado, notaGestion } = req.body;
  if (!numId) return res.status(400).json({ error: 'ID inválido.' });
  if (!estado) return res.status(400).json({ error: 'El estado es requerido.' });

  try {
    const prevRes = await pool.query('SELECT * FROM solicitudes_admin WHERE id_solicitud=$1', [numId]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    const prevRow = prevRes.rows[0];
    const modulo = moduloFromTipo(prevRow.tipo);
    const perm = await getModulePermission(pool, req.user, modulo);

    if (!perm.canApprove) {
      return res.status(403).json({ error: `Solo el responsable asignado al módulo de ${prevRow.tipo} o el Administrador pueden cambiar el estado de la solicitud.` });
    }
    if (!perm.isAdmin && isSelfRequest(req.user, prevRow)) {
      return res.status(403).json({ error: 'Por control interno, no puede aprobar ni rechazar su propia solicitud.' });
    }

    const norm = normalizeStatus(estado);
    const prevEstado = normalizeStatus(prevRow.estado);
    const aprobador = norm === 'Aprobada' ? (req.user.name || req.user.username || 'Responsable') : prevRow.aprobado_por;

    const r = await pool.query(
      `UPDATE solicitudes_admin
          SET estado=$1,
              aprobado_por=$2,
              nota_gestion = CASE WHEN $3 != '' THEN $3 ELSE nota_gestion END
        WHERE id_solicitud=$4 RETURNING *`,
      [norm, aprobador, (notaGestion || '').trim(), numId]
    );

    await pool.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [numId, norm, (notaGestion || 'Cambio de estado').trim(), req.user.username||'web']
    );

    const opType = norm === 'Aprobada' ? 'APROBACION' : norm === 'Rechazada' ? 'RECHAZO' : 'CAMBIO_ESTADO';
    await logAudit(pool, {
      modulo,
      idRegistro: numId,
      radicado: radicadoOf(prevRow.tipo, numId),
      user: req.user,
      tipoOperacion: opType,
      valoresAnteriores: { estado: prevEstado, notaGestion: prevRow.nota_gestion, aprobadoPor: prevRow.aprobado_por },
      valoresNuevos: { estado: norm, notaGestion: r.rows[0].nota_gestion, aprobadoPor: r.rows[0].aprobado_por },
      observaciones: (notaGestion || `Cambio de estado de ${prevEstado} a ${norm}`).trim(),
    });

    res.json({ message: 'Estado de solicitud administrativa actualizado.', estado: norm });
  } catch (err) {
    console.error('[admin-requests] patch status error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

// ─── DELETE /api/admin-requests/:id ──────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const numId = parseInt(req.params.id, 10);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const prevRes = await pool.query('SELECT * FROM solicitudes_admin WHERE id_solicitud=$1', [numId]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    const prevRow = prevRes.rows[0];
    const modulo = moduloFromTipo(prevRow.tipo);
    const perm = await getModulePermission(pool, req.user, modulo);

    if (!perm.canManage) {
      return res.status(403).json({ error: `Solo el responsable asignado al módulo de ${prevRow.tipo} o el Administrador pueden eliminar solicitudes.` });
    }

    await pool.query('DELETE FROM solicitudes_admin WHERE id_solicitud=$1', [numId]);

    await logAudit(pool, {
      modulo,
      idRegistro: numId,
      radicado: radicadoOf(prevRow.tipo, numId),
      user: req.user,
      tipoOperacion: 'ELIMINACION',
      valoresAnteriores: mapRow(prevRow),
      valoresNuevos: null,
      observaciones: `Eliminación de solicitud ${radicadoOf(prevRow.tipo, numId)} (${upper(prevRow.apellidos_nombres)})`,
    });

    res.json({ message: 'Solicitud eliminada.' });
  } catch (err) {
    console.error('[admin-requests] delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar.' });
  }
});

// ─── GET /api/admin-requests/:id/soportes ────────────────────────────────────
router.get('/:id/soportes', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query(
      `SELECT id_soporte, nombre_archivo, tipo_mime, tamano_bytes, subido_por, creado_en
         FROM solicitudes_admin_soportes WHERE id_solicitud=$1 ORDER BY id_soporte`, [id]);
    res.json(r.rows.map(s => ({
      id: s.id_soporte, id_soporte: s.id_soporte, nombre: s.nombre_archivo, nombre_archivo: s.nombre_archivo, tipo: s.tipo_mime, tipo_mime: s.tipo_mime,
      tamano: s.tamano_bytes, subidoPor: s.subido_por, creadoEn: s.creado_en,
    })));
  } catch (err) {
    console.error('[admin-requests] list soportes error:', err.message);
    res.status(500).json({ error: 'Error al consultar los soportes.' });
  }
});

// ─── GET /api/admin-requests/:id/soportes/:sid (descarga) ────────────────────
router.get('/:id/soportes/:sid', auth, async (req, res) => {
  const id = parseInt(req.params.id), sid = parseInt(req.params.sid);
  if (!id || !sid) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query(
      `SELECT nombre_archivo, tipo_mime, contenido FROM solicitudes_admin_soportes
        WHERE id_solicitud=$1 AND id_soporte=$2`, [id, sid]);
    if (!r.rows.length) return res.status(404).json({ error: 'Soporte no encontrado.' });
    const f = r.rows[0];
    res.setHeader('Content-Type', f.tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.nombre_archivo)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(f.contenido);
  } catch (err) {
    console.error('[admin-requests] download soporte error:', err.message);
    res.status(500).json({ error: 'Error al descargar el soporte.' });
  }
});

// ─── POST /api/admin-requests/:id/reenviar-notificacion ──────────────────────
router.post('/:id/reenviar-notificacion', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const perm = await getModulePermission(pool, req.user, 'permisos');
    if (!perm.canManage) return res.status(403).json({ error: 'Permisos insuficientes.' });
    const t = await pool.query('SELECT tipo, jefe_correo FROM solicitudes_admin WHERE id_solicitud=$1', [id]);
    if (!t.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (t.rows[0].tipo !== 'Permiso Laboral' || !t.rows[0].jefe_correo)
      return res.status(400).json({ error: 'Esta solicitud no tiene un jefe inmediato registrado para notificar.' });
    const noti = await sendAndStoreNotification(id);
    res.json({ message: 'Notificación procesada.', notificacion: { estado: noti.estado, detalle: noti.detalle } });
  } catch (err) {
    console.error('[admin-requests] reenviar notificación error:', err.message);
    res.status(500).json({ error: 'Error al reenviar la notificación.' });
  }
});

module.exports = router;
