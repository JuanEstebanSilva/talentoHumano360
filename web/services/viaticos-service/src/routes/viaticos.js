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
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido o sesión expirada.' }); }
}
function canEdit(roleOrUser) {
  if (!roleOrUser) return false;
  const role = String(typeof roleOrUser === 'string' ? roleOrUser : (roleOrUser.role || roleOrUser.rol || '')).toLowerCase();
  const uname = String(typeof roleOrUser === 'object' ? (roleOrUser.username || '') : '').toLowerCase();
  const mods = (typeof roleOrUser === 'object' && Array.isArray(roleOrUser.modules)) ? roleOrUser.modules : [];
  if (role.includes('administrador') || role.includes('coordinador') || role.includes('admin') || uname === 'admin') return true;
  if (mods.includes('*') || mods.includes('all') || mods.includes('viaticos')) return true;
  if (uname.includes('bergenet')) return true;
  return false;
}

// Garantizar tabla paquetes_viaticos y columnas en tabla viaticos
async function ensureViaticosColumns() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paquetes_viaticos (
        id_paquete SERIAL PRIMARY KEY,
        nombre VARCHAR(280) NOT NULL,
        archivo_origen VARCHAR(280),
        anio INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
        descripcion TEXT,
        creado_por VARCHAR(120) DEFAULT 'admin',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS id_paquete INT REFERENCES paquetes_viaticos(id_paquete) ON DELETE CASCADE;
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS numero_resolucion VARCHAR(120);
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS saldo NUMERIC(15,2);
      CREATE INDEX IF NOT EXISTS idx_viaticos_resolucion ON viaticos(numero_resolucion);
      CREATE INDEX IF NOT EXISTS idx_viaticos_paquete ON viaticos(id_paquete);
      CREATE INDEX IF NOT EXISTS idx_paquetes_anio ON paquetes_viaticos(anio);
    `);
    console.log('[viaticos-service] Columnas y tabla paquetes_viaticos garantizadas.');
  } catch (err) {
    console.warn('[viaticos-service] ensureViaticosColumns aviso:', err.message);
  }
}
ensureViaticosColumns();

function excelSerialToDate(serial) {
  const s = Number(serial);
  if (isNaN(s) || s < 1) return null;
  const days = s > 60 ? s - 1 : s;
  const epoch = new Date(Date.UTC(1899, 11, 31));
  const ms = epoch.getTime() + days * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function upper(v) { return v == null ? '' : v.trim().replace(/\s+/g,' ').toUpperCase(); }
function normalizeTokens(str) {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}
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

// ─── RUTAS DE PAQUETES DE VIÁTICOS (EXCELS / VIGENCIAS) ───────────────────────

// GET /api/viaticos/paquetes — Lista todos los paquetes con conteos y totales
router.get('/paquetes', auth, async (req, res) => {
  try {
    const q = `
      SELECT 
        p.id_paquete,
        p.nombre,
        p.archivo_origen,
        p.anio,
        p.descripcion,
        p.creado_por,
        p.creado_en,
        p.actualizado_en,
        COUNT(v.id_viatico)::int AS total_viaticos,
        COUNT(v.id_viatico) FILTER (WHERE v.estado = 'Pendiente')::int AS pendientes,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Aprobada', 'Finalizada'))::int AS aprobadas,
        COALESCE(SUM(v.valor_total) FILTER (WHERE v.estado IN ('Aprobada', 'Finalizada')), 0)::numeric(15,2) AS valor_aprobado
      FROM paquetes_viaticos p
      LEFT JOIN viaticos v ON v.id_paquete = p.id_paquete
      GROUP BY p.id_paquete, p.nombre, p.archivo_origen, p.anio, p.descripcion, p.creado_por, p.creado_en, p.actualizado_en
      ORDER BY p.anio DESC, p.id_paquete DESC
    `;
    const rows = await pool.query(q);
    res.json(rows.rows.map(r => ({
      ...r,
      valor_aprobado_formatted: formatCurrency(r.valor_aprobado)
    })));
  } catch (err) {
    console.error('[viaticos] paquetes error:', err.message);
    res.status(500).json({ error: 'Error al listar paquetes de viáticos.' });
  }
});

// POST /api/viaticos/paquetes — Crear un nuevo paquete de viáticos
router.post('/paquetes', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { nombre, archivoOrigen, anio, descripcion } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del paquete o Excel es requerido.' });
  const finalYear = parseInt(anio) || new Date().getFullYear();
  try {
    const r = await pool.query(
      `INSERT INTO paquetes_viaticos(nombre, archivo_origen, anio, descripcion, creado_por)
       VALUES($1, $2, $3, $4, $5) RETURNING *`,
      [nombre.trim(), (archivoOrigen || '').trim() || null, finalYear, descripcion || null, req.user.username || 'admin']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[viaticos] create paquete error:', err.message);
    res.status(500).json({ error: 'Error al crear paquete.' });
  }
});

// PUT /api/viaticos/paquetes/:id — Editar nombre, año y metadatos de un paquete
router.put('/paquetes/:id', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { nombre, anio, descripcion, archivoOrigen } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del paquete es requerido.' });
  try {
    const r = await pool.query(
      `UPDATE paquetes_viaticos 
       SET nombre = $1,
           anio = COALESCE($2, anio),
           descripcion = COALESCE($3, descripcion),
           archivo_origen = COALESCE($4, archivo_origen),
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id_paquete = $5
       RETURNING *`,
      [nombre.trim(), anio ? parseInt(anio) : null, descripcion != null ? descripcion : null, archivoOrigen != null ? archivoOrigen : null, parseInt(id)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Paquete no encontrado.' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[viaticos] update paquete error:', err.message);
    res.status(500).json({ error: 'Error al actualizar paquete.' });
  }
});

// DELETE /api/viaticos/paquetes/:id — Eliminar un paquete y todos sus viáticos asociados
router.delete('/paquetes/:id', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  try {
    const r = await pool.query('DELETE FROM paquetes_viaticos WHERE id_paquete = $1 RETURNING *', [parseInt(id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'Paquete no encontrado.' });
    res.json({ message: 'Paquete y viáticos eliminados exitosamente.', paquete: r.rows[0] });
  } catch (err) {
    console.error('[viaticos] delete paquete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar paquete.' });
  }
});

// ─── GET /api/viaticos ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { q='', estado='', departamento='', dependencia='', id_paquete='', page=1, limit=20 } = req.query;
  const depFilter = dependencia || departamento || '';
  try {
    const conditions = ['1=1']; const params = []; let idx = 1;
    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      conditions.push(`v.id_paquete = $${idx++}`);
      params.push(parseInt(id_paquete));
    }
    if (estado && estado !== 'Todos') { conditions.push(`v.estado = $${idx++}`); params.push(normalizeStatus(estado)); }
    if (depFilter && depFilter !== 'Todas' && depFilter !== 'Todos') { conditions.push(`LOWER(v.dependencia) LIKE LOWER($${idx++})`); params.push(`%${depFilter}%`); }
    if (q) { conditions.push(`(LOWER(v.apellidos_nombres) LIKE LOWER($${idx}) OR v.documento LIKE $${idx} OR LOWER(v.destino) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }

    const where = conditions.join(' AND ');
    const countQuery = `SELECT COUNT(*) FROM viaticos v WHERE ${where}`;
    const total = parseInt((await pool.query(countQuery, params)).rows[0].count);

    const isAll = limit === 'all' || limit === '0' || parseInt(limit, 10) >= 10000;
    const limitNum = isAll ? 100000 : Math.max(1, parseInt(limit, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;
    params.push(limitNum, offset);

    const rows = await pool.query(
      `SELECT v.*, p.nombre AS nombre_paquete, p.anio AS anio_paquete
       FROM viaticos v
       LEFT JOIN paquetes_viaticos p ON p.id_paquete = v.id_paquete
       WHERE ${where}
       ORDER BY v.id_viatico DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      params
    );

    res.json({
      data: rows.rows.map(r => ({
        id: r.id_viatico,
        idPaquete: r.id_paquete,
        nombrePaquete: r.nombre_paquete || '',
        anioPaquete: r.anio_paquete || null,
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
        numeroResolucion: r.numero_resolucion || '',
        saldo: parseFloat(r.saldo) || 0,
        saldoFormatted: formatCurrency(r.saldo),
      })),
      total, page: parseInt(page, 10) || 1, totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (err) {
    console.error('[viaticos] list error:', err.message);
    res.status(500).json({ error: 'Error al listar viáticos.' });
  }
});

// ─── GET /api/viaticos/stats ──────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  const { id_paquete } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      where = 'id_paquete = $1';
      params.push(parseInt(id_paquete));
    }
    const r = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE estado='Pendiente')::int AS pendientes,
             COUNT(*) FILTER (WHERE estado='Aprobada' OR estado='Finalizada')::int AS aprobadas,
             COALESCE(SUM(valor_total) FILTER (WHERE estado='Aprobada' OR estado='Finalizada'), 0)::numeric(15,2) AS valor_aprobado
      FROM viaticos WHERE ${where}`, params);
    res.json({
      ...r.rows[0],
      valor_aprobado_formatted: formatCurrency(r.rows[0].valor_aprobado)
    });
  } catch (err) {
    console.error('[viaticos] stats error:', err.message);
    res.status(500).json({ error: 'Error estadísticas.' });
  }
});

