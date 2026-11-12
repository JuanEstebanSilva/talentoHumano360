const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { Pool } = require('pg');

function parseDateInput(dStr) {
  if (!dStr) return null;
  const s = String(dStr).trim();
  // Rechazo estricto de actos administrativos, resoluciones o números de acto en la fecha
  if (/(?:RES|RESOLUCI[OÓ]N|DECRETO|ACTO|OFICIO|MEMORANDO)/i.test(s) || /^\d{3,5}\//.test(s)) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, m - 1, d));
    }
    return null;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return new Date(Date.UTC(y, mo - 1, d));
    }
    return null;
  }
  if (/^[A-Za-z]/.test(s)) {
    return null;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

function cleanMoney(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let s = String(val).trim();
  if (!s) return null;
  s = s.replace(/[\$\sCOPcop]/g, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return null;
}

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
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const isDefaultOrInsecure = !secret || secret.trim() === '' || secret.includes('talento360_secret_2026');
  if (isProd) {
    if (isDefaultOrInsecure) {
      console.error('[FATAL CIBERSEGURIDAD] En entorno de producción (NODE_ENV=production), la variable JWT_SECRET es obligatoria y no puede usar el secreto predeterminado o predecible (AUD-011).');
      process.exit(1);
    }
    return secret;
  }
  if (isDefaultOrInsecure) {
    console.warn('[AVISO DE SEGURIDAD] JWT_SECRET no configurado o usando valor por defecto en desarrollo.');
    return secret || 'talento360_secret_2026';
  }
  return secret;
}
const JWT_SECRET = resolveJwtSecret();

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
function hasPermission(user, requiredPerm) {
  if (!user) return false;
  const role = String(typeof user === 'string' ? user : (user.role || user.rol || '')).toLowerCase();
  const mods = (typeof user === 'object' && Array.isArray(user.modules))
    ? user.modules
    : (typeof user === 'object' && typeof user.modules === 'string' ? user.modules.split(',').map(m => m.trim().toLowerCase()) : []);
  const perms = (typeof user === 'object' && Array.isArray(user.permissions)) ? user.permissions : [];

  // 1. Acceso de Administrador General / Superusuario
  if (role === 'administrador' || role === 'admin' || mods.includes('*') || mods.includes('all') || perms.includes('*')) {
    return true;
  }

  // 2. Verificación estricta de permiso granular
  if (requiredPerm) {
    if (perms.includes(requiredPerm)) return true;
    const [mod, action] = requiredPerm.split(':');
    if (perms.includes(`${mod}:*`)) return true;
    // Si la acción es lectura (read) y el módulo está asignado (sin restricción de solo escritura)
    if (action === 'read' && mods.includes(mod)) return true;
    // Para escritura (write/delete/import/export), NO basta tener el nombre del módulo en mods si perms existe
    if (perms.length === 0 && mods.includes(mod)) return true;
    if (action === 'write' && (mods.includes(`${mod}_write`) || mods.includes(`${mod}:write`))) return true;
  }

  return false;
}

function canEdit(roleOrUser) {
  const user = typeof roleOrUser === 'object' ? roleOrUser : { role: roleOrUser };
  return hasPermission(user, 'viaticos:write');
}

function canRead(roleOrUser) {
  const user = typeof roleOrUser === 'object' ? roleOrUser : { role: roleOrUser };
  return hasPermission(user, 'viaticos:read');
}

function canLookup(roleOrUser) {
  const user = typeof roleOrUser === 'object' ? roleOrUser : { role: roleOrUser };
  return canRead(user) ||
    hasPermission(user, 'horarios:read') ||
    hasPermission(user, 'horarios:write') ||
    hasPermission(user, 'employees:read') ||
    hasPermission(user, 'employees:write');
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
      CREATE TABLE IF NOT EXISTS vigencias_viaticos (
        anio INT PRIMARY KEY,
        descripcion TEXT,
        creado_por VARCHAR(120) DEFAULT 'admin',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO vigencias_viaticos(anio)
      SELECT DISTINCT anio FROM paquetes_viaticos
      ON CONFLICT (anio) DO NOTHING;
      INSERT INTO vigencias_viaticos(anio) VALUES (2027), (2026), (2025), (2024), (2023), (2022) ON CONFLICT (anio) DO NOTHING;
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS id_paquete INT;
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'viaticos_id_paquete_fkey' AND table_name = 'viaticos'
        ) THEN
          ALTER TABLE viaticos DROP CONSTRAINT viaticos_id_paquete_fkey;
        END IF;
        ALTER TABLE viaticos ADD CONSTRAINT viaticos_id_paquete_fkey FOREIGN KEY (id_paquete) REFERENCES paquetes_viaticos(id_paquete) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS numero_resolucion VARCHAR(120);
      ALTER TABLE viaticos ADD COLUMN IF NOT EXISTS saldo NUMERIC(15,2);
      CREATE INDEX IF NOT EXISTS idx_viaticos_resolucion ON viaticos(numero_resolucion);
      CREATE INDEX IF NOT EXISTS idx_viaticos_paquete ON viaticos(id_paquete);
      CREATE INDEX IF NOT EXISTS idx_paquetes_anio ON paquetes_viaticos(anio);
      CREATE OR REPLACE FUNCTION safe_parse_date(p_date_text text) RETURNS date AS $FUNC$
      DECLARE
        v_clean text;
      BEGIN
        IF p_date_text IS NULL THEN RETURN NULL; END IF;
        v_clean := TRIM(p_date_text);
        IF v_clean = '' OR v_clean ILIKE 'null' OR v_clean ILIKE 'undefined' THEN RETURN NULL; END IF;
        IF v_clean ~ '^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}' THEN
          BEGIN
            RETURN to_date(SUBSTRING(v_clean FROM 1 FOR 10), 'YYYY-MM-DD');
          EXCEPTION WHEN others THEN
            RETURN NULL;
          END;
        END IF;
        IF v_clean ~ '^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}' THEN
          BEGIN
            RETURN to_date(REPLACE(v_clean, '-', '/'), 'DD/MM/YYYY');
          EXCEPTION WHEN others THEN
            RETURN NULL;
          END;
        END IF;
        BEGIN
          RETURN v_clean::DATE;
        EXCEPTION WHEN others THEN
          RETURN NULL;
        END;
      END;
      $FUNC$ LANGUAGE plpgsql IMMUTABLE;
      CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_inicio ON viaticos (safe_parse_date(fecha_inicio));
      CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_fin ON viaticos (safe_parse_date(fecha_fin));
      CREATE INDEX IF NOT EXISTS idx_viaticos_safe_fecha_solicitud ON viaticos (safe_parse_date(fecha_solicitud));
      ALTER TABLE viaticos ALTER COLUMN estado SET DEFAULT 'Radicado';
      ALTER TABLE historial_viaticos ADD COLUMN IF NOT EXISTS estado_anterior VARCHAR(80);
      CREATE INDEX IF NOT EXISTS idx_viaticos_estado ON viaticos(estado);
      CREATE INDEX IF NOT EXISTS idx_historial_viaticos_id_viatico ON historial_viaticos(id_viatico);
      CREATE INDEX IF NOT EXISTS idx_historial_viaticos_fecha ON historial_viaticos(fecha_actualizacion);
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_viaticos_estado'
        ) THEN
          ALTER TABLE viaticos
          ADD CONSTRAINT chk_viaticos_estado
          CHECK (estado IN ('Radicado', 'Aprobado', 'En Ejecución', 'Legalizado', 'Rechazado', 'Anulado'));
        END IF;
      END $$;
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
const CANONICAL_STATUSES = [
  'Radicado',
  'Aprobado',
  'En Ejecución',
  'Legalizado',
  'Rechazado',
  'Anulado'
];

const VALID_TRANSITIONS = {
  'Radicado': ['Aprobado', 'Rechazado', 'Anulado'],
  'Aprobado': ['En Ejecución', 'Rechazado', 'Anulado'],
  'En Ejecución': ['Legalizado', 'Anulado'],
  'Legalizado': [], // Terminal
  'Rechazado': [],  // Terminal
  'Anulado': []     // Terminal
};

function normalizeStatus(s) {
  if (!s) return 'Radicado';
  const raw = String(s).trim();
  if (CANONICAL_STATUSES.includes(raw)) return raw;
  const e = raw.toLowerCase();
  if (e === 'aprobada' || e.includes('aprobad')) return 'Aprobado';
  if (e === 'finalizada' || e.includes('legaliz') || e.includes('finaliz')) return 'Legalizado';
  if (e.includes('ejecuci')) return 'En Ejecución';
  if (e.includes('rechazad')) return 'Rechazado';
  if (e.includes('anulad')) return 'Anulado';
  if (e.includes('revis') || e.includes('radicad') || e.includes('pendient')) return 'Radicado';
  return 'Radicado';
}

function validateTransition(currentStatus, targetStatus) {
  const normCurrent = normalizeStatus(currentStatus);
  const normTarget = normalizeStatus(targetStatus);

  if (!CANONICAL_STATUSES.includes(normTarget)) {
    return {
      valid: false,
      error: `Estado destino no válido: "${targetStatus}". Estados canónicos permitidos: ${CANONICAL_STATUSES.join(', ')}.`
    };
  }

  if (normCurrent === normTarget) {
    if (normCurrent === 'Aprobado') {
      return { valid: false, error: 'El viático ya se encuentra en estado Aprobado (doble aprobación impedida).' };
    }
    if (normCurrent === 'Legalizado') {
      return { valid: false, error: 'El viático ya se encuentra en estado Legalizado (doble legalización impedida).' };
    }
    return { valid: false, error: `El viático ya se encuentra en estado "${normCurrent}".` };
  }

  if (['Legalizado', 'Rechazado', 'Anulado'].includes(normCurrent)) {
    return {
      valid: false,
      error: `Transición no permitida: El viático ya se encuentra en estado terminal "${normCurrent}". El proceso administrativo está cerrado y no admite más transiciones.`
    };
  }

  const allowed = VALID_TRANSITIONS[normCurrent] || [];
  if (!allowed.includes(normTarget)) {
    if (normCurrent === 'Radicado' && normTarget === 'Legalizado') {
      return { valid: false, error: 'Transición no permitida: Una comisión radicada no puede legalizarse directamente sin haber sido aprobada y puesta en ejecución.' };
    }
    if (normCurrent === 'Radicado' && normTarget === 'En Ejecución') {
      return { valid: false, error: 'Transición no permitida: Una comisión debe ser aprobada antes de iniciar su ejecución.' };
    }
    if (normCurrent === 'Aprobado' && normTarget === 'Legalizado') {
      return { valid: false, error: 'Transición no permitida: Una comisión aprobada debe iniciar su ejecución antes de proceder a su legalización.' };
    }
    if (normCurrent === 'En Ejecución' && ['Radicado', 'Aprobado', 'Rechazado'].includes(normTarget)) {
      return { valid: false, error: `Transición no permitida: Una comisión en ejecución no puede revertirse a "${normTarget}".` };
    }
    return {
      valid: false,
      error: `Transición no permitida de "${normCurrent}" a "${normTarget}". Transiciones válidas desde "${normCurrent}": ${allowed.join(', ') || 'Ninguna (estado terminal)'}.`
    };
  }

  return { valid: true, current: normCurrent, target: normTarget };
}
function formatCurrency(v) {
  const n = parseFloat(v) || 0;
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(n);
}

// ─── RUTAS DE HISTÓRICOS ANUALES (VIGENCIAS FISCALES) ──────────────────────────

// GET /api/viaticos/anios — Lista todos los años de vigencias fiscales registrados
router.get('/anios', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  try {
    const q = `
      SELECT anio, descripcion, creado_por, creado_en
      FROM vigencias_viaticos
      ORDER BY anio DESC
    `;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error('[viaticos] anios error:', err.message);
    res.status(500).json({ error: 'Error al listar las vigencias fiscales.' });
  }
});

