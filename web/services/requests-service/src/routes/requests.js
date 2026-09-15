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
  if (e.includes('finaliz') || e.includes('completad')) return 'Finalizada';
  if (e.includes('rechazad')) return 'Rechazada';
  if (e.includes('revis')) return 'En revisión';
  return 'Pendiente';
}
function filingNumber(id, type) {
  const prefix = type === 'Incapacidad' ? 'INCA' : type === 'Permiso' ? 'PER' : type === 'Licencia maternidad' ? 'MAT' : 'VAC';
  return `${prefix}-2026-${String(Math.abs(id)).padStart(5,'0')}`;
}
function recordType(notes, tipo) {
  const n = (notes||'').toLowerCase(); const t = (tipo||'').toLowerCase();
  if (t.includes('matern') || n.includes('matern')) return 'Licencia maternidad';
  if (t.includes('permiso') || n.includes('permiso')) return 'Permiso';
  if (t.includes('incap') || n.includes('incap')) return 'Incapacidad';
  if (t.includes('vacacion') || n.includes('vacacion')) return 'Vacaciones';
  return tipo || 'Vacaciones';
}

// ─── GET /api/requests ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { q='', tipo='', estado='', departamento='', cargo='', fechaInicio='', fechaFin='', page=1, limit=20 } = req.query;
  try {
    const rows = await pool.query(`
      SELECT id_vacacion, COALESCE(dependencia,'') AS dependencia,
             COALESCE(apellidos_nombres,'') AS persona, COALESCE(documento,'') AS documento,
             COALESCE(cargo,'') AS cargo, COALESCE(fecha_ingreso,'') AS fecha_inicio,
             COALESCE(dias_totales,'') AS dias_totales, COALESCE(periodos,'') AS periodos,
             COALESCE(observaciones,'') AS observaciones, COALESCE(tipo_vinculacion,'') AS tipo_vinculacion,
             COALESCE(estado,'Pendiente') AS estado, COALESCE(hoy,'') AS fecha_solicitud, COALESCE(numero,'') AS numero
      FROM vacaciones ORDER BY id_vacacion DESC LIMIT 2000`);

    let data = rows.rows.map(r => {
      const tipo_real = recordType(r.observaciones, r.tipo_vinculacion);
      const est = normalizeStatus(r.estado);
      return {
        id: r.id_vacacion,
        radicado: filingNumber(r.id_vacacion, tipo_real),
        tipo: tipo_real,
        persona: upper(r.persona),
        documento: r.documento,
        dependencia: upper(r.dependencia),
        cargo: upper(r.cargo),
        fechaInicio: r.fecha_inicio,
        diasTotales: r.dias_totales,
        periodos: r.periodos,
        observaciones: r.observaciones,
        estado: est,
        fechaSolicitud: r.fecha_solicitud,
        numero: r.numero,
      };
    });

    // Server-side filters
    if (tipo)       data = data.filter(d => d.tipo === tipo);
    if (estado && estado !== 'Todos') data = data.filter(d => d.estado === estado);
    if (departamento && departamento !== 'Todas') data = data.filter(d => d.dependencia.includes(upper(departamento)));
    if (cargo && cargo !== 'Todos') data = data.filter(d => d.cargo.includes(upper(cargo)));
    if (q) {
      const f = q.toLowerCase();
      data = data.filter(d => d.persona.toLowerCase().includes(f) || d.documento.includes(f) ||
        d.dependencia.toLowerCase().includes(f) || d.radicado.toLowerCase().includes(f));
    }

    const total = data.length;
    const off = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    res.json({ data: data.slice(off, off + parseInt(limit)), total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('[requests] list error:', err.message);
    res.status(500).json({ error: 'Error al listar solicitudes.' });
  }
});

