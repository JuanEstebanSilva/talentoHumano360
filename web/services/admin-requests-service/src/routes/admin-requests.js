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

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido.' }); }
}
function canEdit(role) {
  return role && (role.toLowerCase().includes('administrador') || role.toLowerCase().includes('coordinador'));
}
function upper(v) { return v == null ? '' : v.trim().replace(/\s+/g,' ').toUpperCase(); }
function normalizeStatus(s) {
  if (!s) return 'Pendiente';
  const e = s.trim().toLowerCase();
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
    schemaPromise = pool.query(SCHEMA_SQL).catch(err => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}
router.use(async (_req, res, next) => {
  try { await ensureSchema(); next(); }
  catch (err) {
    console.error('[admin-requests] schema error:', err.message);
    res.status(503).json({ error: 'La base de datos aún no está lista. Intente de nuevo en unos segundos.' });
  }
});

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
    notificacionEstado: r.notificacion_estado, notificacionDetalle: r.notificacion_detalle,
    soportesCount: r.soportes_count == null ? 0 : parseInt(r.soportes_count),
    duracion: duracionLabel(r),
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

// ─── GET /api/admin-requests ──────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { tipo='', q='', estado='', departamento='', page=1, limit=20 } = req.query;
  if (tipo && !VALID_TIPOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido. Use: ${VALID_TIPOS.join(', ')}` });

  try {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (tipo)       { conditions.push(`tipo = $${idx++}`); params.push(tipo); }
    if (estado && estado !== 'Todos') { conditions.push(`estado = $${idx++}`); params.push(normalizeStatus(estado)); }
    if (departamento && departamento !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`); params.push(`%${departamento}%`);
    }
    if (q) {
      conditions.push(`(LOWER(apellidos_nombres) LIKE LOWER($${idx}) OR documento LIKE $${idx} OR LOWER(dependencia) LIKE LOWER($${idx}))`);
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
      total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('[admin-requests] list error:', err.message);
    res.status(500).json({ error: 'Error al listar solicitudes administrativas.' });
  }
});


