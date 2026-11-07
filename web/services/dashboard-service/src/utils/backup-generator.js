// ═══════════════════════════════════════════════════════════════════════════════
// backup-generator.js — Motor de Copias de Seguridad y Respaldo Institucional
// Gobernación de Boyacá · Talento 360 · Administración del Sistema
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

function getBackupsDirectory() {
  const candidates = [
    path.resolve(__dirname, '../../../../database/backups'),
    path.resolve(__dirname, '../../../database/backups'),
    path.resolve(__dirname, '../../backups'),
    path.resolve(process.cwd(), 'backups'),
    path.resolve(process.cwd(), 'database/backups')
  ];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (_) {}
  }
  const fallback = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Genera un dump SQL completo de la base de datos de forma nativa e independiente.
 */
async function generateFullDatabaseDump(pool, options = {}) {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    const now = new Date();
    
    // Formato de nombre: talento360_backup_2026-11-06_19-30-00.sql
    const pad = (n) => String(n).padStart(2, '0');
    const timeFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `talento360_backup_${timeFormatted}.sql`;

    const backupDir = getBackupsDirectory();
    const filepath = path.join(backupDir, filename);

    let sqlContent = `-- ═══════════════════════════════════════════════════════════════════════════\n`;
    sqlContent += `-- Talento 360 — Copia de Seguridad Completa del Sistema\n`;
    sqlContent += `-- Gobernación de Boyacá · Subdirección de Talento Humano\n`;
    sqlContent += `-- Fecha de Generación: ${now.toLocaleString('es-CO')} (${now.toISOString()})\n`;
    sqlContent += `-- Tipo de Respaldo: ${options.tipo || 'MANUAL'}\n`;
    sqlContent += `-- Solicitado por: ${options.creado_por || 'admin'}\n`;
    sqlContent += `-- Total de Tablas Respaldadas: ${tableNames.length}\n`;
    sqlContent += `-- ═══════════════════════════════════════════════════════════════════════════\n\n`;
    sqlContent += `BEGIN;\n\n`;
    sqlContent += `SET client_encoding = 'UTF8';\n`;
    sqlContent += `SET standard_conforming_strings = on;\n\n`;

    let totalRowsCount = 0;

    for (const tableName of tableNames) {
      // Excluir la tabla de backups para evitar autorreferencias circulares
      if (tableName === 'system_backups') continue;

      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      if (colsRes.rows.length === 0) continue;

      const colNames = colsRes.rows.map(c => c.column_name);
      const quotedCols = colNames.map(c => `"${c}"`).join(', ');

      const dataRes = await client.query(`SELECT * FROM "${tableName}";`);
      const rowCount = dataRes.rows.length;
      totalRowsCount += rowCount;

      sqlContent += `-- ─── Tabla: ${tableName} (${rowCount} registros) ───\n`;

      if (rowCount > 0) {
        const chunkSize = 100;
        for (let i = 0; i < rowCount; i += chunkSize) {
          const chunk = dataRes.rows.slice(i, i + chunkSize);
          sqlContent += `INSERT INTO "${tableName}" (${quotedCols}) VALUES\n`;
          const valueRows = chunk.map(row => {
            const values = colNames.map(col => formatSqlValue(row[col])).join(', ');
            return `  (${values})`;
          });
          sqlContent += valueRows.join(',\n') + '\nON CONFLICT DO NOTHING;\n\n';
        }
      }

      // Reiniciar secuencias autonuméricas si existen
      const seqRes = await client.query(`
        SELECT pg_get_serial_sequence($1, 'id') as seq_name
      `, [tableName]).catch(() => ({ rows: [] }));

      if (seqRes.rows[0] && seqRes.rows[0].seq_name) {
        sqlContent += `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true);\n\n`;
      }
    }

    sqlContent += `COMMIT;\n\n`;
    sqlContent += `-- ═══════════════════════════════════════════════════════════════════════════\n`;
    sqlContent += `-- Fin de la Copia de Seguridad · Total Registros Exportados: ${totalRowsCount}\n`;
    sqlContent += `-- ═══════════════════════════════════════════════════════════════════════════\n`;

    fs.writeFileSync(filepath, sqlContent, 'utf8');
    const stats = fs.statSync(filepath);

    const insertRes = await client.query(`
      INSERT INTO system_backups (filename, filepath, filesize, tipo, creado_por, estado, detalles)
      VALUES ($1, $2, $3, $4, $5, 'Completado', $6)
      RETURNING *;
    `, [
      filename,
      filepath,
      stats.size,
      options.tipo || 'MANUAL',
      options.creado_por || 'admin',
      `Copia de seguridad completada con éxito: ${tableNames.length} tablas y ${totalRowsCount.toLocaleString('es-CO')} registros respaldados.`
    ]);

    return {
      success: true,
      backup: insertRes.rows[0],
      totalTables: tableNames.length,
      totalRows: totalRowsCount,
      filesize: stats.size,
      filename,
      filepath
    };
  } finally {
    client.release();
  }
}