// ─── GET /api/requests/catalogs ───────────────────────────────────────────────
router.get('/catalogs', auth, async (_, res) => {
  try {
    const [deps, cargos] = await Promise.all([
      pool.query('SELECT dependencia FROM dependencias ORDER BY dependencia'),
      pool.query('SELECT cargo FROM cargos ORDER BY cargo'),
    ]);
    res.json({
      departamentos: deps.rows.map(r => upper(r.dependencia)).filter(Boolean),
      cargos: cargos.rows.map(r => upper(r.cargo)).filter(Boolean),
    });
  } catch { res.status(500).json({ error: 'Error catálogos.' }); }
});

// ─── POST /api/requests ───────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { persona, documento, dependencia, cargo, fechaInicio, diasTotales, tipo, estadoInicial, observaciones, periodos } = req.body;
  if (!persona || !documento || !dependencia || !fechaInicio)
    return res.status(400).json({ error: 'Persona, documento, dependencia y fecha son requeridos.' });

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const numero = 'SOL-WEB-' + String(Math.abs(Date.now() % 100000)).padStart(5,'0');
  const notaFinal = `Tipo: ${tipo||'Vacaciones'} | Estado inicial: ${estadoInicial||'Pendiente'}` + (observaciones ? ` | ${observaciones}` : '');

  try {
    const r = await pool.query(`
      INSERT INTO vacaciones(dependencia,numero,apellidos_nombres,titular_cargo,genero,documento,
        fecha_ingreso,cargo,codigo,grado,sueldo,gastos_rep,fecha_corte,hoy,dias_totales,anos,meses,
        periodos,observaciones,tipo_vinculacion,estado,revision_planta)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'N/A','N/A','$0','$0',$9,$10,$11,'0','0',$12,$13,$14,$15,$16)
      RETURNING id_vacacion`,
      [upper(dependencia), numero, upper(persona), upper(cargo)||'NO REGISTRADO', 'NO REGISTRADO',
       documento, fechaInicio||'NO REGISTRADO', upper(cargo)||'NO REGISTRADO', today, today,
       String(diasTotales||1), periodos||'Periodo actual', notaFinal, tipo||'Vacaciones',
       normalizeStatus(estadoInicial), 'Creado desde interfaz web']);

    const newId = r.rows[0].id_vacacion;
    // Record history
    await pool.query('INSERT INTO historial_solicitudes(id_vacacion,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [newId, normalizeStatus(estadoInicial), 'Creado desde interfaz web', req.user.username || 'web']);

    res.status(201).json({ message: 'Solicitud creada.', id: newId, radicado: filingNumber(newId, tipo||'Vacaciones') });
  } catch (err) {
    console.error('[requests] create error:', err.message);
    res.status(500).json({ error: 'Error al crear solicitud.' });
  }
});

// ─── POST /api/requests/bulk (Carga Masiva) ──────────────────────────────────
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
      const fechaInicio = (row.fechaInicio || row.inicio || row['Fecha Inicio'] || '').toString().trim();
      const diasTotales = parseInt(row.diasTotales || row.dias || row['Días'] || 1) || 1;
      const tipo = (row.tipo || row['Tipo'] || 'Vacaciones').toString().trim();
      const estado = normalizeStatus(row.estado || row['Estado'] || 'Pendiente');
      const observaciones = (row.observaciones || row.notas || row['Observaciones'] || '').toString().trim();
      const periodos = (row.periodos || row['Periodo'] || 'Periodo actual').toString().trim();

      if (!persona || !documento || !dependencia) {
        errors.push(`Fila ${i + 1}: Documento, servidor y dependencia son requeridos.`);
        skipped++;
        continue;
      }

      const numero = 'SOL-BULK-' + String(Math.abs(Date.now() + i) % 100000).padStart(5,'0');
      const notaFinal = `Carga masiva | Tipo: ${tipo} | Estado: ${estado}` + (observaciones ? ` | ${observaciones}` : '');

      const r = await client.query(`
        INSERT INTO vacaciones(dependencia,numero,apellidos_nombres,titular_cargo,genero,documento,
          fecha_ingreso,cargo,codigo,grado,sueldo,gastos_rep,fecha_corte,hoy,dias_totales,anos,meses,
          periodos,observaciones,tipo_vinculacion,estado,revision_planta)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'N/A','N/A','$0','$0',$9,$10,$11,'0','0',$12,$13,$14,$15,$16)
        RETURNING id_vacacion`,
        [upper(dependencia), numero, upper(persona), upper(cargo)||'NO REGISTRADO', 'NO REGISTRADO',
         documento, fechaInicio||today, upper(cargo)||'NO REGISTRADO', today, today,
         String(diasTotales), periodos, notaFinal, tipo, estado, 'Importado desde archivo Excel']);

      const newId = r.rows[0].id_vacacion;
      await client.query('INSERT INTO historial_solicitudes(id_vacacion,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
        [newId, estado, 'Importado masivamente vía Excel', req.user.username || 'web']);

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
    console.error('[requests] bulk error:', err.message);
    res.status(500).json({ error: 'Error durante la carga masiva de solicitudes.' });
  } finally {
    client.release();
  }
});