// ─── GET /api/admin-requests/stats ───────────────────────────────────────────
router.get('/stats', auth, async (_, res) => {
  try {
    const r = await pool.query(
      `SELECT tipo,
              COUNT(*) FILTER (WHERE estado='Pendiente') AS pendientes,
              COUNT(*) FILTER (WHERE estado='En revisión') AS revision,
              COUNT(*) FILTER (WHERE estado='Aprobada' OR estado='Finalizada') AS aprobadas,
              COUNT(*) AS total
       FROM solicitudes_admin GROUP BY tipo`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error estadísticas.' }); }
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
       RETURNING id_solicitud`,
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
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
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

  const today = todayDMY();

  try {
    const r = await pool.query(
      `INSERT INTO solicitudes_admin(tipo,dependencia,apellidos_nombres,documento,cargo,fecha_inicio,fecha_fin,
        dias_solicitados,motivo,estado,observaciones,fecha_solicitud)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id_solicitud`,
      [tipo, upper(dependencia), upper(persona), documento, upper(cargo),
       fechaInicio||'', fechaFin||'', parseInt(diasSolicitados)||1, motivo||'',
       normalizeStatus(estado), observaciones||'', today]);

    const newId = r.rows[0].id_solicitud;
    await pool.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [newId, normalizeStatus(estado), 'Creado desde interfaz web', req.user.username||'web']);

    res.status(201).json({
      message: 'Solicitud creada.',
      id: newId,
      radicado: `${filingPrefix(tipo)}-2026-${String(newId).padStart(5,'0')}`
    });
  } catch (err) {
    console.error('[admin-requests] create error:', err.message);
    res.status(500).json({ error: 'Error al crear solicitud.' });
  }
});

// ─── POST /api/admin-requests/bulk (Carga Masiva) ────────────────────────────
router.post('/bulk', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  try {
    await client.query('BEGIN');
    const d = new Date();
    const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let tipo = (row.tipo || row['Tipo'] || 'Permiso Laboral').toString().trim();
      if (!VALID_TIPOS.includes(tipo)) {
        const t = tipo.toLowerCase();
        if (t.includes('incap')) tipo = 'Incapacidad';
        else if (t.includes('licen')) tipo = 'Licencia';
        else tipo = 'Permiso Laboral';
      }

      const documento = (row.documento || row.cedula || row['Cédula'] || row['Documento'] || '').toString().trim();
      const persona = (row.persona || row.nombreCompleto || row.nombre || row['Servidor Público'] || row['Nombre Completo'] || '').toString().trim();
      const dependencia = (row.dependencia || row['Dependencia'] || '').toString().trim();
      const cargo = (row.cargo || row.cargoActual || row['Cargo'] || '').toString().trim();
      const fechaInicio = (row.fechaInicio || row.inicio || row['Fecha Inicio'] || '').toString().trim();
      const fechaFin = (row.fechaFin || row.fin || row['Fecha Fin'] || fechaInicio || '').toString().trim();
      const diasSolicitados = parseInt(row.diasSolicitados || row.dias || row['Días'] || 1) || 1;
      const motivo = (row.motivo || row.diagnostico || row['Motivo'] || row['Diagnóstico'] || '').toString().trim();
      const estado = normalizeStatus(row.estado || row['Estado'] || 'Pendiente');
      const observaciones = (row.observaciones || row.notas || row['Observaciones'] || '').toString().trim();

      if (!persona || !documento || !dependencia) {
        errors.push(`Fila ${i + 1}: Documento, servidor y dependencia son requeridos.`);
        skipped++;
        continue;
      }

      const r = await client.query(
        `INSERT INTO solicitudes_admin(tipo,dependencia,apellidos_nombres,documento,cargo,fecha_inicio,fecha_fin,
          dias_solicitados,motivo,estado,observaciones,fecha_solicitud)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id_solicitud`,
        [tipo, upper(dependencia), upper(persona), documento, upper(cargo)||'NO REGISTRADO',
         fechaInicio||today, fechaFin||today, diasSolicitados, motivo||'Carga masiva Excel',
         estado, observaciones||'Importado desde Excel', today]);

      const newId = r.rows[0].id_solicitud;
      await client.query(
        'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
        [newId, estado, 'Importado masivamente vía Excel', req.user.username||'web']);

      inserted++;
    }

    await client.query('COMMIT');
    res.json({
      message: `Carga masiva completada: ${inserted} solicitudes importadas, ${skipped} omitidas.`,
      inserted,
      skipped,
      total: rows.length,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin-requests] bulk error:', err.message);
    res.status(500).json({ error: 'Error durante la carga masiva de solicitudes administrativas.' });
  } finally {
    client.release();
  }
});

// ─── Edición de Permiso Laboral (misma validación que la creación) ───────────
async function updatePermiso(req, res, id) {
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
  const estado = normalizeStatus(req.body.estado);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE solicitudes_admin SET dependencia=$1,apellidos_nombres=$2,documento=$3,cargo=$4,fecha_inicio=$5,fecha_fin=$6,
         dias_solicitados=$7,motivo=$8,estado=$9,observaciones=$10,nota_gestion=$11,aprobado_por=$12,
         correo_solicitante=$13,codigo=$14,grado=$15,sectorial=$16,nivel=$17,modalidad=$18,jornada=$19,hora_entrada=$20,hora_salida=$21,
         horas_solicitadas=$22,motivo_categoria=$23,motivo_incentivo=$24,jefe_nombre=$25,jefe_correo=$26
       WHERE id_solicitud=$27`,
      [d.dependencia, d.persona, d.documento, d.cargo, d.fechaInicio, d.fechaFin,
       d.dias, d.motivoLabel, estado, d.observaciones,
       String(req.body.notaGestion || '').trim().slice(0, 480), String(req.body.aprobadoPor || '').trim().slice(0, 150),
       d.correoSolicitante, d.codigo, d.grado, d.sectorial, d.nivel, d.modalidad, d.jornada, d.horaEntrada, d.horaSalida,
       d.horasSolicitadas, d.motivoCategoria, d.motivoIncentivo, d.jefeNombre, d.jefeCorreo, id]);
    if (aEliminar.length)
      await client.query('DELETE FROM solicitudes_admin_soportes WHERE id_solicitud=$1 AND id_soporte = ANY($2::int[])', [id, aEliminar]);
    await insertSoportes(client, id, d.soportes, username);
    await client.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [id, estado, String(req.body.notaGestion || '').trim() || 'Actualizado desde web', username]);
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
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;

  // Permisos Laborales editados desde el formulario nuevo
  if (req.body.modalidad) {
    try {
      const t = await pool.query('SELECT tipo FROM solicitudes_admin WHERE id_solicitud=$1', [parseInt(id)]);
      if (!t.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      if (t.rows[0].tipo === 'Permiso Laboral') return await updatePermiso(req, res, parseInt(id));
    } catch (err) {
      console.error('[admin-requests] update permiso (unexpected):', err.message);
      return res.status(500).json({ error: 'Error al actualizar la solicitud de permiso.' });
    }
  }

  const { persona, documento, dependencia, cargo, fechaInicio, fechaFin, diasSolicitados, motivo, estado, observaciones, notaGestion, aprobadoPor } = req.body;
  try {

    const r = await pool.query(
      `UPDATE solicitudes_admin SET apellidos_nombres=$1,documento=$2,dependencia=$3,cargo=$4,fecha_inicio=$5,
        fecha_fin=$6,dias_solicitados=$7,motivo=$8,estado=$9,observaciones=$10,nota_gestion=$11,aprobado_por=$12
       WHERE id_solicitud=$13 RETURNING id_solicitud`,
      [upper(persona), documento, upper(dependencia), upper(cargo), fechaInicio||'', fechaFin||'',
       parseInt(diasSolicitados)||1, motivo||'', normalizeStatus(estado), observaciones||'',
       notaGestion||'', aprobadoPor||'', parseInt(id)]);

    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await pool.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), normalizeStatus(estado), notaGestion||'Actualizado desde web', req.user.username||'web']);
    res.json({ message: 'Solicitud actualizada.' });
  } catch (err) {
    console.error('[admin-requests] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar.' });
  }
});

// ─── PATCH /api/admin-requests/:id/status ────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { estado, notaGestion } = req.body;
  if (!estado) return res.status(400).json({ error: 'El estado es requerido.' });
  try {
    const norm = normalizeStatus(estado);
    const r = await pool.query(
      `UPDATE solicitudes_admin SET estado=$1, nota_gestion = CASE WHEN $2 != '' THEN $2 ELSE nota_gestion END
       WHERE id_solicitud=$3 RETURNING id_solicitud, estado`,
      [norm, (notaGestion || '').trim(), parseInt(id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await pool.query(
      'INSERT INTO historial_solicitudes_admin(id_solicitud,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), norm, (notaGestion || 'Cambio rápido de estado').trim(), req.user.username||'web']
    );
    res.json({ message: 'Estado de solicitud administrativa actualizado.', estado: norm });
  } catch (err) {
    console.error('[admin-requests] patch status error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

// ─── DELETE /api/admin-requests/:id ──────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const numId = parseInt(req.params.id);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query('DELETE FROM solicitudes_admin WHERE id_solicitud=$1 RETURNING id_solicitud', [numId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
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
      id: s.id_soporte, nombre: s.nombre_archivo, tipo: s.tipo_mime,
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
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  try {
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

