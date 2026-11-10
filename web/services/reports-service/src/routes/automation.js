const router = require('express').Router();

const pool = require('../db');
const { getSource } = require('../utils/catalog');
const { ReportError, MAX_ROWS, runReport, validateDefinition } = require('../utils/reportEngine');
const { parseBogotaDateTime, computeNextRun, validateSchedule } = require('../utils/schedule');
const { auth, hasFullAccess, canAutomate, canAccessSource, userFromRow } = require('../utils/permissions');

const TICK_MS = 30 * 1000;
const EXECUTIONS_KEPT = 30; // Por automatización, para que los resultados guardados no crezcan sin límite.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, err, context) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ReportError) return res.status(400).json({ error: err.message });
  console.error(`[automation] ${context}:`, err.message);
  return res.status(500).json({ error: 'Error interno del módulo de automatización.' });
}

function requireAutomate(req, res, next) {
  if (!canAutomate(req.user)) return res.status(403).json({ error: 'No tienes permiso para programar informes.' });
  next();
}

function parseId(value, label = 'Automatización') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(404, `${label} no encontrada.`);
  return id;
}

const LAST_EXECUTION = `
  LEFT JOIN LATERAL (
    SELECT e.estado AS ultimo_estado, e.mensaje AS ultimo_mensaje, e.total_filas AS ultimo_total
      FROM automatizacion_ejecuciones e
     WHERE e.id_automatizacion = a.id_automatizacion
     ORDER BY e.iniciado_en DESC, e.id_ejecucion DESC LIMIT 1
  ) le ON TRUE`;

function toDto(row) {
  return {
    id: row.id_automatizacion,
    nombre: row.nombre,
    fuente: row.fuente,
    fuenteNombre: getSource(row.fuente)?.nombre || row.fuente,
    filtros: row.filtros,
    columnas: row.columnas,
    frecuencia: row.frecuencia,
    intervalo: row.intervalo,
    unidad: row.unidad,
    inicio: row.inicio,
    proximaEjecucion: row.proxima_ejecucion,
    ultimaEjecucion: row.ultima_ejecucion,
    estado: row.estado,
    creadoPor: row.creado_por,
    ultimoEstado: row.ultimo_estado || null,
    ultimoMensaje: row.ultimo_mensaje || null,
    ultimoTotal: row.ultimo_total ?? null,
  };
}