/**
 * Consulta la lista de copias de seguridad guardadas
 */
async function getBackupsList(pool) {
  const res = await pool.query(`
    SELECT id, filename, filepath, filesize, tipo, creado_por, creado_en, estado, detalles
    FROM system_backups
    ORDER BY creado_en DESC
    LIMIT 100;
  `);

  return res.rows.map(b => {
    let existsOnDisk = false;
    let actualSize = b.filesize;
    try {
      if (fs.existsSync(b.filepath)) {
        existsOnDisk = true;
        actualSize = fs.statSync(b.filepath).size;
      }
    } catch (_) {}

    return {
      ...b,
      existsOnDisk,
      filesizeFormatted: formatBytes(actualSize)
    };
  });
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Obtiene el archivo para descarga directa
 */
async function getBackupFile(pool, backupId) {
  const res = await pool.query('SELECT * FROM system_backups WHERE id = $1', [backupId]);
  if (res.rows.length === 0) return null;
  const backup = res.rows[0];
  if (!fs.existsSync(backup.filepath)) {
    // Si la ruta absoluta cambió (por ejemplo entre contenedor y host), buscar en el directorio actual de backups
    const fallbackPath = path.join(getBackupsDirectory(), backup.filename);
    if (fs.existsSync(fallbackPath)) {
      backup.filepath = fallbackPath;
    } else {
      return null;
    }
  }
  return backup;
}

/**
 * Elimina una copia de seguridad física y de base de datos
 */
async function deleteBackup(pool, backupId) {
  const res = await pool.query('SELECT * FROM system_backups WHERE id = $1', [backupId]);
  if (res.rows.length === 0) return false;
  const backup = res.rows[0];

  try {
    if (fs.existsSync(backup.filepath)) {
      fs.unlinkSync(backup.filepath);
    }
  } catch (_) {}

  await pool.query('DELETE FROM system_backups WHERE id = $1', [backupId]);
  return true;
}

/**
 * Configuración del programador de backups
 */
async function getBackupConfig(pool) {
  const res = await pool.query(`
    SELECT key, value FROM system_settings 
    WHERE key IN ('backup_daily_enabled', 'backup_daily_hour', 'backup_daily_minute', 'backup_retention_days');
  `);

  const config = {
    backup_daily_enabled: 'true',
    backup_daily_hour: '23',
    backup_daily_minute: '00',
    backup_retention_days: '30'
  };

  for (const row of res.rows) {
    config[row.key] = row.value;
  }
  return config;
}

async function updateBackupConfig(pool, newConfig = {}) {
  const keys = ['backup_daily_enabled', 'backup_daily_hour', 'backup_daily_minute', 'backup_retention_days'];
  for (const key of keys) {
    if (newConfig[key] !== undefined) {
      await pool.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
      `, [key, String(newConfig[key])]);
    }
  }
  return getBackupConfig(pool);
}

/**
 * Inicializador del Scheduler Diario en Node.js
 */
let schedulerInterval = null;
let lastDailyExecutionDate = null;

function initDailyBackupScheduler(pool) {
  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log('[Talento 360 Backup Scheduler] Inicializando programador diario de copias de seguridad...');

  schedulerInterval = setInterval(async () => {
    try {
      const config = await getBackupConfig(pool);
      if (config.backup_daily_enabled !== 'true') return;

      const now = new Date();
      const targetHour = parseInt(config.backup_daily_hour) || 23;
      const targetMinute = parseInt(config.backup_daily_minute) || 0;

      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
        if (lastDailyExecutionDate !== todayStr) {
          lastDailyExecutionDate = todayStr;
          console.log(`[Talento 360 Backup Scheduler] Ejecutando copia de seguridad programada diaria (${targetHour}:${targetMinute})...`);
          
          const result = await generateFullDatabaseDump(pool, {
            tipo: 'AUTOMATICO',
            creado_por: 'Sistema Programado'
          });
          
          console.log(`[Talento 360 Backup Scheduler] Backup automático generado exitosamente: ${result.filename} (${formatBytes(result.filesize)})`);
        }
      }
    } catch (err) {
      console.error('[Talento 360 Backup Scheduler] Error en el ciclo del programador:', err.message);
    }
  }, 45 * 1000); // Comprobación cada 45 segundos
}

module.exports = {
  generateFullDatabaseDump,
  getBackupsList,
  getBackupFile,
  deleteBackup,
  getBackupConfig,
  updateBackupConfig,
  initDailyBackupScheduler,
  formatBytes
};