// POST /api/viaticos/anios — Crear un nuevo histórico anual de vigencia fiscal
router.post('/anios', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { anio, descripcion } = req.body;
  const anioNum = parseInt(anio, 10);
  if (!anioNum || isNaN(anioNum) || anioNum < 2000 || anioNum > 2100) {
    return res.status(400).json({ error: 'Año fiscal inválido (debe ser entre 2000 y 2100).' });
  }
  try {
    const exists = await pool.query('SELECT anio FROM vigencias_viaticos WHERE anio = $1', [anioNum]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: `La vigencia fiscal ${anioNum} ya se encuentra registrada.` });
    }
    const r = await pool.query(
      `INSERT INTO vigencias_viaticos (anio, descripcion, creado_por)
       VALUES ($1, $2, $3) RETURNING *`,
      [anioNum, descripcion || null, req.user.username || 'admin']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[viaticos] create anio error:', err.message);
    res.status(500).json({ error: 'Error al registrar vigencia fiscal.' });
  }
});

// DELETE /api/viaticos/anios/:anio — Eliminar un histórico anual y todas sus ejecuciones/viáticos
router.delete('/anios/:anio', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const anioNum = parseInt(req.params.anio, 10);
  if (!anioNum || isNaN(anioNum)) return res.status(400).json({ error: 'Año fiscal inválido.' });
  try {
    // Proteger registros cerrados e históricos legalizados (AUD-NUEVO-007)
    const checkLegalizados = await pool.query(
      `SELECT COUNT(*) FROM viaticos v 
       WHERE v.id_paquete IN (SELECT id_paquete FROM paquetes_viaticos WHERE anio = $1)
         AND v.estado = 'Legalizado'`,
      [anioNum]
    );
    const countLegalizados = parseInt(checkLegalizados.rows[0].count, 10) || 0;
    if (countLegalizados > 0) {
      return res.status(400).json({
        error: `No es posible eliminar la vigencia fiscal ${anioNum}. Contiene ${countLegalizados} comisión(es) de viáticos en estado Legalizado con valor probatorio administrativo cerrado.`
      });
    }

    // 1. Eliminar viáticos pertenecientes a paquetes de ese año
    await pool.query('DELETE FROM viaticos WHERE id_paquete IN (SELECT id_paquete FROM paquetes_viaticos WHERE anio = $1)', [anioNum]);
    // 2. Eliminar paquetes de ese año
    await pool.query('DELETE FROM paquetes_viaticos WHERE anio = $1', [anioNum]);
    // 3. Eliminar la vigencia
    await pool.query('DELETE FROM vigencias_viaticos WHERE anio = $1', [anioNum]);
    res.json({ message: `Vigencia fiscal ${anioNum} y todos sus registros asociados fueron eliminados correctamente.` });
  } catch (err) {
    console.error('[viaticos] delete anio error:', err.message);
    res.status(500).json({ error: 'Error al eliminar la vigencia fiscal.' });
  }
});

// ─── RUTAS DE PAQUETES DE VIÁTICOS (EXCELS / VIGENCIAS) ───────────────────────

