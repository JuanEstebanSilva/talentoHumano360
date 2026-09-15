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
      `SELECT * FROM solicitudes_admin WHERE ${where} ORDER BY id_solicitud DESC LIMIT $${idx} OFFSET $${idx+1}`,
      params);

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_solicitud,
        radicado: `${filingPrefix(r.tipo)}-2026-${String(r.id_solicitud).padStart(5,'0')}`,
        tipo: r.tipo, persona: upper(r.apellidos_nombres), documento: r.documento,
        dependencia: upper(r.dependencia), cargo: upper(r.cargo),
        fechaInicio: r.fecha_inicio, fechaFin: r.fecha_fin,
        diasSolicitados: r.dias_solicitados, motivo: r.motivo,
        estado: normalizeStatus(r.estado), observaciones: r.observaciones,
        fechaSolicitud: r.fecha_solicitud, aprobadoPor: r.aprobado_por,
        notaGestion: r.nota_gestion,
      })),
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

// ─── POST /api/admin-requests ─────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { tipo, persona, documento, dependencia, cargo, fechaInicio, fechaFin, diasSolicitados, motivo, estado, observaciones } = req.body;

  if (!tipo || !VALID_TIPOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido. Use: ${VALID_TIPOS.join(', ')}` });
  if (!persona || !documento)
    return res.status(400).json({ error: 'Persona y documento son requeridos.' });

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
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

// ─── PUT /api/admin-requests/:id ─────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
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

module.exports = router;
