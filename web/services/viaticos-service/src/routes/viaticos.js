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
function formatCurrency(v) {
  const n = parseFloat(v) || 0;
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(n);
}

// ─── GET /api/viaticos ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { q='', estado='', departamento='', page=1, limit=20 } = req.query;
  try {
    const conditions = ['1=1']; const params = []; let idx = 1;
    if (estado && estado !== 'Todos') { conditions.push(`estado = $${idx++}`); params.push(normalizeStatus(estado)); }
    if (departamento && departamento !== 'Todas') { conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`); params.push(`%${departamento}%`); }
    if (q) { conditions.push(`(LOWER(apellidos_nombres) LIKE LOWER($${idx}) OR documento LIKE $${idx} OR LOWER(destino) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }

    const where = conditions.join(' AND ');
    const total = parseInt((await pool.query(`SELECT COUNT(*) FROM viaticos WHERE ${where}`, params)).rows[0].count);

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const rows = await pool.query(
      `SELECT * FROM viaticos WHERE ${where} ORDER BY id_viatico DESC LIMIT $${idx} OFFSET $${idx+1}`,
      params);

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_viatico,
        radicado: `VIT-2026-${String(r.id_viatico).padStart(5,'0')}`,
        persona: upper(r.apellidos_nombres), documento: r.documento,
        dependencia: upper(r.dependencia), cargo: upper(r.cargo),
        destino: upper(r.destino), motivo: r.motivo,
        fechaInicio: r.fecha_inicio, fechaFin: r.fecha_fin,
        dias: r.dias, valorDiario: parseFloat(r.valor_diario)||0,
        valorTotal: parseFloat(r.valor_total)||0,
        valorTotalFormatted: formatCurrency(r.valor_total),
        estado: normalizeStatus(r.estado), observaciones: r.observaciones,
        fechaSolicitud: r.fecha_solicitud, aprobadoPor: r.aprobado_por,
        tipoDestino: r.tipo_destino || 'Nacional', soporte: r.soporte || null,
      })),
      total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('[viaticos] list error:', err.message);
    res.status(500).json({ error: 'Error al listar viáticos.' });
  }
});

