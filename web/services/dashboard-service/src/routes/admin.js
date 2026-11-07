// ═══════════════════════════════════════════════════════════════════════════════
// admin.js — Rutas de Administración Técnica: Monitoreo de Errores y Copias de Seguridad
// Gobernación de Boyacá · Talento 360 · Sistema de Gestión Departamental
// ═══════════════════════════════════════════════════════════════════════════════

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const backupEngine = require('../utils/backup-generator');

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

// Iniciar programador automático de respaldos diarios
backupEngine.initDailyBackupScheduler(pool);

// Middleware de verificación de rol Administrador
function requireAdmin(req, res, next) {
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Se requiere inicio de sesión de Administrador.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const role = String(decoded.role || decoded.rol || '').toLowerCase();
    const isAdminRole = (role === 'admin' || role === 'administrador');

    if (!isAdminRole) {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador del Sistema.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token de sesión inválido o expirado.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REPORTE Y CAPTURA DE ERRORES (Endpoint Público para el Cliente / SPA)
// ─────────────────────────────────────────────────────────────────────────────

// Helper seguro para resolución de IP de origen contra suplantación (AUD-014)
function resolveClientIp(req) {
  if (req.ip) {
    return req.ip.replace(/^::ffff:/, '').trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.replace(/^::ffff:/, '').trim();
  }
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const parts = xff.split(',').map(s => s.trim().replace(/^::ffff:/, '')).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return (req.socket && req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^::ffff:/, '').trim() : '127.0.0.1');
}

function computeSeverity(tipo, mensaje) {
  const t = String(tipo || '').toUpperCase();
  const m = String(mensaje || '').toLowerCase();
  if (t === 'CRITICAL' || t === 'FATAL' || t === 'UNHANDLED_REJECTION' || m.includes('fatal') || m.includes('error 500')) {
    return 'CRITICA';
  }
  if (t === 'API_ERROR' || t === 'ERROR' || t === 'DB_ERROR') {
    return 'ALTA';
  }
  if (t === 'CONSOLE_ERROR' || t === 'WARNING' || t === 'WARN') {
    return 'MEDIA';
  }
  return 'BAJA';
}

// Cache en memoria para deduplicar ráfagas de errores idénticos en menos de 5 segundos
const recentErrorDedupe = new Map();

router.post('/errors', async (req, res) => {
  try {
    const { tipo, mensaje, url, stack, usuario, reportadoPorUsuario } = req.body || {};

    if (!mensaje && !tipo) {
      return res.status(400).json({ error: 'Datos de error incompletos.' });
    }

    const cleanTipo = String(tipo || 'CONSOLE_ERROR').toUpperCase().slice(0, 50);
    const cleanMensaje = String(mensaje || 'Error no especificado').slice(0, 5000);
    const cleanUrl = String(url || req.headers.referer || '').slice(0, 1000);
    const cleanStack = stack ? String(stack).slice(0, 10000) : null;
    const cleanUser = String(usuario || 'Anónimo').slice(0, 150);
    const ipAddress = resolveClientIp(req);
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    const isUserReport = !!reportadoPorUsuario;

    // Deduplicación básica: evitar registrar 50 veces el mismo error en 5 segundos
    const dedupeKey = `${cleanTipo}:${cleanUrl}:${cleanMensaje.slice(0, 100)}`;
    const now = Date.now();
    if (recentErrorDedupe.has(dedupeKey) && (now - recentErrorDedupe.get(dedupeKey)) < 5000 && !isUserReport) {
      return res.json({ success: true, deduplicated: true });
    }
    recentErrorDedupe.set(dedupeKey, now);

    // Limpieza periódica de memoria de deduplicación
    if (recentErrorDedupe.size > 200) {
      recentErrorDedupe.clear();
    }

    const insertQ = await pool.query(`
      INSERT INTO system_errors (tipo, mensaje, url, stack, usuario, ip_address, user_agent, reportado_por_usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, creado_en;
    `, [cleanTipo, cleanMensaje, cleanUrl, cleanStack, cleanUser, ipAddress, userAgent, isUserReport]);

    return res.status(201).json({
      success: true,
      id: insertQ.rows[0].id,
      creado_en: insertQ.rows[0].creado_en,
      message: 'Incidencia registrada en el panel de administración.'
    });
  } catch (err) {
    console.error('[Admin Errors API] Error al guardar error:', err.message);
    return res.status(500).json({ error: 'No se pudo registrar la incidencia.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONSULTA Y GESTIÓN DE ERRORES (Solo Administrador)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/errors', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const tipoFilter = req.query.tipo;
    const severidadFilter = req.query.severidad || req.query.severity;
    const estadoFilter = req.query.estado;
    const search = req.query.search || req.query.q;
    const servicioFilter = req.query.servicio || req.query.service;
    const desde = req.query.desde || req.query.fecha_inicio;
    const hasta = req.query.hasta || req.query.fecha_fin;

    const conditions = [];
    const params = [];

    if (tipoFilter && tipoFilter !== 'TODOS') {
      params.push(tipoFilter);
      conditions.push(`tipo = $${params.length}`);
    }

    if (severidadFilter && severidadFilter !== 'TODAS' && severidadFilter !== 'TODOS') {
      const sev = String(severidadFilter).toUpperCase().trim();
      if (sev === 'CRITICA' || sev === 'CRITICAL') {
        conditions.push(`(tipo IN ('CRITICAL', 'FATAL', 'UNHANDLED_REJECTION') OR mensaje ILIKE '%fatal%' OR mensaje ILIKE '%500%')`);
      } else if (sev === 'ALTA' || sev === 'ERROR') {
        conditions.push(`(tipo IN ('API_ERROR', 'ERROR', 'DB_ERROR') AND mensaje NOT ILIKE '%fatal%')`);
      } else if (sev === 'MEDIA' || sev === 'WARNING') {
        conditions.push(`(tipo IN ('CONSOLE_ERROR', 'WARNING', 'WARN'))`);
      } else if (sev === 'BAJA' || sev === 'INFO') {
        conditions.push(`(tipo IN ('PAGE_404', 'NOT_FOUND_404', 'INFO'))`);
      }
    }

    if (estadoFilter && estadoFilter !== 'TODOS') {
      params.push(estadoFilter);
      conditions.push(`estado = $${params.length}`);
    }

    if (servicioFilter && servicioFilter !== 'TODOS') {
      params.push(`%${servicioFilter.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(url) LIKE $${params.length} OR LOWER(mensaje) LIKE $${params.length})`);
    }

    if (desde) {
      params.push(new Date(desde));
      conditions.push(`creado_en >= $${params.length}`);
    }

    if (hasta) {
      params.push(new Date(hasta));
      conditions.push(`creado_en <= $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(mensaje) LIKE $${params.length} OR LOWER(url) LIKE $${params.length} OR LOWER(usuario) LIKE $${params.length} OR LOWER(ip_address) LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [listRes, countRes, summaryRes] = await Promise.all([
      pool.query(`
        SELECT id, tipo, mensaje, url, stack, usuario, ip_address, user_agent, estado, reportado_por_usuario, creado_en, resuelto_en, resuelto_por
        FROM system_errors
        ${whereClause}
        ORDER BY creado_en DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
      `, [...params, limit, offset]),

      pool.query(`SELECT COUNT(*) as total FROM system_errors ${whereClause};`, params),

      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE estado = 'Pendiente') as pendientes,
          COUNT(*) FILTER (WHERE estado = 'Resuelto') as resueltos,
          COUNT(*) FILTER (WHERE tipo = 'PAGE_404') as errores_404,
          COUNT(*) FILTER (WHERE tipo = 'CONSOLE_ERROR') as errores_consola,
          COUNT(*) FILTER (WHERE tipo = 'API_ERROR') as errores_api,
          COUNT(*) FILTER (WHERE reportado_por_usuario = true) as reportados_usuario,
          COUNT(*) FILTER (WHERE tipo IN ('CRITICAL', 'FATAL', 'UNHANDLED_REJECTION') OR mensaje ILIKE '%fatal%' OR mensaje ILIKE '%500%') as criticos
        FROM system_errors;
      `)
    ]);

    const total = parseInt(countRes.rows[0].total) || 0;
    const summary = summaryRes.rows[0] || {};

    const enrichedErrors = listRes.rows.map(row => ({
      ...row,
      severidad: computeSeverity(row.tipo, row.mensaje)
    }));

    return res.json({
      errors: enrichedErrors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        total: parseInt(summary.total) || 0,
        pendientes: parseInt(summary.pendientes) || 0,
        resueltos: parseInt(summary.resueltos) || 0,
        errores404: parseInt(summary.errores_404) || 0,
        erroresConsola: parseInt(summary.errores_consola) || 0,
        erroresApi: parseInt(summary.errores_api) || 0,
        reportadosUsuario: parseInt(summary.reportados_usuario) || 0,
        criticos: parseInt(summary.criticos) || 0
      }
    });
  } catch (err) {
    console.error('[Admin Errors API] Error al listar:', err.message);
    return res.status(500).json({ error: 'Error al consultar el registro de errores.' });
  }
});

router.patch('/errors/:id', requireAdmin, async (req, res) => {
  try {
    const errorId = parseInt(req.params.id);
    const { estado } = req.body || {};
    const rawEstado = String(estado || '').trim().toLowerCase();
    
    let cleanEstado = 'Pendiente';
    if (rawEstado.includes('revis') || rawEstado === 'en revisión') {
      cleanEstado = 'En Revisión';
    } else if (rawEstado.includes('resuelto') || rawEstado.includes('solucion')) {
      cleanEstado = 'Resuelto';
    }

    const resolvedBy = cleanEstado === 'Resuelto' ? (req.user.username || 'admin') : null;
    const resolvedAt = cleanEstado === 'Resuelto' ? new Date() : null;

    const result = await pool.query(`
      UPDATE system_errors 
      SET estado = $1, resuelto_en = $2, resuelto_por = $3
      WHERE id = $4
      RETURNING *;
    `, [cleanEstado, resolvedAt, resolvedBy, errorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de error no encontrado.' });
    }

    return res.json({ success: true, error: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar el estado del error.' });
  }
});

router.delete('/errors/:id', requireAdmin, async (req, res) => {
  try {
    const errorId = parseInt(req.params.id);
    await pool.query('DELETE FROM system_errors WHERE id = $1', [errorId]);
    return res.json({ success: true, message: 'Registro de error eliminado correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar el registro.' });
  }
});

router.post('/errors/clear-all', requireAdmin, async (req, res) => {
  try {
    const { onlyResolved } = req.body || {};
    if (onlyResolved) {
      await pool.query("DELETE FROM system_errors WHERE estado = 'Resuelto'");
    } else {
      await pool.query("DELETE FROM system_errors");
    }
    return res.json({ success: true, message: 'Registros de error depurados correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al depurar los errores.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GESTIÓN DE COPIAS DE SEGURIDAD / BACKUPS (Solo Administrador)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/backups/generate', requireAdmin, async (req, res) => {
  try {
    const user = req.user ? (req.user.username || req.user.nombre || 'admin') : 'admin';
    const result = await backupEngine.generateFullDatabaseDump(pool, {
      tipo: 'MANUAL',
      creado_por: user
    });

    return res.status(201).json({
      success: true,
      message: 'Copia de seguridad completa generada exitosamente.',
      backup: result.backup,
      filename: result.filename,
      filesizeFormatted: backupEngine.formatBytes(result.filesize),
      totalTables: result.totalTables,
      totalRows: result.totalRows
    });
  } catch (err) {
    console.error('[Admin Backups API] Error al generar backup:', err);
    return res.status(500).json({ error: `Fallo al generar la copia de seguridad: ${err.message}` });
  }
});

router.get('/backups', requireAdmin, async (_, res) => {
  try {
    const backups = await backupEngine.getBackupsList(pool);
    const config = await backupEngine.getBackupConfig(pool);
    return res.json({ backups, config });
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar las copias de seguridad.' });
  }
});

router.get('/backups/download/:id', requireAdmin, async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const backup = await backupEngine.getBackupFile(pool, backupId);

    if (!backup || !backup.filepath || !fs.existsSync(backup.filepath)) {
      return res.status(404).json({ error: 'El archivo de la copia de seguridad no existe en el almacenamiento.' });
    }

    // AUD-014: Validar rigurosamente que el archivo esté contenido en el directorio seguro
    const safeFilename = backupEngine.validateBackupFilename(backup.filename);
    const safePath = backupEngine.ensureSafePath(backup.filepath);

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    const fileStream = fs.createReadStream(safePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('[Admin Backups API] Error al descargar:', err.message);
    return res.status(500).json({ error: `Error al descargar la copia de seguridad: ${err.message}` });
  }
});

router.post('/backups/:id/verify', requireAdmin, async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const verification = await backupEngine.verifyBackupRestoration(pool, backupId);
    return res.json({
      success: true,
      message: 'Copia de seguridad verificada con éxito en entorno aislado.',
      verification
    });
  } catch (err) {
    console.error('[Admin Backups API] Error al verificar backup:', err.message);
    return res.status(400).json({ error: `Fallo de verificación: ${err.message}` });
  }
});

router.delete('/backups/:id', requireAdmin, async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const deleted = await backupEngine.deleteBackup(pool, backupId);
    if (!deleted) {
      return res.status(404).json({ error: 'Copia de seguridad no encontrada.' });
    }
    return res.json({ success: true, message: 'Copia de seguridad eliminada correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar la copia de seguridad.' });
  }
});

router.get('/backups/config', requireAdmin, async (_, res) => {
  try {
    const config = await backupEngine.getBackupConfig(pool);
    return res.json({ config });
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar la configuración de copias automáticas.' });
  }
});

router.put('/backups/config', requireAdmin, async (req, res) => {
  try {
    const updated = await backupEngine.updateBackupConfig(pool, req.body || {});
    return res.json({ success: true, message: 'Configuración de respaldos actualizada.', config: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar la configuración.' });
  }
});

module.exports = router;

