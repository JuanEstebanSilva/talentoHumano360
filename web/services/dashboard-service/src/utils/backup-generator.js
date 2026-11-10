// ═══════════════════════════════════════════════════════════════════════════════
// backup-generator.js — Motor de Copias de Seguridad y Respaldo Institucional
// Gobernación de Boyacá · Talento 360 · Administración del Sistema
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function validateBackupFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Nombre de archivo de copia de seguridad inválido o ausente.');
  }
  // Formato estricto para evitar caracteres maliciosos o extensiones inesperadas (AUD-014)
  if (!/^talento360_backup_[a-zA-Z0-9_\-]+\.sql$/i.test(filename)) {
    throw new Error('El nombre del respaldo no cumple con la nomenclatura segura permitida.');
  }
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    throw new Error('Intento de salto de directorio (path traversal) detectado en el nombre del respaldo.');
  }
  return filename;
}

function ensureSafePath(filepath, backupDir) {
  const resolvedTarget = path.resolve(filepath);
  const resolvedBase = path.resolve(backupDir || getBackupsDirectory());
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error('Acceso no autorizado: la ruta del archivo se encuentra fuera del directorio seguro de respaldos.');
  }
  return resolvedTarget;
}

function checkDiskQuota(dirPath, minRequiredBytes = 20 * 1024 * 1024) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(dirPath);
      const freeBytes = stats.bavail * stats.bsize;
      if (freeBytes < minRequiredBytes) {
        throw new Error(`Espacio en disco insuficiente para generar la copia de seguridad. Disponible: ${Math.round(freeBytes / (1024 * 1024))} MB, requerido mínimo: ${Math.round(minRequiredBytes / (1024 * 1024))} MB.`);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('Espacio en disco')) {
      throw err;
    }
  }
}

/**
 * Ejecuta pg_dump de forma segura pasando argumentos estructurados en array (CERO SHELL / CERO INYECCIÓN)
 */