// Solo el creador, Administrador o Coordinador. Si no corresponde, responde como si no existiera.
async function loadOwned(db, id, user) {
  const { rows } = await db.query(
    `SELECT a.*, le.* FROM automatizaciones a ${LAST_EXECUTION} WHERE a.id_automatizacion = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Automatización no encontrada.');
  if (!hasFullAccess(user) && String(row.creado_por).toLowerCase() !== String(user.username).toLowerCase()) {
    throw new HttpError(404, 'Automatización no encontrada.');
  }
  return row;
}

function readDefinition(body, user) {
  const b = body || {};
  const nombre = String(b.nombre || '').trim().slice(0, 160);
  if (!nombre) throw new HttpError(400, 'El nombre de la automatización es obligatorio.');

  const source = validateDefinition(b.fuente, b.filtros || {}, b.columnas);
  if (!canAccessSource(user, source)) throw new HttpError(403, 'No tienes acceso a los datos de este informe.');

  const intervalo = b.frecuencia === 'personalizada' ? Number(b.intervalo) : null;
  const unidad = b.frecuencia === 'personalizada' ? b.unidad : null;
  const scheduleError = validateSchedule({ frecuencia: b.frecuencia, intervalo, unidad });
  if (scheduleError) throw new HttpError(400, scheduleError);

  const inicio = parseBogotaDateTime(b.inicio);
  if (!inicio) throw new HttpError(400, 'Indica una fecha y hora de ejecución válidas.');

  return {
    nombre, fuente: b.fuente, filtros: b.filtros || {},
    columnas: Array.isArray(b.columnas) ? b.columnas : [],
    frecuencia: b.frecuencia, intervalo, unidad, inicio,
    proxima: computeNextRun({ frecuencia: b.frecuencia, intervalo, unidad, inicio }),
  };
}

// ─── Ejecución ────────────────────────────────────────────────────────────────
async function executeAutomation(automation, origen) {
  const { rows } = await pool.query(
    `INSERT INTO automatizacion_ejecuciones (id_automatizacion, origen, fuente, fuente_nombre)
     VALUES ($1, $2, $3, $4) RETURNING id_ejecucion`,
    [automation.id_automatizacion, origen, automation.fuente, getSource(automation.fuente)?.nombre || automation.fuente]
  );
  const idEjecucion = rows[0].id_ejecucion;

  try {
    // Se usan los permisos actuales del creador: si se le retiró el acceso, ya no se generan datos.
    const owner = await pool.query(
      'SELECT username, rol, modulos, permisos, estado FROM usuarios WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [automation.creado_por]
    );
    const row = owner.rows[0];
    if (!row || String(row.estado || '').toUpperCase() !== 'ACTIVO') {
      throw new ReportError('El usuario que creó esta automatización ya no está activo.');
    }
    if (!canAccessSource(userFromRow(row), getSource(automation.fuente))) {
      throw new ReportError('El usuario que creó esta automatización ya no tiene acceso a estos datos.');
    }

    const result = await runReport(pool, {
      fuente: automation.fuente,
      filtros: automation.filtros,
      columnas: automation.columnas,
    });
    const truncado = result.total > MAX_ROWS;
    await pool.query(
      `UPDATE automatizacion_ejecuciones
          SET estado = 'Exitosa', finalizado_en = NOW(), total_filas = $2, truncado = $3, mensaje = $4,
              criterios = $5::jsonb, columnas = $6::jsonb, filas = $7::jsonb
        WHERE id_ejecucion = $1`,
      [
        idEjecucion, result.total, truncado,
        result.total === 0 ? 'Sin resultados para los criterios configurados.' : null,
        JSON.stringify(result.criterios), JSON.stringify(result.columnas), JSON.stringify(result.filas),
      ]
    );
  } catch (err) {
    if (!(err instanceof ReportError)) console.error(`[automation] ejecución ${idEjecucion}:`, err.message);
    const message = err instanceof ReportError ? err.message : 'Error interno al generar el informe.';
    await pool.query(
      `UPDATE automatizacion_ejecuciones SET estado = 'Error', finalizado_en = NOW(), mensaje = $2 WHERE id_ejecucion = $1`,
      [idEjecucion, message]
    );
  }

  await pool.query(
    `DELETE FROM automatizacion_ejecuciones
      WHERE id_automatizacion = $1 AND id_ejecucion NOT IN (
        SELECT id_ejecucion FROM automatizacion_ejecuciones
         WHERE id_automatizacion = $1 ORDER BY iniciado_en DESC, id_ejecucion DESC LIMIT ${EXECUTIONS_KEPT}
      )`,
    [automation.id_automatizacion]
  );
  return idEjecucion;
}

// Reserva las tareas vencidas dentro de una transacción: aunque haya varias instancias
// del servicio, cada tarea la ejecuta una sola.
async function claimDueAutomations(now = new Date()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM automatizaciones
        WHERE estado = 'Activa' AND proxima_ejecucion <= $1
        ORDER BY proxima_ejecucion LIMIT 10 FOR UPDATE SKIP LOCKED`,
      [now]
    );
    for (const row of rows) {
      await client.query(
        'UPDATE automatizaciones SET proxima_ejecucion = $2, ultima_ejecucion = $3 WHERE id_automatizacion = $1',
        [row.id_automatizacion, computeNextRun(row, now), now]
      );
    }
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    // Ejecuciones interrumpidas por un reinicio no deben quedar "En curso" para siempre.
    await pool.query(
      `UPDATE automatizacion_ejecuciones SET estado = 'Error', finalizado_en = NOW(), mensaje = 'La ejecución se interrumpió.'
        WHERE estado = 'En curso' AND iniciado_en < NOW() - INTERVAL '30 minutes'`
    );
    const due = await claimDueAutomations();
    for (const automation of due) await executeAutomation(automation, 'Programada');
  } catch (err) {
    // Al primer arranque las tablas pueden no existir aún: el siguiente ciclo lo reintenta.
    if (err.code !== '42P01') console.error('[automation] programador:', err.message);
  } finally {
    ticking = false;
  }
}