// GET /api/viaticos/paquetes — Lista todos los paquetes con conteos y totales
router.get('/paquetes', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  try {
    const q = `
      SELECT 
        p.id_paquete,
        p.nombre,
        p.archivo_origen,
        p.anio,
        p.descripcion,
        p.presupuesto_inicial,
        p.creado_por,
        p.creado_en,
        p.actualizado_en,
        COUNT(v.id_viatico)::int AS total_viaticos,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Radicado', 'Pendiente', 'En revisión'))::int AS pendientes,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada'))::int AS aprobadas,
        COUNT(v.id_viatico) FILTER (WHERE v.estado = 'En Ejecución')::int AS en_ejecucion,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Legalizado', 'Finalizada'))::int AS legalizadas,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Rechazado', 'Rechazada'))::int AS rechazadas,
        COUNT(v.id_viatico) FILTER (WHERE v.estado IN ('Anulado', 'Anulada'))::int AS anuladas,
        COALESCE(SUM(v.valor_total) FILTER (WHERE v.estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada')), 0)::numeric(15,2) AS valor_aprobado
      FROM paquetes_viaticos p
      LEFT JOIN viaticos v ON v.id_paquete = p.id_paquete
      GROUP BY p.id_paquete, p.nombre, p.archivo_origen, p.anio, p.descripcion, p.presupuesto_inicial, p.creado_por, p.creado_en, p.actualizado_en
      ORDER BY p.anio DESC, p.id_paquete DESC
    `;
    const rows = await pool.query(q);
    res.json(rows.rows.map(r => ({
      ...r,
      presupuesto_inicial: r.presupuesto_inicial ? parseFloat(r.presupuesto_inicial) : null,
      presupuesto_inicial_formatted: r.presupuesto_inicial ? formatCurrency(r.presupuesto_inicial) : null,
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
  const { nombre, archivoOrigen, anio, descripcion, presupuestoInicial, presupuesto_inicial } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del paquete o Excel es requerido.' });
  const finalYear = parseInt(anio) || new Date().getFullYear();
  const rawPres = presupuestoInicial !== undefined ? presupuestoInicial : presupuesto_inicial;
  const finalPresupuesto = rawPres !== undefined && rawPres !== null && String(rawPres).trim() !== '' ? (parseFloat(rawPres) || null) : null;
  try {
    await pool.query('INSERT INTO vigencias_viaticos(anio) VALUES($1) ON CONFLICT (anio) DO NOTHING', [finalYear]);
    const r = await pool.query(
      `INSERT INTO paquetes_viaticos(nombre, archivo_origen, anio, descripcion, presupuesto_inicial, creado_por)
       VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre.trim(), (archivoOrigen || '').trim() || null, finalYear, descripcion || null, finalPresupuesto, req.user.username || 'admin']
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
  const { nombre, anio, descripcion, archivoOrigen, presupuestoInicial, presupuesto_inicial } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del paquete es requerido.' });
  const rawPres = presupuestoInicial !== undefined ? presupuestoInicial : presupuesto_inicial;
  const finalPresupuesto = rawPres !== undefined ? (rawPres !== null && String(rawPres).trim() !== '' ? (parseFloat(rawPres) || null) : null) : undefined;
  try {
    const r = await pool.query(
      `UPDATE paquetes_viaticos 
       SET nombre = $1,
           anio = COALESCE($2, anio),
           descripcion = COALESCE($3, descripcion),
           archivo_origen = COALESCE($4, archivo_origen),
           presupuesto_inicial = ${finalPresupuesto !== undefined ? '$5' : 'presupuesto_inicial'},
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id_paquete = ${finalPresupuesto !== undefined ? '$6' : '$5'}
       RETURNING *`,
      finalPresupuesto !== undefined
        ? [nombre.trim(), anio ? parseInt(anio) : null, descripcion != null ? descripcion : null, archivoOrigen != null ? archivoOrigen : null, finalPresupuesto, parseInt(id)]
        : [nombre.trim(), anio ? parseInt(anio) : null, descripcion != null ? descripcion : null, archivoOrigen != null ? archivoOrigen : null, parseInt(id)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Paquete no encontrado.' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[viaticos] update paquete error:', err.message);
    res.status(500).json({ error: 'Error al actualizar paquete.' });
  }
});

// DELETE /api/viaticos/paquetes/:id — Eliminar un paquete (solo si no contiene viáticos asociados)
router.delete('/paquetes/:id', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const idNum = parseInt(req.params.id, 10);
  if (!idNum || isNaN(idNum)) return res.status(400).json({ error: 'ID de paquete inválido.' });
  try {
    // Proteger registros históricos y trazabilidad institucional: impedir eliminación de paquetes con viáticos
    const checkViaticos = await pool.query(
      `SELECT COUNT(*) FROM viaticos WHERE id_paquete = $1`,
      [idNum]
    );
    const countViaticos = parseInt(checkViaticos.rows[0].count, 10) || 0;
    if (countViaticos > 0) {
      return res.status(400).json({
        error: `No es posible eliminar el paquete presupuestal ${idNum}. Contiene ${countViaticos} comisión(es) de viático asociada(s). Para preservar la trazabilidad institucional y prevenir pérdida accidental de datos, un paquete con viáticos registrados no puede ser eliminado.`
      });
    }

    const r = await pool.query('DELETE FROM paquetes_viaticos WHERE id_paquete = $1 RETURNING *', [idNum]);
    if (!r.rows.length) return res.status(404).json({ error: 'Paquete no encontrado.' });
    res.json({ message: 'Paquete eliminado exitosamente.', paquete: r.rows[0] });
  } catch (err) {
    console.error('[viaticos] delete paquete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar paquete.' });
  }
});

// ─── GET /api/viaticos/dependencias ──────────────────────────────────────────
// Lista las dependencias únicas reales según el paquete o vigencia seleccionada
router.get('/dependencias', auth, async (req, res) => {
  const { id_paquete, anio } = req.query;
  try {
    const conditions = ["v.dependencia IS NOT NULL", "TRIM(v.dependencia) != ''"];
    const params = [];
    let idx = 1;
    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      conditions.push('v.id_paquete = $' + (idx++));
      params.push(parseInt(id_paquete, 10));
    }
    if (anio && anio !== 'todos' && anio !== 'all') {
      conditions.push('p.anio = $' + (idx++));
      params.push(parseInt(anio, 10));
    }

    const where = conditions.join(' AND ');
    const q = `
      SELECT v.dependencia, COUNT(v.id_viatico)::int as total
      FROM viaticos v
      LEFT JOIN paquetes_viaticos p ON p.id_paquete = v.id_paquete
      WHERE ${where}
      GROUP BY v.dependencia
      ORDER BY v.dependencia ASC
    `;
    const result = await pool.query(q, params);

    // Ordenamiento natural institucional (numérico y alfabético: 1., 1.1, 2., ..., 704)
    const sorted = result.rows.sort((a, b) => {
      return (a.dependencia || '').localeCompare(b.dependencia || '', 'es', { numeric: true, sensitivity: 'base' });
    });

    res.json({
      data: sorted
    });
  } catch (err) {
    console.error('[viaticos] dependencias error:', err.message);
    res.status(500).json({ error: 'Error al listar dependencias.' });
  }
});

// ─── GET /api/viaticos/destinos & /api/viaticos/municipios (AUD-005 / AUD-006) ──
router.get(['/destinos', '/municipios'], auth, async (req, res) => {
  try {
    const { q = '', depto = '15', tipo = '' } = req.query;
    const cleanQ = (q || '').trim();
    const cleanDepto = (depto || '').trim();
    const cleanTipo = (tipo || '').trim().toUpperCase();

    let sql;
    const params = [];
    let idx = 1;

    // Si se consulta Boyacá (por código '15', nombre, o por defecto)
    if (!cleanDepto || cleanDepto === '15' || cleanDepto.toUpperCase() === 'BOYACÁ' || cleanDepto.toUpperCase() === 'BOYACA') {
      sql = `
        SELECT 
          codigo,
          codigo_mpio AS "codigoMpio",
          nombre,
          municipio,
          departamento,
          tipo,
          asentamiento,
          destino_completo AS "destinoCompleto",
          municipio_base_tarifa AS "municipioBaseTarifa"
        FROM v_destinos_boyaca
        WHERE 1=1
      `;
      if (cleanTipo === 'MUNICIPIO') {
        sql += ` AND tipo = 'MUNICIPIO'`;
      } else if (cleanTipo === 'CORREGIMIENTO') {
        sql += ` AND tipo != 'MUNICIPIO'`;
      }

      if (cleanQ) {
        sql += ` AND (
          codigo LIKE $${idx}
          OR codigo_mpio LIKE $${idx}
          OR TRANSLATE(LOWER(nombre), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
          OR TRANSLATE(LOWER(municipio), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
        )`;
        params.push(`%${cleanQ}%`);
        idx++;
      }
      sql += ` ORDER BY tipo DESC, nombre ASC LIMIT 250`;
    } else {
      // Otros departamentos desde divipola
      sql = `
        SELECT 
          codigo_mpio AS codigo,
          codigo_mpio AS "codigoMpio",
          municipio AS nombre,
          municipio,
          departamento,
          'MUNICIPIO' AS tipo,
          NULL AS asentamiento,
          municipio || ', ' || departamento AS "destinoCompleto",
          municipio AS "municipioBaseTarifa"
        FROM divipola
        WHERE 1=1
      `;
      if (cleanDepto !== 'todos' && cleanDepto !== 'all') {
        sql += ` AND (codigo_depto = $${idx} OR TRANSLATE(LOWER(departamento), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') = TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn'))`;
        params.push(cleanDepto);
        idx++;
      }
      if (cleanQ) {
        sql += ` AND (
          codigo_mpio LIKE $${idx}
          OR TRANSLATE(LOWER(municipio), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
        )`;
        params.push(`%${cleanQ}%`);
        idx++;
      }
      sql += ` ORDER BY municipio ASC LIMIT 250`;
    }

    const r = await pool.query(sql, params);
    res.json({
      total: r.rowCount,
      departamento: cleanDepto || 'BOYACÁ',
      destinos: r.rows
    });
  } catch (err) {
    console.error('[viaticos] destinos error:', err.message);
    res.status(500).json({ error: 'Error al consultar catálogo de destinos.' });
  }
});

// ─── GET /api/viaticos ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  if (!canRead(req.user)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  }
  const {
    q='',
    estado='',
    departamento='',
    dependencia='',
    id_paquete='',
    anio='',
    tipoDestino='',
    destino='',
    fechaSalidaDesde='',
    fechaSalidaHasta='',
    fechaRegresoDesde='',
    fechaRegresoHasta='',
    valorMin='',
    valorMax='',
    diasMin='',
    diasMax='',
    numeroResolucion='',
    sortBy='',
    page=1,
    limit=20
  } = req.query;
  const depFilter = dependencia || departamento || '';
  try {
    const conditions = ['1=1']; const params = []; let idx = 1;
    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      conditions.push(`v.id_paquete = $${idx++}`);
      params.push(parseInt(id_paquete));
    }
    if (anio && anio !== 'todos' && anio !== 'all') {
      conditions.push(`p.anio = $${idx++}`);
      params.push(parseInt(anio, 10));
    }
    if (estado && estado !== 'Todos') { conditions.push(`v.estado = $${idx++}`); params.push(normalizeStatus(estado)); }
    if (depFilter && depFilter !== 'Todas' && depFilter !== 'Todos') {
      conditions.push(`(
        v.dependencia = $${idx}
        OR LOWER(v.dependencia) = LOWER($${idx})
        OR TRANSLATE(LOWER(v.dependencia), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
      )`);
      params.push(depFilter.trim());
      idx++;
    }
    if (q) {
      conditions.push(`(
        TRANSLATE(LOWER(v.apellidos_nombres), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
        OR v.documento LIKE $${idx}
        OR TRANSLATE(LOWER(v.destino), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
        OR TRANSLATE(LOWER(v.dependencia), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'
        OR v.numero_resolucion LIKE $${idx}
      )`);
      params.push(`%${q}%`);
      idx++;
    }

    // ── Filtros Avanzados Viáticos ───────────────────────────────────────────
    if (tipoDestino && !['todos', 'todas', ''].includes(tipoDestino.trim().toLowerCase())) {
      conditions.push(`LOWER(v.tipo_destino) = LOWER($${idx++})`);
      params.push(tipoDestino.trim());
    }
    if (destino && destino.trim()) {
      conditions.push(`TRANSLATE(LOWER(v.destino), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') LIKE '%' || TRANSLATE(LOWER($${idx++}), 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouaeiouuunn') || '%'`);
      params.push(destino.trim());
    }
    if (numeroResolucion && numeroResolucion.trim()) {
      conditions.push(`v.numero_resolucion ILIKE $${idx++}`);
      params.push(`%${numeroResolucion.trim()}%`);
    }
    if (valorMin && !isNaN(Number(valorMin))) {
      conditions.push(`v.valor_total >= $${idx++}`);
      params.push(Number(valorMin));
    }
    if (valorMax && !isNaN(Number(valorMax))) {
      conditions.push(`v.valor_total <= $${idx++}`);
      params.push(Number(valorMax));
    }
    if (diasMin && !isNaN(Number(diasMin))) {
      conditions.push(`v.dias >= $${idx++}`);
      params.push(parseInt(diasMin, 10));
    }
    if (diasMax && !isNaN(Number(diasMax))) {
      conditions.push(`v.dias <= $${idx++}`);
      params.push(parseInt(diasMax, 10));
    }

    const dateExprInicio = 'safe_parse_date(v.fecha_inicio)';
    const dateExprFin = 'safe_parse_date(v.fecha_fin)';

    if (fechaSalidaDesde) {
      conditions.push(`${dateExprInicio} >= safe_parse_date($${idx++})`);
      params.push(fechaSalidaDesde);
    }
    if (fechaSalidaHasta) {
      conditions.push(`${dateExprInicio} <= safe_parse_date($${idx++})`);
      params.push(fechaSalidaHasta);
    }
    if (fechaRegresoDesde) {
      conditions.push(`${dateExprFin} >= safe_parse_date($${idx++})`);
      params.push(fechaRegresoDesde);
    }
    if (fechaRegresoHasta) {
      conditions.push(`${dateExprFin} <= safe_parse_date($${idx++})`);
      params.push(fechaRegresoHasta);
    }

    const where = conditions.join(' AND ');
    const countQuery = `SELECT COUNT(*) FROM viaticos v LEFT JOIN paquetes_viaticos p ON p.id_paquete = v.id_paquete WHERE ${where}`;
    const total = parseInt((await pool.query(countQuery, params)).rows[0].count);

    const isAll = limit === 'all' || limit === '0' || parseInt(limit, 10) >= 10000;
    const limitNum = isAll ? 100000 : Math.max(1, parseInt(limit, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;

    let orderBy = 'v.id_viatico DESC';
    switch (sortBy) {
      case 'fecha_desc':
        orderBy = `${dateExprInicio} DESC NULLS LAST, v.id_viatico DESC`;
        break;
      case 'fecha_asc':
        orderBy = `${dateExprInicio} ASC NULLS LAST, v.id_viatico ASC`;
        break;
      case 'valor_desc':
        orderBy = `v.valor_total DESC NULLS LAST, v.id_viatico DESC`;
        break;
      case 'valor_asc':
        orderBy = `v.valor_total ASC NULLS LAST, v.id_viatico ASC`;
        break;
      case 'radicado_desc':
        orderBy = 'v.id_viatico DESC';
        break;
      case 'radicado_asc':
        orderBy = 'v.id_viatico ASC';
        break;
      case 'persona_asc':
        orderBy = 'v.apellidos_nombres ASC NULLS LAST';
        break;
      case 'persona_desc':
        orderBy = 'v.apellidos_nombres DESC NULLS LAST';
        break;
      default:
        orderBy = 'v.id_viatico DESC';
    }

    params.push(limitNum, offset);

    const rows = await pool.query(
      `SELECT v.id_viatico, v.id_paquete, v.dependencia, v.apellidos_nombres, v.documento,
              v.cargo, v.destino, v.motivo, v.fecha_inicio, v.fecha_fin, v.dias,
              v.valor_diario, v.valor_total, v.estado, v.observaciones, v.fecha_solicitud,
              v.aprobado_por, v.numero_resolucion, v.saldo, v.tipo_destino, v.creado_en,
              (v.soporte IS NOT NULL AND v.soporte != '') AS tiene_soporte,
              p.nombre AS nombre_paquete, p.anio AS anio_paquete
       FROM viaticos v
       LEFT JOIN paquetes_viaticos p ON p.id_paquete = v.id_paquete
       WHERE ${where}
       ORDER BY ${orderBy}
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
        tipoDestino: r.tipo_destino || 'Nacional',
        tieneSoporte: Boolean(r.tiene_soporte),
        soporte: null, // AUD-011: Carga diferida bajo demanda vía GET /api/viaticos/:id/soporte
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
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  const { id_paquete, anio } = req.query;
  try {
    let where = '1=1';
    const params = [];
    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      where = 'v.id_paquete = $1';
      params.push(parseInt(id_paquete, 10));
    } else if (anio && anio !== 'todos' && anio !== 'all') {
      where = 'p.anio = $1';
      params.push(parseInt(anio, 10));
    }
    const r = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE v.estado IN ('Radicado', 'Pendiente', 'En revisión'))::int AS pendientes,
             COUNT(*) FILTER (WHERE v.estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada'))::int AS aprobadas,
             COUNT(*) FILTER (WHERE v.estado = 'En Ejecución')::int AS en_ejecucion,
             COUNT(*) FILTER (WHERE v.estado IN ('Legalizado', 'Finalizada'))::int AS legalizadas,
             COUNT(*) FILTER (WHERE v.estado IN ('Rechazado', 'Rechazada'))::int AS rechazadas,
             COUNT(*) FILTER (WHERE v.estado IN ('Anulado', 'Anulada'))::int AS anuladas,
             COALESCE(SUM(v.valor_total), 0)::numeric(15,2) AS valor_registrado_total,
             COALESCE(SUM(v.valor_total) FILTER (WHERE v.estado IN ('Aprobado', 'Aprobada', 'En Ejecución', 'Legalizado', 'Finalizada')), 0)::numeric(15,2) AS valor_aprobado,
             COUNT(DISTINCT UPPER(TRIM(v.destino)))::int AS total_destinos
      FROM viaticos v
      LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
      WHERE ${where}`, params);

    // Destinos más frecuentes (Top 5)
    const destRes = await pool.query(`
      SELECT UPPER(TRIM(v.destino)) AS destino, COUNT(*)::int AS count
      FROM viaticos v
      LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
      WHERE ${where} AND v.destino IS NOT NULL AND TRIM(v.destino) != ''
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 5`, params);

    // Ranking de funcionarios con más comisiones y valores registrados (Top viajeros)
    const topFuncRes = await pool.query(`
      SELECT 
        UPPER(TRIM(COALESCE(v.apellidos_nombres, 'SIN ASIGNAR'))) AS funcionario,
        COALESCE(TRIM(v.documento), '—') AS documento,
        COALESCE(NULLIF(TRIM(v.dependencia), ''), 'GOBERNACIÓN DE BOYACÁ') AS dependencia,
        COUNT(*)::int AS total_viajes,
        COALESCE(SUM(v.valor_total), 0)::numeric(15,2) AS total_valor_registrado
      FROM viaticos v
      LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
      WHERE ${where} AND v.apellidos_nombres IS NOT NULL AND TRIM(v.apellidos_nombres) != ''
      GROUP BY 1, 2, 3
      ORDER BY total_viajes DESC, total_valor_registrado DESC
      LIMIT 10`, params);

    // Presupuesto y comisiones agrupadas por dependencia
    const depRes = await pool.query(`
      SELECT COALESCE(NULLIF(TRIM(v.dependencia), ''), 'SECRETARÍA GENERAL') AS dep,
             COUNT(*)::int AS count,
             COALESCE(SUM(v.valor_total), 0)::numeric(15,2) AS valor_total
      FROM viaticos v
      LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
      WHERE ${where}
      GROUP BY 1`, params);

    function normalizeDep(raw) {
      if (!raw) return 'Sec. General';
      const d = raw.trim().toUpperCase();
      if (d === '704' || d.includes('INFRAESTRUCTURA') || d.includes('VIAS') || d.includes('OBRAS')) return 'Sec. Infraestructura';
      if (d.includes('SALUD') || d.includes('PREVENCION') || d.includes('PRESTACION')) return 'Sec. Salud';
      if (d.includes('GOBERNADOR') || d.includes('DESPACHO')) return 'Despacho del Gobernador';
      if (d.includes('HACIENDA') || d.includes('TESORERIA') || d.includes('RENTAS') || d.includes('PRESUPUESTO')) return 'Sec. Hacienda';
      if (d.includes('AGRICULTURA') || d.includes('DESARROLLO RURAL')) return 'Sec. Agricultura';
      if (d.includes('AMBIENTE') || d.includes('SOSTENIBLE')) return 'Sec. Ambiente';
      if (d.includes('CULTURA') || d.includes('PATRIMONIO')) return 'Sec. Cultura y Patrimonio';
      if (d.includes('EDUCACION')) return 'Sec. Educación';
      if (d.includes('TALENTO HUMANO') || d.includes('PERSONAL')) return 'Talento Humano';
      if (d.includes('SERVICIOS ADMINISTRATIVOS') || d.includes('GENERAL')) return 'Sec. General';
      if (d.includes('GOBIERNO') || d.includes('ACCION SOCIAL')) return 'Sec. Gobierno';
      if (d.includes('TURISMO')) return 'Sec. Turismo';
      if (d.includes('JURIDICA')) return 'Oficina Jurídica';
      return raw.length > 25 ? raw.substring(0, 22) + '...' : raw;
    }

    const depMap = {};
    depRes.rows.forEach(row => {
      const norm = normalizeDep(row.dep);
      if (!depMap[norm]) depMap[norm] = { nombre: norm, presupuesto: 0, comisiones: 0 };
      depMap[norm].presupuesto += parseFloat(row.valor_total) || 0;
      depMap[norm].comisiones += parseInt(row.count) || 0;
    });

    const por_dependencia = Object.values(depMap)
      .sort((a, b) => b.presupuesto - a.presupuesto)
      .slice(0, 6);

    const valorRegistradoTotal = parseFloat(r.rows[0].valor_registrado_total) || 0;
    const valorAprobado = parseFloat(r.rows[0].valor_aprobado) || valorRegistradoTotal;

    res.json({
      ...r.rows[0],
      valor_registrado_total: valorRegistradoTotal,
      valor_registrado_total_formatted: formatCurrency(valorRegistradoTotal),
      valor_aprobado: valorAprobado,
      valor_aprobado_formatted: formatCurrency(valorAprobado),
      total_destinos: parseInt(r.rows[0].total_destinos) || 0,
      por_destino: destRes.rows,
      por_dependencia,
      top_funcionarios: topFuncRes.rows.map(f => ({
        ...f,
        total_valor_registrado_formatted: formatCurrency(f.total_valor_registrado)
      }))
    });
  } catch (err) {
    console.error('[viaticos] stats error:', err.message);
    res.status(500).json({ error: 'Error estadísticas.' });
  }
});

// ─── GET /api/viaticos/ranking-funcionarios (Consolidado de Comisiones por Servidor) ──
router.get('/ranking-funcionarios', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  const { id_paquete, anio, q, dependencia, orden = 'viajes_desc', page = 1, limit = 10 } = req.query;
  try {
    const conditions = [
      "v.apellidos_nombres IS NOT NULL",
      "TRIM(v.apellidos_nombres) != ''"
    ];
    const params = [];
    let idx = 1;

    if (id_paquete && id_paquete !== 'todos' && id_paquete !== 'all') {
      conditions.push(`v.id_paquete = $${idx++}`);
      params.push(parseInt(id_paquete, 10));
    } else if (anio && anio !== 'todos' && anio !== 'all') {
      conditions.push(`p.anio = $${idx++}`);
      params.push(parseInt(anio, 10));
    }

    if (dependencia && dependencia.trim() !== '' && dependencia !== 'todos' && dependencia !== 'all') {
      conditions.push(`LOWER(TRIM(v.dependencia)) = LOWER(TRIM($${idx++}))`);
      params.push(dependencia.trim());
    }

    if (q && q.trim() !== '') {
      const searchClean = `%${q.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(v.apellidos_nombres) LIKE $${idx} OR 
        LOWER(COALESCE(v.documento, '')) LIKE $${idx} OR
        LOWER(COALESCE(v.dependencia, '')) LIKE $${idx}
      )`);
      params.push(searchClean);
      idx++;
    }

    const where = conditions.join(' AND ');

    let orderBy = 'total_viajes DESC, total_valor_registrado DESC';
    switch (orden) {
      case 'viajes_asc':
        orderBy = 'total_viajes ASC, total_valor_registrado ASC';
        break;
      case 'valor_desc':
        orderBy = 'total_valor_registrado DESC, total_viajes DESC';
        break;
      case 'valor_asc':
        orderBy = 'total_valor_registrado ASC, total_viajes ASC';
        break;
      case 'nombre_asc':
        orderBy = 'funcionario ASC';
        break;
      case 'nombre_desc':
        orderBy = 'funcionario DESC';
        break;
      default:
        orderBy = 'total_viajes DESC, total_valor_registrado DESC';
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const sql = `
      WITH agrupado AS (
        SELECT 
          UPPER(TRIM(v.apellidos_nombres)) AS funcionario,
          COALESCE(NULLIF(TRIM(v.documento), ''), '—') AS documento,
          COALESCE(NULLIF(TRIM(v.dependencia), ''), 'GOBERNACIÓN DE BOYACÁ') AS dependencia,
          COUNT(*)::int AS total_viajes,
          COALESCE(SUM(v.valor_total), 0)::numeric(15,2) AS total_valor_registrado
        FROM viaticos v
        LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
        WHERE ${where}
        GROUP BY 1, 2, 3
      )
      SELECT 
        funcionario,
        documento,
        dependencia,
        total_viajes,
        total_valor_registrado,
        ROUND(total_valor_registrado / NULLIF(total_viajes, 0), 2) AS promedio_por_viaje,
        COUNT(*) OVER()::int AS total_count
      FROM agrupado
      ORDER BY ${orderBy}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(limitNum, offset);

    const result = await pool.query(sql, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    const data = result.rows.map((row, i) => {
      const valorNum = parseFloat(row.total_valor_registrado) || 0;
      const promNum = parseFloat(row.promedio_por_viaje) || 0;
      return {
        ranking: offset + i + 1,
        funcionario: row.funcionario,
        documento: row.documento,
        dependencia: row.dependencia,
        total_viajes: row.total_viajes,
        total_valor_registrado: valorNum,
        total_valor_registrado_formatted: formatCurrency(valorNum),
        promedio_por_viaje: promNum,
        promedio_por_viaje_formatted: formatCurrency(promNum)
      };
    });

    res.json({
      data,
      total,
      totalPages,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    console.error('[viaticos] ranking-funcionarios error:', err.message);
    res.status(500).json({ error: 'Error al consultar consolidado de funcionarios.' });
  }
});

// ─── GET /api/viaticos/:id/soporte (TSK-011 / AUD-011) ─────────────────────────
router.get('/:id/soporte', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (!numId || isNaN(numId)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query('SELECT id_viatico, soporte FROM viaticos WHERE id_viatico = $1', [numId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Viático no encontrado.' });
    res.json({
      id: r.rows[0].id_viatico,
      tieneSoporte: Boolean(r.rows[0].soporte && r.rows[0].soporte.trim() !== ''),
      soporte: r.rows[0].soporte || null
    });
  } catch (err) {
    console.error('[viaticos] soporte error:', err.message);
    res.status(500).json({ error: 'Error al recuperar soporte del viático.' });
  }
});

// ─── GET /api/viaticos/:id — Obtener detalle de un viático por ID ──────────────
router.get('/:id', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (!numId || isNaN(numId)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query(
      `SELECT v.*, p.nombre as paquete_nombre, p.archivo_origen as paquete_archivo
       FROM viaticos v
       LEFT JOIN paquetes_viaticos p ON v.id_paquete = p.id_paquete
       WHERE v.id_viatico = $1`,
      [numId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Viático no encontrado.' });
    const row = r.rows[0];
    res.json({
      ...row,
      id: row.id_viatico,
      persona: row.apellidos_nombres,
      valorTotal: row.valor_total,
      fechaInicio: row.fecha_inicio,
      fechaFin: row.fecha_fin,
      numeroResolucion: row.numero_resolucion,
      radicado: `VIT-2026-${String(row.id_viatico).padStart(5, '0')}`
    });
  } catch (err) {
    console.error('[viaticos] getById error:', err.message);
    res.status(500).json({ error: 'Error al obtener viático.' });
  }
});

// ─── POST /api/viaticos ───────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte, numeroResolucion, saldo, id_paquete } = req.body;
  if (!persona || !destino) return res.status(400).json({ error: 'Persona y destino son requeridos.' });

  // 1. Validación de coherencia de fechas
  const dStart = parseDateInput(fechaInicio);
  const dEnd = parseDateInput(fechaFin);
  if (dStart && dEnd && dEnd < dStart) {
    return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
  }

  // 2. Registro directo de valores de viáticos reportados (Sin liquidación salarial automática)
  let finalDias = null;
  if (dias !== undefined && dias !== null && String(dias).trim() !== '') {
    const sDias = String(dias).trim();
    if (/^\d+$/.test(sDias)) {
      const parsedDias = parseInt(sDias, 10);
      if (parsedDias > 0) {
        finalDias = parsedDias;
      }
    }
  }
  if (finalDias === null && dStart && dEnd) {
    finalDias = Math.max(1, Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1);
  }

  let finalValorDiario = cleanMoney(valorDiario);
  if (finalValorDiario === null || finalValorDiario < 0) {
    finalValorDiario = 0;
  }

  let finalValorTotal = null;
  const rawVT = req.body.valorTotal !== undefined ? req.body.valorTotal : req.body.valor_total;
  if (rawVT !== undefined && rawVT !== null && String(rawVT).trim() !== '') {
    finalValorTotal = cleanMoney(rawVT);
  }

  let obsFinal = (observaciones || '').trim();

  const d = new Date();
  const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  try {
    let pkgId = id_paquete ? parseInt(id_paquete, 10) : null;
    if (!pkgId) {
      const pRes = await pool.query('SELECT id_paquete FROM paquetes_viaticos ORDER BY anio DESC, id_paquete DESC LIMIT 1');
      if (pRes.rows.length > 0) {
        pkgId = pRes.rows[0].id_paquete;
      } else {
        const curYear = new Date().getFullYear();
        const newPkg = await pool.query(
          'INSERT INTO paquetes_viaticos (nombre, archivo_origen, anio, descripcion) VALUES ($1, $2, $3, $4) RETURNING id_paquete',
          [`Ejecución Presupuestal ${curYear}`, `EJECUCION_PRESUPUESTAL_${curYear}.xlsx`, curYear, 'Vigencia en curso']
        );
        pkgId = newPkg.rows[0].id_paquete;
      }
    }
    let estadoFinal = normalizeStatus(estado || 'Radicado');
    if (['Legalizado', 'En Ejecución', 'Rechazado', 'Anulado'].includes(estadoFinal)) {
      estadoFinal = 'Radicado';
    }
    let aprobadoPorVal = aprobadoPor || '';
    if (estadoFinal === 'Aprobado' && !aprobadoPorVal) {
      aprobadoPorVal = req.user.name || req.user.username || 'ADMINISTRACIÓN';
    }

    const r = await pool.query(
      `INSERT INTO viaticos(dependencia,apellidos_nombres,documento,cargo,destino,motivo,fecha_inicio,fecha_fin,dias,valor_diario,valor_total,estado,observaciones,fecha_solicitud,aprobado_por,tipo_destino,soporte,numero_resolucion,saldo,id_paquete)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id_viatico`,
      [upper(dependencia), upper(persona), (documento||'').trim()||null, upper(cargo)||'FUNCIONARIO PÚBLICO', upper(destino), motivo||'',
       fechaInicio || null, fechaFin || null, finalDias, finalValorDiario, finalValorTotal,
       estadoFinal, obsFinal, today, aprobadoPorVal, tipoDestino||'Nacional', soporte||null,
       (numeroResolucion||'').trim()||null, parseFloat(saldo)||null, pkgId]);

    const newId = r.rows[0].id_viatico;
    const historialNota = 'Comisión registrada exitosamente';

    await pool.query(
      'INSERT INTO historial_viaticos(id_viatico, estado_anterior, estado_nuevo, nota, actualizado_por, fecha_actualizacion) VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
      [newId, null, estadoFinal, historialNota, req.user.username||'web']);

    res.status(201).json({ message: 'Viático creado.', id: newId, radicado: `VIT-2026-${String(newId).padStart(5,'0')}` });
  } catch (err) {
    console.error('[viaticos] create error:', err.message);
    if (err.code === '23503' || (err.message && err.message.includes('foreign key constraint'))) {
      return res.status(400).json({ error: 'El documento especificado no corresponde a ningún servidor público registrado en la plataforma.' });
    }
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
    let targetPackageId = req.body.id_paquete ? parseInt(req.body.id_paquete) : (rows[0]?.id_paquete ? parseInt(rows[0].id_paquete) : null);
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
    const peopleCedulaSet = new Set();
    const warnings = [];
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
        const cedTrim = p.cedula.trim();
        peopleCedulaSet.add(cedTrim);
        const empData = {
          cedula: cedTrim,
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
      let persona = (row.persona || row.apellidos_nombres || row.nombreCompleto || row.nombre || row['Servidor Público'] || row['Nombre Completo'] || row['NOMBRE'] || '').toString().trim();
      let documento = (row.documento || row.cedula || row['Cédula'] || row['Documento'] || '').toString().trim();
      let dependencia = (row.dependencia || row['Dependencia'] || row.secretaria || '').toString().trim();
      let cargo = (row.cargo || row.cargoActual || row['Cargo'] || '').toString().trim();
      const destino = (row.destino || row['Destino'] || row['LUGAR COMISION'] || 'SIN ESPECIFICAR').toString().trim();
      const motivo = (row.motivo || row.objetoComision || row['Objeto Comisión'] || row['Motivo'] || 'Comisión de servicios').toString().trim();
      const fechaInicio = (row.fechaInicio || row.fecha_inicio || row.fechaSalida || row.inicio || row['Fecha Salida'] || row['Fecha Inicio'] || row['FECHA COMISION'] || '').toString().trim() || null;
      const fechaFin = (row.fechaFin || row.fecha_fin || row.fechaRetorno || row.fin || row['Fecha Retorno'] || row['Fecha Fin'] || '').toString().trim() || null;
      let rawDias = pickFirst(row, ['dias', 'dias_comision', 'Días', 'DIAS', 'Dias', 'Duración', 'DURACION', 'duracion']);
      let dias = null;
      if (rawDias !== undefined && rawDias !== null && String(rawDias).trim() !== '') {
        const pDias = parseInt(rawDias, 10);
        if (!isNaN(pDias) && pDias > 0) dias = pDias;
      }
      if (dias === null && fechaInicio && fechaFin) {
        const dS = parseDateInput(fechaInicio);
        const dE = parseDateInput(fechaFin);
        if (dS && dE && dE >= dS) {
          dias = Math.max(1, Math.round((dE - dS) / (1000 * 60 * 60 * 24)) + 1);
        }
      }
      const estado = normalizeStatus(row.estado || row['Estado'] || 'Aprobada');
      const observaciones = (row.observaciones || row.notas || row['Observaciones'] || '').toString().trim();
      const tipoDestino = (row.tipoDestino || row['Tipo Destino'] || 'Nacional').toString().trim();
      const numeroResolucion = (row.numeroResolucion || row.numero_resolucion || row['No.RESOLUCION'] || row['N.RESOLUCION'] || row['RESOLUCION'] || row['RESOLUCIÓN'] || '').toString().trim();
      const saldo = cleanMoney(pickFirst(row, ['saldo', 'SALDO', 'Saldo', 'saldo_cop', 'SALDO_COP', 'SALDO COP']));
      const rawTotal = pickFirst(row, [
        'valorTotal', 'valor_total', 'Valor Total', 'VALOR TOTAL', 'VALOR_TOTAL',
        'Total', 'TOTAL', 'Total Viático', 'Total Viatico', 'TOTAL VIATICO',
        'valor', 'VALOR'
      ]);
      const rowValorTotal = cleanMoney(rawTotal);

      // valorDiario es opcional e informativo, no determina ni sobrescribe el valor total
      const rawDiario = pickFirst(row, [
        'valorDiario', 'valor_diario', 'Valor Diario', 'VALOR DIARIO', 'VALOR_DIARIO',
        'Tarifa Diaria', 'TARIFA DIARIA', 'Tarifa', 'TARIFA', 'Diario', 'DIARIO'
      ]);
      const valorDiario = cleanMoney(rawDiario) || 0;
      if (rowValorTotal !== null) totalValor += rowValorTotal;

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

      let documentoFinal = (documento || '').trim() || null;
      let finalObservaciones = (observaciones || '').trim();

      // AUD-NUEVO-008: Validar si la cédula existe en la tabla personas (fk_viaticos_personas)
      // Si la cédula es externa (p.ej. contratista, exfuncionario, comisión interinstitucional),
      // preservamos el documento en las observaciones y asignamos null al campo de clave foránea
      // para evitar que la restricción de integridad aborte la carga masiva.
      if (documentoFinal && !peopleCedulaSet.has(documentoFinal)) {
        finalObservaciones = (finalObservaciones ? finalObservaciones + ' | ' : '') + `[Cédula externa reportada: ${documentoFinal}]`;
        warnings.push(`Fila ${i + 1}: Servidor "${persona}" con documento "${documentoFinal}" no figura en censo de planta; registrado con comisión válida y cédula preservada en observaciones.`);
        documentoFinal = null;
      }

      try {
        await client.query('SAVEPOINT row_sp');

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
               valor_total = COALESCE($11, valor_total),
               estado = $12,
               observaciones = $13,
               tipo_destino = $14,
               numero_resolucion = COALESCE($15, numero_resolucion),
               saldo = COALESCE($16, saldo),
               id_paquete = COALESCE(id_paquete, $17)
             WHERE id_viatico = $18`,
            [upper(dependencia), pUpper, documentoFinal, upper(cargo) || 'FUNCIONARIO PÚBLICO',
             destUpper, motivo, fechaInicio || null, fechaFin || null, dias, valorDiario,
             rowValorTotal, estado, finalObservaciones || 'Actualizado vía carga masiva Excel', tipoDestino,
             numeroResolucion || null, saldo, targetPackageId, existingId]
          );
          updated++;
        } else {
          const r = await client.query(
            `INSERT INTO viaticos(dependencia, apellidos_nombres, documento, cargo, destino, motivo,
                                  fecha_inicio, fecha_fin, dias, valor_diario, valor_total, estado, observaciones,
                                  fecha_solicitud, aprobado_por, tipo_destino, numero_resolucion, saldo, id_paquete)
             VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             RETURNING id_viatico`,
            [upper(dependencia), pUpper, documentoFinal, upper(cargo) || 'FUNCIONARIO PÚBLICO',
             destUpper, motivo, fechaInicio || null, fechaFin || null, dias, valorDiario,
             rowValorTotal, estado, finalObservaciones || 'Importado desde Excel', today, 'SISTEMA', tipoDestino,
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

        await client.query('RELEASE SAVEPOINT row_sp');
      } catch (rowErr) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp');
        console.warn(`[viaticos-bulk] Error procesando fila ${i + 1} (${persona}):`, rowErr.message);
        errors.push(`Fila ${i + 1} (${persona}): ${rowErr.message}`);
        skipped++;
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
        advertencias: warnings.length,
        totalValor,
        hojasProcesadas: hojasProcesadas.length
      },
      advertencias: warnings,
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
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes para editar viáticos.' });
  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID de viático inválido.' });

  const { persona, documento, dependencia, cargo, destino, motivo, fechaInicio, fechaFin, dias, valorDiario, estado, observaciones, aprobadoPor, tipoDestino, soporte, numeroResolucion, saldo, id_paquete } = req.body;
  if (!persona || !destino) return res.status(400).json({ error: 'Persona y destino son requeridos.' });

  // 1. Validación de fechas
  if (fechaInicio && fechaFin) {
    const dStart = parseDateInput(fechaInicio);
    const dEnd = parseDateInput(fechaFin);
    if (dStart && dEnd && dEnd < dStart) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query(
      'SELECT id_viatico, estado, valor_diario, valor_total, observaciones, aprobado_por, saldo, soporte, dias, fecha_inicio, fecha_fin FROM viaticos WHERE id_viatico = $1 FOR UPDATE',
      [numId]
    );
    if (curRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Viático no encontrado.' });
    }

    const currentViatico = curRes.rows[0];
    const currentStatus = normalizeStatus(currentViatico.estado);

    // Protección de procesos administrativos cerrados (terminales)
    if (['Legalizado', 'Rechazado', 'Anulado'].includes(currentStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede modificar una comisión de viático que se encuentra en estado terminal "${currentStatus}". El proceso administrativo está cerrado.`
      });
    }

    let targetStatus = currentStatus;
    let statusChanged = false;
    if (estado) {
      const requestedStatus = normalizeStatus(estado);
      if (requestedStatus !== currentStatus) {
        const transCheck = validateTransition(currentStatus, requestedStatus);
        if (!transCheck.valid) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: transCheck.error });
        }
        targetStatus = requestedStatus;
        statusChanged = true;
      }
    }

    // 2. Registro directo de valores de viáticos reportados (Sin liquidación salarial automática)
    const targetFechaInicio = fechaInicio !== undefined ? (fechaInicio || null) : currentViatico.fecha_inicio;
    const targetFechaFin = fechaFin !== undefined ? (fechaFin || null) : currentViatico.fecha_fin;

    const dStart = parseDateInput(targetFechaInicio);
    const dEnd = parseDateInput(targetFechaFin);
    let finalDias = null;
    if (dias !== undefined && dias !== null && String(dias).trim() !== '') {
      const sDias = String(dias).trim();
      if (/^\d+$/.test(sDias)) {
        const parsedDias = parseInt(sDias, 10);
        if (parsedDias > 0) {
          finalDias = parsedDias;
        }
      }
    }
    if (finalDias === null) {
      if (fechaInicio !== undefined || fechaFin !== undefined) {
        if (dStart && dEnd) {
          finalDias = Math.max(1, Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1);
        } else {
          finalDias = null;
        }
      } else {
        finalDias = currentViatico.dias;
      }
    }

    let finalValorDiario = cleanMoney(valorDiario);
    if (finalValorDiario === null || finalValorDiario < 0) {
      finalValorDiario = parseFloat(currentViatico.valor_diario) || 0;
    }

    let finalValorTotal = currentViatico.valor_total;
    const rawVT = req.body.valorTotal !== undefined ? req.body.valorTotal : req.body.valor_total;
    if (rawVT !== undefined) {
      if (rawVT === null || String(rawVT).trim() === '') {
        finalValorTotal = null;
      } else {
        const parsed = cleanMoney(rawVT);
        if (parsed !== null) finalValorTotal = parsed;
      }
    }

    let obsFinal = (observaciones || '').trim();

    let finalAprobadoPor = aprobadoPor || currentViatico.aprobado_por;
    if (targetStatus === 'Aprobado' && !finalAprobadoPor) {
      finalAprobadoPor = req.user.name || req.user.username || 'ADMINISTRACIÓN';
    }

    const targetSaldo = saldo !== undefined
      ? (saldo !== null && String(saldo).trim() !== '' && !isNaN(parseFloat(saldo)) ? parseFloat(saldo) : null)
      : currentViatico.saldo;

    await client.query(
      `UPDATE viaticos SET dependencia=$1, apellidos_nombres=$2, documento=$3, cargo=$4, destino=$5, motivo=$6,
        fecha_inicio=$7, fecha_fin=$8, dias=$9, valor_diario=$10, valor_total=$11,
        estado=$12, observaciones=$13, aprobado_por=$14,
        tipo_destino=COALESCE($15, tipo_destino), soporte=COALESCE($16, soporte),
        numero_resolucion=COALESCE($17, numero_resolucion), saldo=$18,
        id_paquete=COALESCE($19, id_paquete)
       WHERE id_viatico=$20`,
      [upper(dependencia), upper(persona), (documento||'').trim()||null, upper(cargo), upper(destino), motivo||'',
       targetFechaInicio, targetFechaFin, finalDias, finalValorDiario, finalValorTotal,
       targetStatus, obsFinal, finalAprobadoPor, tipoDestino||'Nacional', soporte||null,
       numeroResolucion||null, targetSaldo, id_paquete ? parseInt(id_paquete) : null, numId]
    );

    const historialNota = statusChanged
      ? `Estado actualizado de "${currentStatus}" a "${targetStatus}"`
      : 'Actualizado desde interfaz web';

    await client.query(
      `INSERT INTO historial_viaticos(id_viatico, estado_anterior, estado_nuevo, nota, actualizado_por, fecha_actualizacion) 
       VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [numId, statusChanged ? currentStatus : null, targetStatus, historialNota, req.user.username||'web']
    );

    await client.query('COMMIT');
    res.json({ message: 'Viático actualizado.', id: numId, estado: targetStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[viaticos] update error:', err.message);
    if (err.code === '23503' || (err.message && err.message.includes('foreign key constraint'))) {
      return res.status(400).json({ error: 'El documento especificado no corresponde a ningún servidor público registrado en la plataforma.' });
    }
    res.status(500).json({ error: 'Error al actualizar viático.' });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/viaticos/:id/status ──────────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes para modificar el estado de viáticos.' });
  const numId = parseInt(req.params.id, 10);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID de viático inválido.' });

  const { estado, observaciones, saldo, soporte } = req.body;
  if (!estado) return res.status(400).json({ error: 'El estado es requerido.' });

  const targetStatus = normalizeStatus(estado);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Bloqueo pesimista para concurrencia atómica
    const curRes = await client.query(
      'SELECT id_viatico, estado, observaciones, aprobado_por, saldo, soporte FROM viaticos WHERE id_viatico = $1 FOR UPDATE',
      [numId]
    );

    if (curRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Viático no encontrado.' });
    }

    const currentViatico = curRes.rows[0];
    const currentStatus = normalizeStatus(currentViatico.estado);

    // Validar máquina de estados centralizada
    const check = validateTransition(currentStatus, targetStatus);
    if (!check.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: check.error });
    }

    // Validar justificación para estados extraordinarios de cancelación o rechazo
    const justificacion = (observaciones || '').trim();
    if ((targetStatus === 'Rechazado' || targetStatus === 'Anulado') && !justificacion) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Para marcar una comisión como "${targetStatus}" es obligatorio suministrar una justificación u observación.`
      });
    }

    let aprobadoPorVal = currentViatico.aprobado_por;
    if (targetStatus === 'Aprobado') {
      aprobadoPorVal = req.user.name || req.user.username || 'ADMINISTRACIÓN';
    }

    let obsFinal = currentViatico.observaciones || '';
    if (justificacion) {
      obsFinal = obsFinal ? `${obsFinal} | [${targetStatus}]: ${justificacion}` : `[${targetStatus}]: ${justificacion}`;
    }

    const saldoVal = saldo !== undefined ? (parseFloat(saldo) || 0) : currentViatico.saldo;
    const soporteVal = soporte !== undefined ? (soporte || null) : currentViatico.soporte;

    await client.query(
      `UPDATE viaticos 
       SET estado = $1, observaciones = $2, aprobado_por = $3, saldo = $4, soporte = $5
       WHERE id_viatico = $6`,
      [targetStatus, obsFinal, aprobadoPorVal, saldoVal, soporteVal, numId]
    );

    const notaHistorial = justificacion || `Transición de estado de "${currentStatus}" a "${targetStatus}"`;
    await client.query(
      `INSERT INTO historial_viaticos(id_viatico, estado_anterior, estado_nuevo, nota, actualizado_por, fecha_actualizacion) 
       VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [numId, currentStatus, targetStatus, notaHistorial, req.user.username || 'web']
    );

    await client.query('COMMIT');
    res.json({
      message: `Estado de viático actualizado exitosamente a "${targetStatus}".`,
      id: numId,
      estado_anterior: currentStatus,
      estado: targetStatus,
      aprobado_por: aprobadoPorVal
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[viaticos] patch status error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estado del viático: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/viaticos/:id/historial — Consulta de trazabilidad del ciclo de vida ───
router.get('/:id/historial', auth, async (req, res) => {
  if (!canRead(req.user)) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de lectura sobre el módulo de viáticos.' });
  const numId = parseInt(req.params.id, 10);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID de viático inválido.' });

  try {
    const r = await pool.query(
      `SELECT id_historial, id_viatico, estado_anterior, estado_nuevo, nota, actualizado_por, fecha_actualizacion
       FROM historial_viaticos
       WHERE id_viatico = $1
       ORDER BY fecha_actualizacion ASC, id_historial ASC`,
      [numId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[viaticos] historial error:', err.message);
    res.status(500).json({ error: 'Error al consultar historial del viático.' });
  }
});

// ─── DELETE /api/viaticos/:id ─────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  if (!canEdit(req.user)) return res.status(403).json({ error: 'Permisos insuficientes para eliminar viáticos.' });
  const numId = parseInt(req.params.id, 10);
  if (!numId || numId <= 0) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const cur = await pool.query('SELECT estado FROM viaticos WHERE id_viatico = $1', [numId]);
    if (cur.rowCount === 0) return res.status(404).json({ error: 'Viático no encontrado.' });
    
    const currentStatus = normalizeStatus(cur.rows[0].estado);
    if (currentStatus === 'Legalizado') {
      return res.status(400).json({
        error: 'No se puede eliminar una comisión en estado Legalizado ya que constituye soporte contable y presupuestal cerrado. En su lugar utilice Anulado si aplica.'
      });
    }

    await pool.query('DELETE FROM historial_viaticos WHERE id_viatico = $1', [numId]);
    const r = await pool.query('DELETE FROM viaticos WHERE id_viatico = $1 RETURNING id_viatico', [numId]);
    res.json({ message: 'Viático eliminado exitosamente.' });
  } catch (err) {
    console.error('[viaticos] delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar viático.' });
  }
});

module.exports = router;