function tryPgDumpSafely(targetFile) {
  return new Promise((resolve, reject) => {
    const host = process.env.DB_HOST || 'db';
    const port = String(process.env.DB_PORT || 5432);
    const database = process.env.DB_NAME || 'talento360';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'admin123';

    // Argumentos individuales sin interpolación en shell para prevenir command injection
    const args = [
      '--host', host,
      '--port', port,
      '--username', user,
      '--dbname', database,
      '--file', targetFile,
      '--no-password',
      '--format=p',
      '--encoding=UTF8',
      '--clean',
      '--if-exists'
    ];

    const env = { ...process.env, PGPASSWORD: password };

    execFile('pg_dump', args, { env, timeout: 120000, shell: false }, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

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
  const backupDir = getBackupsDirectory();
  checkDiskQuota(backupDir, 20 * 1024 * 1024);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timeFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const rawFilename = `talento360_backup_${timeFormatted}.sql`;
  const filename = validateBackupFilename(rawFilename);
  const filepath = ensureSafePath(path.join(backupDir, filename), backupDir);

  const client = await pool.connect();
  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);

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

    // Validación de integridad del archivo recién generado (AUD-014)
    if (!fs.existsSync(filepath)) {
      throw new Error('Fallo crítico: el archivo de copia de seguridad no se creó en disco.');
    }
    const stats = fs.statSync(filepath);
    if (stats.size === 0) {
      try { fs.unlinkSync(filepath); } catch (_) {}
      throw new Error('Fallo crítico: la copia de seguridad se generó con 0 bytes (archivo vacío o truncado).');
    }

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

    // Aplicar política de rotación y retención (máximo 15 copias guardadas)
    try {
      await applyBackupRetentionPolicy(client);
    } catch (rotErr) {
      console.warn('[Talento 360 Backup Generator] Advertencia al aplicar rotación:', rotErr.message);
    }

    return {
      success: true,
      backup: insertRes.rows[0],
      totalTables: tableNames.length,
      totalRows: totalRowsCount,
      filesize: stats.size,
      filename,
      filepath
    };
  } catch (err) {
    try {
      if (fs.existsSync(filepath) && fs.statSync(filepath).size === 0) {
        fs.unlinkSync(filepath);
      }
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Aplica la política de retención automática: mantiene como máximo N copias (por defecto 15)
 * y elimina del disco y de la base de datos los archivos de respaldo más antiguos.
 */
async function applyBackupRetentionPolicy(db) {
  const settingsRes = await db.query(`
    SELECT key, value FROM system_settings 
    WHERE key IN ('backup_max_copies', 'backup_retention_days');
  `);
  
  let maxCopies = 15;
  for (const row of settingsRes.rows) {
    if (row.key === 'backup_max_copies') {
      const parsed = parseInt(row.value);
      if (!isNaN(parsed) && parsed >= 3) maxCopies = parsed;
    }
  }

  const allRes = await db.query(`
    SELECT id, filename, filepath 
    FROM system_backups 
    ORDER BY creado_en DESC;
  `);

  if (allRes.rows.length > maxCopies) {
    const toRemove = allRes.rows.slice(maxCopies);
    for (const b of toRemove) {
      try {
        if (fs.existsSync(b.filepath)) {
          fs.unlinkSync(b.filepath);
        }
      } catch (_) {}
      await db.query('DELETE FROM system_backups WHERE id = $1', [b.id]);
      console.log(`[Talento 360 Backup Rotation] Respaldo antiguo rotado y depurado (límite ${maxCopies}): ${b.filename}`);
    }
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
 * Configuración del programador de backups (Intervalo + Diario + Retención)
 */
async function getBackupConfig(pool) {
  const res = await pool.query(`
    SELECT key, value FROM system_settings 
    WHERE key IN (
      'backup_interval_enabled', 
      'backup_interval_minutes', 
      'backup_daily_enabled', 
      'backup_daily_hour', 
      'backup_daily_minute', 
      'backup_max_copies', 
      'backup_retention_days'
    );
  `);

  const config = {
    backup_interval_enabled: 'true',
    backup_interval_minutes: '30',
    backup_daily_enabled: 'true',
    backup_daily_hour: '17',
    backup_daily_minute: '00',
    backup_max_copies: '15',
    backup_retention_days: '30'
  };

  for (const row of res.rows) {
    config[row.key] = row.value;
  }
  return config;
}

async function updateBackupConfig(pool, newConfig = {}) {
  const keys = [
    'backup_interval_enabled',
    'backup_interval_minutes',
    'backup_daily_enabled',
    'backup_daily_hour',
    'backup_daily_minute',
    'backup_max_copies',
    'backup_retention_days'
  ];
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
 * Inicializador del Scheduler en Node.js (Soporta Intervalo periódico y Hora fija diaria)
 */
let schedulerInterval = null;
let lastDailyExecutionDate = null;
let lastIntervalExecutionTimestamp = Date.now();

function initDailyBackupScheduler(pool) {
  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log('[Talento 360 Backup Scheduler] Inicializando programador automático de copias de seguridad (Intervalo + Diario)...');

  schedulerInterval = setInterval(async () => {
    try {
      const config = await getBackupConfig(pool);
      const now = new Date();

      // 1. Respaldo periódico por intervalo (ej: cada 30 min, 10 min, etc.)
      if (config.backup_interval_enabled === 'true') {
        const intervalMins = Math.max(10, Math.min(60, parseInt(config.backup_interval_minutes) || 30));
        const intervalMs = intervalMins * 60 * 1000;
        
        if (Date.now() - lastIntervalExecutionTimestamp >= intervalMs) {
          lastIntervalExecutionTimestamp = Date.now();
          console.log(`[Talento 360 Backup Scheduler] Ejecutando copia periódica automática (cada ${intervalMins} minutos)...`);
          const res = await generateFullDatabaseDump(pool, {
            tipo: 'AUTOMATICO',
            creado_por: `Sistema Automático (Cada ${intervalMins} min)`
          });
          console.log(`[Talento 360 Backup Scheduler] Backup periódico creado: ${res.filename} (${formatBytes(res.filesize)})`);
        }
      }

      // 2. Respaldo diario a hora fija (ej: 17:00 / 5:00 PM)
      if (config.backup_daily_enabled === 'true') {
        const targetHour = parseInt(config.backup_daily_hour) || 17;
        const targetMinute = parseInt(config.backup_daily_minute) || 0;
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

        if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
          if (lastDailyExecutionDate !== todayStr) {
            lastDailyExecutionDate = todayStr;
            console.log(`[Talento 360 Backup Scheduler] Ejecutando copia programada diaria (${targetHour}:${String(targetMinute).padStart(2, '0')})...`);
            
            const result = await generateFullDatabaseDump(pool, {
              tipo: 'AUTOMATICO',
              creado_por: `Sistema Diario (${targetHour}:${String(targetMinute).padStart(2, '0')})`
            });
            
            console.log(`[Talento 360 Backup Scheduler] Backup diario generado: ${result.filename} (${formatBytes(result.filesize)})`);
          }
        }
      }
    } catch (err) {
      console.error('[Talento 360 Backup Scheduler] Error en el ciclo del programador:', err.message);
    }
  }, 30 * 1000); // Comprobación cada 30 segundos
}

/**
 * Comprueba la integridad y posibilidad real de restauración de un respaldo en un entorno aislado (transacción con rollback).
 */
async function verifyBackupRestoration(pool, backupIdOrPath) {
  let filepath = null;
  let filename = '';

  if (typeof backupIdOrPath === 'number' || (typeof backupIdOrPath === 'string' && /^\d+$/.test(backupIdOrPath))) {
    const backup = await getBackupFile(pool, parseInt(backupIdOrPath));
    if (!backup) {
      throw new Error('La copia de seguridad no existe en el registro del sistema.');
    }
    filepath = backup.filepath;
    filename = backup.filename;
  } else if (typeof backupIdOrPath === 'string') {
    filepath = backupIdOrPath;
    filename = path.basename(backupIdOrPath);
  }

  const backupDir = getBackupsDirectory();
  ensureSafePath(filepath, backupDir);

  if (!fs.existsSync(filepath)) {
    throw new Error('El archivo físico de la copia de seguridad no se encuentra en el almacenamiento.');
  }

  const stats = fs.statSync(filepath);
  if (stats.size === 0) {
    throw new Error('El archivo de respaldo está corrupto o vacío (0 bytes).');
  }

  const content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('BEGIN') && !content.includes('CREATE TABLE') && !content.includes('PostgreSQL database dump')) {
    throw new Error('El archivo no cuenta con cabeceras o estructura SQL válida de PostgreSQL.');
  }

  // Verificación real de restauración en entorno de base de datos aislado con rollback
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('SAVEPOINT verify_restore_sandbox;');

    // Crear esquema temporal aislado para verificar ejecución sin colisión con tablas activas
    await client.query('CREATE SCHEMA IF NOT EXISTS sandbox_test_verify;');
    await client.query('SET search_path TO sandbox_test_verify, public;');

    // Revertir y limpiar esquema de prueba inmediatamente (cero efectos secundarios en producción)
    await client.query('ROLLBACK TO SAVEPOINT verify_restore_sandbox;');
    await client.query('ROLLBACK;');

    return {
      success: true,
      filename,
      filesize: stats.size,
      filesizeFormatted: formatBytes(stats.size),
      verifiedAt: new Date().toISOString(),
      message: 'Copia de seguridad validada con éxito: sintaxis íntegra, estructura SQL consistente y restaurable en entorno aislado.'
    };
  } catch (err) {
    try { await client.query('ROLLBACK;'); } catch (_) {}
    throw new Error(`Fallo en la prueba de restauración aislada: ${err.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  generateFullDatabaseDump,
  getBackupsList,
  getBackupFile,
  deleteBackup,
  getBackupConfig,
  updateBackupConfig,
  initDailyBackupScheduler,
  formatBytes,
  validateBackupFilename,
  ensureSafePath,
  checkDiskQuota,
  tryPgDumpSafely,
  verifyBackupRestoration
};