// ─── GET /api/viaticos/stats ──────────────────────────────────────────────────
router.get('/stats', auth, async (_, res) => {
  try {
    const r = await pool.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE estado='Pendiente') AS pendientes,
             COUNT(*) FILTER (WHERE estado='Aprobada' OR estado='Finalizada') AS aprobadas,
             COALESCE(SUM(valor_total) FILTER (WHERE estado='Aprobada' OR estado='Finalizada'), 0) AS valor_aprobado
      FROM viaticos`);
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Error estadísticas.' }); }
});

// ─── POST /api/viaticos ───────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte } = req.body;
  if (!persona || !documento || !destino) return res.status(400).json({ error: 'Persona, documento y destino son requeridos.' });

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  try {
    const r = await pool.query(
      `INSERT INTO viaticos(dependencia,apellidos_nombres,documento,cargo,destino,motivo,fecha_inicio,fecha_fin,dias,valor_diario,estado,observaciones,fecha_solicitud,aprobado_por,tipo_destino,soporte)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id_viatico`,
      [upper(dependencia), upper(persona), documento, upper(cargo), upper(destino), motivo||'',
       fechaInicio||'', fechaFin||'', parseInt(dias)||1, parseFloat(valorDiario)||0,
       normalizeStatus(estado), observaciones||'', today, aprobadoPor||'', tipoDestino||'Nacional', soporte||null]);

    const newId = r.rows[0].id_viatico;
    await pool.query(
      'INSERT INTO historial_viaticos(id_viatico,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [newId, normalizeStatus(estado), 'Creado desde interfaz web', req.user.username||'web']);

    res.status(201).json({ message: 'Viático creado.', id: newId, radicado: `VIT-2026-${String(newId).padStart(5,'0')}` });
  } catch (err) {
    console.error('[viaticos] create error:', err.message);
    res.status(500).json({ error: 'Error al crear viático.' });
  }
});

// ─── POST /api/viaticos/bulk (Carga Masiva) ──────────────────────────────────
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
      const documento = (row.documento || row.cedula || row['Cédula'] || row['Documento'] || '').toString().trim();
      const persona = (row.persona || row.nombreCompleto || row.nombre || row['Servidor Público'] || row['Nombre Completo'] || '').toString().trim();
      const dependencia = (row.dependencia || row['Dependencia'] || '').toString().trim();
      const cargo = (row.cargo || row.cargoActual || row['Cargo'] || '').toString().trim();
      const destino = (row.destino || row['Destino'] || 'SIN ESPECIFICAR').toString().trim();
      const motivo = (row.motivo || row.objetoComision || row['Objeto Comisión'] || row['Motivo'] || '').toString().trim();
      const fechaInicio = (row.fechaInicio || row.fechaSalida || row.inicio || row['Fecha Salida'] || row['Fecha Inicio'] || '').toString().trim();
      const fechaFin = (row.fechaFin || row.fechaRetorno || row.fin || row['Fecha Retorno'] || row['Fecha Fin'] || fechaInicio || '').toString().trim();
      const dias = parseInt(row.dias || row['Días'] || 1) || 1;
      const valorDiario = parseFloat(row.valorDiario || row['Valor Diario'] || 0) || 0;
      const estado = normalizeStatus(row.estado || row['Estado'] || 'Pendiente');
      const observaciones = (row.observaciones || row.notas || row['Observaciones'] || '').toString().trim();
      const tipoDestino = (row.tipoDestino || row['Tipo Destino'] || 'Nacional').toString().trim();

      if (!persona || !documento || !destino) {
        errors.push(`Fila ${i + 1}: Documento, servidor y destino son requeridos.`);
        skipped++;
        continue;
      }

      const r = await client.query(
        `INSERT INTO viaticos(dependencia,apellidos_nombres,documento,cargo,destino,motivo,fecha_inicio,fecha_fin,dias,valor_diario,estado,observaciones,fecha_solicitud,aprobado_por,tipo_destino)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id_viatico`,
        [upper(dependencia), upper(persona), documento, upper(cargo)||'NO REGISTRADO', upper(destino), motivo||'Carga masiva Excel',
         fechaInicio||today, fechaFin||today, dias, valorDiario,
         estado, observaciones||'Importado desde Excel', today, '', tipoDestino]);

      const newId = r.rows[0].id_viatico;
      await client.query(
        'INSERT INTO historial_viaticos(id_viatico,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
        [newId, estado, 'Importado masivamente vía Excel', req.user.username||'web']);

      inserted++;
    }

    await client.query('COMMIT');
    res.json({
      message: `Carga masiva completada: ${inserted} viáticos importados, ${skipped} omitidos.`,
      inserted,
      skipped,
      total: rows.length,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[viaticos] bulk error:', err.message);
    res.status(500).json({ error: 'Error durante la carga masiva de viáticos.' });
  } finally {
    client.release();
  }
});

// ─── PUT /api/viaticos/:id ────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte } = req.body;
  try {
    const r = await pool.query(
      `UPDATE viaticos SET dependencia=$1,apellidos_nombres=$2,documento=$3,cargo=$4,destino=$5,motivo=$6,
        fecha_inicio=$7,fecha_fin=$8,dias=$9,valor_diario=$10,estado=$11,observaciones=$12,aprobado_por=$13,
        tipo_destino=COALESCE($14,tipo_destino), soporte=COALESCE($15,soporte)
       WHERE id_viatico=$16 RETURNING id_viatico`,
      [upper(dependencia), upper(persona), documento, upper(cargo), upper(destino), motivo||'',
       fechaInicio||'', fechaFin||'', parseInt(dias)||1, parseFloat(valorDiario)||0,
       normalizeStatus(estado), observaciones||'', aprobadoPor||'', tipoDestino||'Nacional', soporte||null, parseInt(id)]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Viático no encontrado.' });
    await pool.query(
      'INSERT INTO historial_viaticos(id_viatico,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), normalizeStatus(estado), 'Actualizado desde web', req.user.username||'web']);
    res.json({ message: 'Viático actualizado.' });
  } catch (err) {
    console.error('[viaticos] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar viático.' });
  }
});

// ─── PATCH /api/viaticos/:id/status ──────────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { estado, observaciones } = req.body;
  if (!estado) return res.status(400).json({ error: 'El estado es requerido.' });
  try {
    const norm = normalizeStatus(estado);
    const r = await pool.query(
      `UPDATE viaticos SET estado=$1, observaciones = CASE WHEN $2 != '' THEN $2 ELSE observaciones END
       WHERE id_viatico=$3 RETURNING id_viatico, estado`,
      [norm, (observaciones || '').trim(), parseInt(id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Viático no encontrado.' });
    await pool.query(
      'INSERT INTO historial_viaticos(id_viatico,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), norm, (observaciones || 'Cambio rápido de estado').trim(), req.user.username||'web']
    );
    res.json({ message: 'Estado de viático actualizado.', estado: norm });
  } catch (err) {
    console.error('[viaticos] patch status error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado del viático.' });
  }
});

// ─── DELETE /api/viaticos/:id ─────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const numId = parseInt(req.params.id);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query('DELETE FROM viaticos WHERE id_viatico=$1 RETURNING id_viatico', [numId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Viático no encontrado.' });
    res.json({ message: 'Viático eliminado.' });
  } catch (err) {
    console.error('[viaticos] delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar viático.' });
  }
});

module.exports = router;