if (process.env.REPORTS_SCHEDULER !== 'off') {
  setInterval(tick, TICK_MS).unref();
  setTimeout(tick, 5000).unref();
}

// ─── Historial (antes de /:id) ────────────────────────────────────────────────
router.get('/ejecuciones', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const conditions = [];
  const params = [];
  if (!hasFullAccess(req.user)) {
    params.push(req.user.username);
    conditions.push(`LOWER(a.creado_por) = LOWER($${params.length})`);
  }
  if (req.query.automatizacion) {
    params.push(Number(req.query.automatizacion) || 0);
    conditions.push(`e.id_automatizacion = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [list, count] = await Promise.all([
      pool.query(
        `SELECT e.id_ejecucion AS id, e.id_automatizacion AS "idAutomatizacion", a.nombre AS "automatizacion",
                e.origen, e.estado, e.iniciado_en AS "iniciadoEn", e.finalizado_en AS "finalizadoEn",
                e.total_filas AS total, e.truncado, e.mensaje, e.fuente_nombre AS "fuenteNombre"
           FROM automatizacion_ejecuciones e
           JOIN automatizaciones a ON a.id_automatizacion = e.id_automatizacion
           ${where}
          ORDER BY e.iniciado_en DESC, e.id_ejecucion DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM automatizacion_ejecuciones e
           JOIN automatizaciones a ON a.id_automatizacion = e.id_automatizacion ${where}`,
        params
      ),
    ]);
    const total = Number(count.rows[0].total);
    return res.json({ data: list.rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    return sendError(res, err, 'historial');
  }
});

router.get('/ejecuciones/:id', auth, async (req, res) => {
  try {
    const id = parseId(req.params.id, 'Ejecución');
    const { rows } = await pool.query(
      `SELECT e.*, a.nombre AS automatizacion, a.creado_por
         FROM automatizacion_ejecuciones e
         JOIN automatizaciones a ON a.id_automatizacion = e.id_automatizacion
        WHERE e.id_ejecucion = $1`,
      [id]
    );
    const row = rows[0];
    const isOwner = row && String(row.creado_por).toLowerCase() === String(req.user.username).toLowerCase();
    // El permiso se revisa contra la fuente que generó estas filas, no la actual de la automatización.
    if (!row || (!hasFullAccess(req.user) && !isOwner) || !canAccessSource(req.user, getSource(row.fuente))) {
      throw new HttpError(404, 'Ejecución no encontrada.');
    }
    return res.json({
      id: row.id_ejecucion,
      automatizacion: row.automatizacion,
      origen: row.origen,
      estado: row.estado,
      iniciadoEn: row.iniciado_en,
      finalizadoEn: row.finalizado_en,
      mensaje: row.mensaje,
      truncado: row.truncado,
      fuente: row.fuente,
      fuenteNombre: row.fuente_nombre,
      total: row.total_filas ?? 0,
      criterios: row.criterios || [],
      columnas: row.columnas || [],
      filas: row.filas || [],
      generadoEn: row.finalizado_en || row.iniciado_en,
    });
  } catch (err) {
    return sendError(res, err, 'detalle de ejecución');
  }
});

// ─── Automatizaciones ─────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const own = !hasFullAccess(req.user);
    const { rows } = await pool.query(
      `SELECT a.*, le.* FROM automatizaciones a ${LAST_EXECUTION}
        ${own ? 'WHERE LOWER(a.creado_por) = LOWER($1)' : ''}
        ORDER BY a.estado, a.proxima_ejecucion NULLS LAST, a.id_automatizacion DESC`,
      own ? [req.user.username] : []
    );
    return res.json({ data: rows.map(toDto) });
  } catch (err) {
    return sendError(res, err, 'listar');
  }
});

router.post('/', auth, requireAutomate, async (req, res) => {
  try {
    const d = readDefinition(req.body, req.user);
    const { rows } = await pool.query(
      `INSERT INTO automatizaciones (nombre, fuente, filtros, columnas, frecuencia, intervalo, unidad, inicio, proxima_ejecucion, creado_por)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10)
       RETURNING id_automatizacion`,
      [d.nombre, d.fuente, JSON.stringify(d.filtros), JSON.stringify(d.columnas), d.frecuencia, d.intervalo, d.unidad, d.inicio, d.proxima, req.user.username]
    );
    return res.status(201).json(toDto(await loadOwned(pool, rows[0].id_automatizacion, req.user)));
  } catch (err) {
    return sendError(res, err, 'crear');
  }
});

router.put('/:id', auth, requireAutomate, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const current = await loadOwned(pool, id, req.user);
    const d = readDefinition(req.body, req.user);
    await pool.query(
      `UPDATE automatizaciones
          SET nombre = $2, fuente = $3, filtros = $4::jsonb, columnas = $5::jsonb, frecuencia = $6, intervalo = $7,
              unidad = $8, inicio = $9, proxima_ejecucion = $10, actualizado_en = NOW()
        WHERE id_automatizacion = $1`,
      [id, d.nombre, d.fuente, JSON.stringify(d.filtros), JSON.stringify(d.columnas), d.frecuencia, d.intervalo, d.unidad, d.inicio,
        current.estado === 'Activa' ? d.proxima : null]
    );
    return res.json(toDto(await loadOwned(pool, id, req.user)));
  } catch (err) {
    return sendError(res, err, 'actualizar');
  }
});

router.post('/:id/pausar', auth, requireAutomate, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    await loadOwned(pool, id, req.user);
    await pool.query(
      `UPDATE automatizaciones SET estado = 'Pausada', proxima_ejecucion = NULL, actualizado_en = NOW() WHERE id_automatizacion = $1`,
      [id]
    );
    return res.json(toDto(await loadOwned(pool, id, req.user)));
  } catch (err) {
    return sendError(res, err, 'pausar');
  }
});

router.post('/:id/reanudar', auth, requireAutomate, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const current = await loadOwned(pool, id, req.user);
    await pool.query(
      `UPDATE automatizaciones SET estado = 'Activa', proxima_ejecucion = $2, actualizado_en = NOW() WHERE id_automatizacion = $1`,
      [id, computeNextRun(current)]
    );
    return res.json(toDto(await loadOwned(pool, id, req.user)));
  } catch (err) {
    return sendError(res, err, 'reanudar');
  }
});

router.post('/:id/ejecutar', auth, requireAutomate, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const current = await loadOwned(pool, id, req.user);
    const idEjecucion = await executeAutomation(current, 'Manual');
    await pool.query('UPDATE automatizaciones SET ultima_ejecucion = NOW() WHERE id_automatizacion = $1', [id]);
    const { rows } = await pool.query(
      'SELECT estado, mensaje, total_filas AS total FROM automatizacion_ejecuciones WHERE id_ejecucion = $1',
      [idEjecucion]
    );
    return res.json({ idEjecucion, ...rows[0] });
  } catch (err) {
    return sendError(res, err, 'ejecutar');
  }
});

router.delete('/:id', auth, requireAutomate, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    await loadOwned(pool, id, req.user);
    await pool.query('DELETE FROM automatizaciones WHERE id_automatizacion = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'eliminar');
  }
});

router.tick = tick; // Para las pruebas.

module.exports = router;