// ─── PUT /api/requests/:id ────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { persona, documento, dependencia, cargo, fechaInicio, diasTotales, tipo, estado, observaciones, periodos, notaGestion } = req.body;

  try {
    const r = await pool.query(`
      UPDATE vacaciones SET dependencia=$1,apellidos_nombres=$2,documento=$3,fecha_ingreso=$4,
        cargo=$5,titular_cargo=$6,dias_totales=$7,periodos=$8,observaciones=$9,tipo_vinculacion=$10,
        estado=$11,revision_planta=$12
      WHERE id_vacacion=$13 RETURNING id_vacacion`,
      [upper(dependencia), upper(persona), documento, fechaInicio, upper(cargo), upper(cargo),
       String(diasTotales||1), periodos||'Periodo actual', observaciones||'',
       tipo||'Vacaciones', normalizeStatus(estado), notaGestion||'Actualizado desde web', parseInt(id)]);

    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await pool.query('INSERT INTO historial_solicitudes(id_vacacion,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), normalizeStatus(estado), notaGestion||'Actualizado desde web', req.user.username||'web']);
    res.json({ message: 'Solicitud actualizada.' });
  } catch (err) {
    console.error('[requests] update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar.' });
  }
});

// ─── PATCH /api/requests/:id/status ──────────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { estado, notaGestion } = req.body;
  if (!estado) return res.status(400).json({ error: 'El estado es requerido.' });
  try {
    const norm = normalizeStatus(estado);
    const r = await pool.query(
      `UPDATE vacaciones SET estado=$1, revision_planta = CASE WHEN $2 != '' THEN $2 ELSE revision_planta END
       WHERE id_vacacion=$3 RETURNING id_vacacion, estado`,
      [norm, (notaGestion || '').trim(), parseInt(id)]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await pool.query(
      'INSERT INTO historial_solicitudes(id_vacacion,estado_nuevo,nota,actualizado_por) VALUES($1,$2,$3,$4)',
      [parseInt(id), norm, (notaGestion || 'Cambio rápido de estado').trim(), req.user.username || 'web']
    );
    res.json({ message: 'Estado de solicitud actualizado.', estado: norm });
  } catch (err) {
    console.error('[requests] patch status error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

// ─── DELETE /api/requests/:id ─────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const numId = parseInt(id);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID inválido.' });
  try {
    await pool.query('DELETE FROM historial_solicitudes WHERE id_vacacion=$1', [numId]);
    const r = await pool.query('DELETE FROM vacaciones WHERE id_vacacion=$1 RETURNING id_vacacion', [numId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    res.json({ message: 'Solicitud eliminada.' });
  } catch (err) {
    console.error('[requests] delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar.' });
  }
});

module.exports = router;