// ─── POST /api/viaticos ───────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte, numeroResolucion, saldo, id_paquete } = req.body;
  if (!persona || !destino) return res.status(400).json({ error: 'Persona y destino son requeridos.' });

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  try {
    const pkgId = id_paquete ? parseInt(id_paquete) : 5;
    const r = await pool.query(
      `INSERT INTO viaticos(dependencia,apellidos_nombres,documento,cargo,destino,motivo,fecha_inicio,fecha_fin,dias,valor_diario,estado,observaciones,fecha_solicitud,aprobado_por,tipo_destino,soporte,numero_resolucion,saldo,id_paquete)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id_viatico`,
      [upper(dependencia), upper(persona), (documento||'').trim()||null, upper(cargo)||'FUNCIONARIO PÚBLICO', upper(destino), motivo||'',
       fechaInicio||today, fechaFin||today, parseInt(dias)||1, parseFloat(valorDiario)||0,
       normalizeStatus(estado), observaciones||'', today, aprobadoPor||'', tipoDestino||'Nacional', soporte||null,
       (numeroResolucion||'').trim()||null, parseFloat(saldo)||null, pkgId]);

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
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : [];
  const hojasProcesadas = Array.isArray(req.body.hojasProcesadas) ? req.body.hojasProcesadas : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let totalValor = 0;
  const errors = [];

  try {
    await client.query('BEGIN');
    const d = new Date();
    const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    // Determinar o crear el paquete de destino para esta importación
    let targetPackageId = req.body.id_paquete ? parseInt(req.body.id_paquete) : null;
    let targetPackageName = '';

    if (!targetPackageId) {
      const rawName = (req.body.nombrePaquete || req.body.nombreArchivo || '').trim();
      const fileName = (req.body.nombreArchivo || '').trim();
      const yearMatch = (rawName + ' ' + fileName).match(/\b(20\d{2})\b/);
      const pkgYear = yearMatch ? parseInt(yearMatch[1]) : (parseInt(req.body.anio) || d.getFullYear());
      const pkgName = rawName || (fileName ? fileName.replace(/\.[^/.]+$/, '') : `Ejecución Presupuestal ${pkgYear}`);

      const pkgRes = await client.query(
        `INSERT INTO paquetes_viaticos (nombre, archivo_origen, anio, descripcion, creado_por)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_paquete, nombre`,
        [pkgName, fileName || null, pkgYear, `Importado desde archivo Excel (${rows.length} registros)`, req.user.username || 'admin']
      );
      targetPackageId = pkgRes.rows[0].id_paquete;
      targetPackageName = pkgRes.rows[0].nombre;
    } else {
      const pNameRes = await client.query('SELECT nombre FROM paquetes_viaticos WHERE id_paquete = $1', [targetPackageId]);
      if (pNameRes.rows.length) targetPackageName = pNameRes.rows[0].nombre;
    }

    // 1. Cargar catálogo de personas en memoria para asignación inteligente de cédula y cargo
    const peopleTokenMap = new Map();
    const peopleExactMap = new Map();
    try {
      const pRes = await client.query(`
        SELECT p.cedula, p.nombre_completo, ca.cargo, d.dependencia
        FROM personas p
        LEFT JOIN rel_principal r ON p.id_persona = r.id_persona
        LEFT JOIN cargos ca ON COALESCE(r.id_cargo_actual, r.id_cargo_base) = ca.id_cargo
        LEFT JOIN dependencias d ON r.id_dependencia = d.id_dependencia
        WHERE p.cedula IS NOT NULL AND p.cedula != ''
      `);
      for (const p of pRes.rows) {
        const fullUpper = upper(p.nombre_completo);
        const tokens = normalizeTokens(fullUpper);
        const empData = {
          cedula: p.cedula.trim(),
          nombreCompleto: fullUpper,
          cargo: upper(p.cargo) || 'FUNCIONARIO PÚBLICO',
          dependencia: upper(p.dependencia) || ''
        };
        if (tokens && !peopleTokenMap.has(tokens)) peopleTokenMap.set(tokens, empData);
        if (fullUpper && !peopleExactMap.has(fullUpper)) peopleExactMap.set(fullUpper, empData);
      }
    } catch (pErr) {
      console.warn('[viaticos-bulk] Warning cargando personas:', pErr.message);
    }

    // 2. Cargar viáticos existentes en este paquete o con resolucion para deduplicación
    const existingMap = new Map();
    try {
      const existRes = await client.query(`
        SELECT id_viatico, UPPER(apellidos_nombres) AS nom, fecha_inicio, UPPER(destino) AS dest, numero_resolucion
        FROM viaticos
        WHERE id_paquete = $1 OR id_paquete IS NULL
      `, [targetPackageId]);
      for (const ex of existRes.rows) {
        const key = `${ex.nom}|${ex.fecha_inicio || ''}|${ex.dest || ''}`;
        existingMap.set(key, ex.id_viatico);
        if (ex.numero_resolucion) {
          existingMap.set(`RESOL:${ex.numero_resolucion.replace(/\s+/g, '').toUpperCase()}`, ex.id_viatico);
        }
      }
    } catch (exErr) {
      console.warn('[viaticos-bulk] Warning cargando viáticos existentes:', exErr.message);
    }

    // 3. Procesar e insertar / actualizar filas
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let persona = (row.persona || row.nombreCompleto || row.nombre || row['Servidor Público'] || row['Nombre Completo'] || row['NOMBRE'] || '').toString().trim();
      let documento = (row.documento || row.cedula || row['Cédula'] || row['Documento'] || '').toString().trim();
      let dependencia = (row.dependencia || row['Dependencia'] || row.secretaria || '').toString().trim();
      let cargo = (row.cargo || row.cargoActual || row['Cargo'] || '').toString().trim();
      const destino = (row.destino || row['Destino'] || row['LUGAR COMISION'] || 'SIN ESPECIFICAR').toString().trim();
      const motivo = (row.motivo || row.objetoComision || row['Objeto Comisión'] || row['Motivo'] || 'Comisión de servicios').toString().trim();
      const fechaInicio = (row.fechaInicio || row.fechaSalida || row.inicio || row['Fecha Salida'] || row['Fecha Inicio'] || row['FECHA COMISION'] || '').toString().trim();
      const fechaFin = (row.fechaFin || row.fechaRetorno || row.fin || row['Fecha Retorno'] || row['Fecha Fin'] || fechaInicio || '').toString().trim();
      const dias = parseInt(row.dias || row['Días'] || 1) || 1;
      const estado = normalizeStatus(row.estado || row['Estado'] || 'Aprobada');
      const observaciones = (row.observaciones || row.notas || row['Observaciones'] || '').toString().trim();
      const tipoDestino = (row.tipoDestino || row['Tipo Destino'] || 'Nacional').toString().trim();
      const numeroResolucion = (row.numeroResolucion || row.numero_resolucion || row['No.RESOLUCION'] || row['N.RESOLUCION'] || row['RESOLUCION'] || row['RESOLUCIÓN'] || '').toString().trim();
      const saldo = parseFloat(row.saldo || row['SALDO']) || null;
      const rowValorTotal = parseFloat(row.valorTotal != null ? row.valorTotal : (row.valor != null ? row.valor : 0)) || 0;
      const valorDiario = dias > 0 && rowValorTotal > 0 ? parseFloat((rowValorTotal / dias).toFixed(2)) : (parseFloat(row.valorDiario || row['Valor Diario'] || 0) || 0);
      totalValor += rowValorTotal;

      if (!persona) {
        errors.push(`Fila ${i + 1}: Nombre de servidor no especificado.`);
        skipped++;
        continue;
      }

      // Enriquecer cédula y cargo mediante cotejo institucional de nombres si no vienen provistos
      if (!documento || !cargo) {
        const pUpper = upper(persona);
        const pTokens = normalizeTokens(pUpper);
        const matched = peopleTokenMap.get(pTokens) || peopleExactMap.get(pUpper);
        if (matched) {
          if (!documento) documento = matched.cedula;
          if (!cargo) cargo = matched.cargo;
          if (!dependencia && matched.dependencia) dependencia = matched.dependencia;
        } else {
          if (!cargo) cargo = 'FUNCIONARIO PÚBLICO';
        }
      }

      const pUpper = upper(persona);
      const destUpper = upper(destino);
      const keyPrimary = `${pUpper}|${fechaInicio}|${destUpper}`;
      const resolKey = numeroResolucion ? `RESOL:${numeroResolucion.replace(/\s+/g, '').toUpperCase()}` : null;
      const existingId = existingMap.get(keyPrimary) || (resolKey ? existingMap.get(resolKey) : null);

      if (existingId) {
        await client.query(
          `UPDATE viaticos SET
             dependencia = COALESCE(NULLIF($1, ''), dependencia),
             apellidos_nombres = $2,
             documento = COALESCE($3, documento),
             cargo = COALESCE(NULLIF($4, ''), cargo),
             destino = $5,
             motivo = $6,
             fecha_inicio = $7,
             fecha_fin = $8,
             dias = $9,
             valor_diario = $10,
             estado = $11,
             observaciones = $12,
             tipo_destino = $13,
             numero_resolucion = COALESCE($14, numero_resolucion),
             saldo = COALESCE($15, saldo),
             id_paquete = COALESCE(id_paquete, $16)
           WHERE id_viatico = $17`,
          [upper(dependencia), pUpper, documento || null, upper(cargo) || 'FUNCIONARIO PÚBLICO',
           destUpper, motivo, fechaInicio || today, fechaFin || today, dias, valorDiario,
           estado, observaciones || 'Actualizado vía carga masiva Excel', tipoDestino,
           numeroResolucion || null, saldo, targetPackageId, existingId]
        );
        updated++;
      } else {
        const r = await client.query(
          `INSERT INTO viaticos(dependencia, apellidos_nombres, documento, cargo, destino, motivo,
                                fecha_inicio, fecha_fin, dias, valor_diario, estado, observaciones,
                                fecha_solicitud, aprobado_por, tipo_destino, numero_resolucion, saldo, id_paquete)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING id_viatico`,
          [upper(dependencia), pUpper, documento || null, upper(cargo) || 'FUNCIONARIO PÚBLICO',
           destUpper, motivo, fechaInicio || today, fechaFin || today, dias, valorDiario,
           estado, observaciones || 'Importado desde Excel', today, 'SISTEMA', tipoDestino,
           numeroResolucion || null, saldo, targetPackageId]
        );
        const newId = r.rows[0].id_viatico;
        existingMap.set(keyPrimary, newId);
        if (resolKey) existingMap.set(resolKey, newId);

        await client.query(
          'INSERT INTO historial_viaticos(id_viatico, estado_nuevo, nota, actualizado_por) VALUES($1, $2, $3, $4)',
          [newId, estado, 'Importado masivamente vía Excel', req.user.username || 'web']
        );
        inserted++;
      }
    }

    await client.query('COMMIT');
    res.json({
      message: `Carga masiva completada: ${inserted} nuevos viáticos importados, ${updated} actualizados.`,
      id_paquete: targetPackageId,
      nombre_paquete: targetPackageName,
      resumen: {
        totalFilas: rows.length,
        insertados: inserted,
        actualizados: updated,
        omitidos: skipped,
        totalValor,
        hojasProcesadas: hojasProcesadas.length
      },
      hojasProcesadas,
      errores: errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[viaticos] bulk error:', err.message);
    res.status(500).json({ error: 'Error durante la carga masiva de viáticos: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── PUT /api/viaticos/:id ────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { id } = req.params;
  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte, numeroResolucion, saldo, id_paquete } = req.body;
  try {
    const r = await pool.query(
      `UPDATE viaticos SET dependencia=$1,apellidos_nombres=$2,documento=$3,cargo=$4,destino=$5,motivo=$6,
        fecha_inicio=$7,fecha_fin=$8,dias=$9,valor_diario=$10,estado=$11,observaciones=$12,aprobado_por=$13,
        tipo_destino=COALESCE($14,tipo_destino), soporte=COALESCE($15,soporte),
        numero_resolucion=COALESCE($16,numero_resolucion), saldo=COALESCE($17,saldo),
        id_paquete=COALESCE($18,id_paquete)
       WHERE id_viatico=$19 RETURNING id_viatico`,
      [upper(dependencia), upper(persona), (documento||'').trim()||null, upper(cargo), upper(destino), motivo||'',
       fechaInicio||'', fechaFin||'', parseInt(dias)||1, parseFloat(valorDiario)||0,
       normalizeStatus(estado), observaciones||'', aprobadoPor||'', tipoDestino||'Nacional', soporte||null,
       numeroResolucion||null, parseFloat(saldo)||null, id_paquete ? parseInt(id_paquete) : null, parseInt(id)]);
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
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
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
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
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
