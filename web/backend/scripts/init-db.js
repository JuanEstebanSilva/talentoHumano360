// ═══════════════════════════════════════════════════════════════════════════════
// init-db.js — Inicializador y Migrador Seguro de Base de Datos (Talento 360)
// Gobernación de Boyacá · Protección absoluta de datos en Render, Neon y Docker
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function buildPoolConfig(useDirectUrl = false) {
  const connStr = useDirectUrl
    ? (process.env.DIRECT_URL || process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

  if (connStr) {
    return {
      connectionString: connStr,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };
  }

  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME     || 'talento360',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'admin123',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

// Pool principal de la aplicación (usa DATABASE_URL / pooled connection en Neon)
const pool = new Pool(buildPoolConfig(false));

// Scripts SQL maestros únicamente para inicialización desde cero (cuando public no tiene tablas)
const SQL_FILES = [
  '01_schema.sql',
  '02_seed_data.sql',
  '03_new_modules.sql',
  '04_horarios.sql',
  '05_divipola_and_hr_rules.sql',
  '06_hr_updates_experiencia_multiple.sql',
  '07_add_tiempo_total_gobernacion.sql',
  '08_full_divipola_update.sql',
  '09_cargos_nivel_update.sql',
  '10_sst_module.sql',
  '12_performance_indexes.sql',
  '13_paquetes_viaticos.sql',
  '15_user_roles_permissions.sql',
  '16_encargo_columns.sql',
  '17_add_fecha_retiro.sql',
  '18_system_errors_and_backups.sql',
  '19_add_safe_parse_date_and_fixes.sql',
  '20_viaticos_escalas_decretos.sql',
  '21_fix_divipola_boyaca.sql',
  '22_sequences_and_concurrency_employees.sql',
  '23_foreign_keys_and_referential_integrity.sql',
  '24_divipola_boyaca_asentamientos_y_normalizacion.sql',
  '25_viaticos_ciclo_de_vida_y_estados.sql',
  '26_rbac_cross_module_read_and_permissions.sql',
  '27_clean_transactional_inserts.sql',
  '28_viaticos_valor_total_drop_expression.sql',
  '29_password_recovery.sql',
  '30_clean_servidores_publicos.sql',
  '31_paquetes_viaticos_presupuesto_inicial.sql',
];

function findDatabaseDir() {
  const candidates = [
    path.resolve(__dirname, '../../../database'),
    path.resolve(__dirname, '../../database'),
    path.resolve(process.cwd(), 'database'),
    path.resolve(process.cwd(), '../database'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, '01_schema.sql'))) {
      return c;
    }
  }
  throw new Error('No se encontró el directorio database/ con los scripts SQL.');
}

async function getExistingTables(client) {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return res.rows.map(r => r.table_name);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(160) PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
}

async function isMigrationRecorded(client, version) {
  const res = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1;', [version]);
  return res.rows.length > 0;
}

async function recordMigration(client, version, description) {
  await client.query(
    `INSERT INTO schema_migrations (version, description)
     VALUES ($1, $2)
     ON CONFLICT (version) DO NOTHING;`,
    [version, description]
  );
}

async function tableExists(client, tableName) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1;`,
    [tableName]
  );
  return res.rows.length > 0;
}

/**
 * Hashea de forma segura únicamente contraseñas heredadas que aún estén en texto plano.
 * Nunca sobrescribe hashes bcrypt existentes ni modifica contraseñas personalizadas.
 */
async function hashPlaintextPasswordsSafely(client) {
  if (!(await tableExists(client, 'usuarios'))) return 0;
  const res = await client.query('SELECT id_usuario, password FROM usuarios;');
  let updated = 0;
  for (const u of res.rows) {
    const pwd = typeof u.password === 'string' ? u.password : '';
    const isBcrypt = pwd.startsWith('$2a$') || pwd.startsWith('$2b$');
    if (!isBcrypt && pwd.trim().length > 0) {
      const hashed = await bcrypt.hash(pwd.trim(), 12);
      await client.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2;', [hashed, u.id_usuario]);
      updated++;
    }
  }
  return updated;
}

/**
 * Migraciones estrictamente ADITIVAS e IDEMPOTENTES.
 * REGLA ABSOLUTA: Nunca ejecuta DROP DATABASE, DROP TABLE, TRUNCATE, DELETE masivo
 * ni sobrescribe usuarios o contraseñas existentes.
 */
async function runSafeMigrations(client) {
  console.log('[Talento 360 DB Migration] Verificando migraciones aditivas seguras...');
  const results = { columnsAdded: [], migrationsRecorded: [] };

  await ensureMigrationsTable(client);

  // 1. Columnas aditivas en rel_principal
  if (await tableExists(client, 'rel_principal')) {
    await client.query(`
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_denominacion VARCHAR(280);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_codigo VARCHAR(80);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_grado VARCHAR(80);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS encargo_asignacion VARCHAR(120);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS fecha_retiro VARCHAR(40);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS otros_tiempos_periodos JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS otro_tiempo_gobernacion VARCHAR(120);
      ALTER TABLE rel_principal ADD COLUMN IF NOT EXISTS tiempo_total_gobernacion VARCHAR(120);
    `);
    results.columnsAdded.push('rel_principal: encargo_* y fecha_retiro');
  }

  // 2. Columnas aditivas en personas
  if (await tableExists(client, 'personas')) {
    await client.query(`
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS documento_pendiente BOOLEAN DEFAULT false;
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS es_vacante BOOLEAN DEFAULT false;
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS departamento_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS ciudad_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS municipio_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS tipo_discapacidad VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(30);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_nacimiento VARCHAR(60);
    `);
    results.columnsAdded.push('personas: campos institucionales');
  }

  // 3. Columnas aditivas en educacion y contactos
  if (await tableExists(client, 'educacion')) {
    await client.query(`
      ALTER TABLE educacion ADD COLUMN IF NOT EXISTS tiene_diplomado BOOLEAN DEFAULT false;
      ALTER TABLE educacion ADD COLUMN IF NOT EXISTS diplomado_cap_sena VARCHAR(280);
    `);
  }
  if (await tableExists(client, 'contactos')) {
    await client.query(`
      ALTER TABLE contactos ADD COLUMN IF NOT EXISTS celulares JSONB DEFAULT '[]'::jsonb;
    `);
    results.columnsAdded.push('educacion y contactos: diplomado y celulares');
  }

  // 4. Columnas aditivas en estados
  if (await tableExists(client, 'estados')) {
    await client.query(`
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS estado_servidor VARCHAR(40) DEFAULT 'Activo';
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS funciones VARCHAR(200);
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS funciones_pagadas VARCHAR(200);
    `);
    results.columnsAdded.push('estados: estado_servidor y funciones');
  }

  // 5. Tabla paquetes_viaticos y migración 28 (desacoplar expresión calculada en valor_total)
  if (await tableExists(client, 'viaticos')) {
    await client.query(`
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
      CREATE INDEX IF NOT EXISTS idx_viaticos_paquete ON viaticos(id_paquete);
      CREATE INDEX IF NOT EXISTS idx_paquetes_anio ON paquetes_viaticos(anio);
    `);

    if (!(await isMigrationRecorded(client, '2026_13_paquetes_viaticos_seed'))) {
      await client.query(`
        INSERT INTO paquetes_viaticos (id_paquete, nombre, archivo_origen, anio, descripcion)
        VALUES
          (1, 'Ejecución Presupuestal 2022', 'EJECUCION PRESUPUESTAL 2022.xlsx', 2022, 'Vigencia fiscal 2022 institucional'),
          (2, 'Ejecución Presupuestal 2023', 'EJECUCION PRESUPUESTAL 2023.xlsx', 2023, 'Vigencia fiscal 2023 institucional'),
          (3, 'Ejecución Presupuestal 2024', 'EJECUCION PRESUPUESTAL 2024.xlsx', 2024, 'Vigencia fiscal 2024 institucional'),
          (4, 'Ejecución Presupuestal 2025', 'EJECUCION PRESUPUESTAL 2025.xlsx', 2025, 'Vigencia fiscal 2025 institucional'),
          (5, 'Ejecución Presupuestal 2026', 'EJECUCION PRESUPUESTAL 2026.xlsx', 2026, 'Vigencia fiscal 2026 en curso')
        ON CONFLICT (id_paquete) DO NOTHING;

        UPDATE viaticos SET id_paquete = 1 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2022%';
        UPDATE viaticos SET id_paquete = 2 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2023%';
        UPDATE viaticos SET id_paquete = 3 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2024%';
        UPDATE viaticos SET id_paquete = 4 WHERE id_paquete IS NULL AND fecha_inicio LIKE '%2025%';
        UPDATE viaticos SET id_paquete = 5 WHERE id_paquete IS NULL;
      `);
      await recordMigration(client, '2026_13_paquetes_viaticos_seed', 'Catálogo inicial de paquetes de viáticos sin sobrescribir existentes');
      results.migrationsRecorded.push('2026_13_paquetes_viaticos_seed');
    }

    if (!(await isMigrationRecorded(client, '28_viaticos_valor_total_drop_expression'))) {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'viaticos'
              AND column_name = 'valor_total'
              AND is_generated = 'ALWAYS'
          ) THEN
            ALTER TABLE viaticos ALTER COLUMN valor_total DROP EXPRESSION IF EXISTS;
          END IF;
        END $$;
        ALTER TABLE viaticos ALTER COLUMN valor_total DROP NOT NULL;
      `);
      await recordMigration(client, '28_viaticos_valor_total_drop_expression', 'Desacoplar expresión generada de valor_total en viáticos');
      results.migrationsRecorded.push('28_viaticos_valor_total_drop_expression');
    }

    results.columnsAdded.push('viaticos: paquetes_viaticos y valor_total');
  }

  // 6. Columnas aditivas en horarios
  if (await tableExists(client, 'horarios')) {
    await client.query(`
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS numero_consecutivo INTEGER;
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS codigo VARCHAR(80);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS grado VARCHAR(80);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS secretaria VARCHAR(280);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(80);
    `);
    results.columnsAdded.push('horarios: campos adicionales');
  }

  // 7. Columnas de autenticación, RBAC y recuperación de contraseña en usuarios (NUNCA DELETE/RESET)
  if (await tableExists(client, 'usuarios')) {
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;
      CREATE TABLE IF NOT EXISTS auth_failed_logins (
        identifier VARCHAR(160) PRIMARY KEY,
        failed_attempts INT NOT NULL DEFAULT 0,
        lockout_tier INT NOT NULL DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await recordMigration(client, '29_password_recovery', 'Columnas de recuperación de contraseña y tabla auth_failed_logins');
    results.columnsAdded.push('usuarios: rbac y password_recovery');
  }

  // 8. Tablas aditivas de monitoreo y respaldos
  await client.query(`
    CREATE TABLE IF NOT EXISTS system_errors (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(50) NOT NULL,
      mensaje TEXT NOT NULL,
      url TEXT,
      stack TEXT,
      usuario VARCHAR(150) DEFAULT 'Anónimo',
      ip_address VARCHAR(100),
      user_agent TEXT,
      estado VARCHAR(30) DEFAULT 'Pendiente',
      reportado_por_usuario BOOLEAN DEFAULT FALSE,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      resuelto_en TIMESTAMP WITH TIME ZONE,
      resuelto_por VARCHAR(150)
    );
    CREATE TABLE IF NOT EXISTS system_backups (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      filepath TEXT NOT NULL,
      filesize BIGINT DEFAULT 0,
      tipo VARCHAR(50) DEFAULT 'MANUAL',
      creado_por VARCHAR(150) DEFAULT 'admin',
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      estado VARCHAR(50) DEFAULT 'Completado',
      detalles TEXT
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Migración 30: Limpieza controlada de datos de prueba de servidores públicos
  if (!(await isMigrationRecorded(client, '30_clean_servidores_publicos'))) {
    if (await tableExists(client, 'rel_principal')) {
      console.log('[Talento 360 DB Migration] Ejecutando migración 30: limpieza de datos de prueba en servidores públicos...');
      await client.query(`
        ALTER TABLE IF EXISTS horarios DROP CONSTRAINT IF EXISTS fk_horarios_personas;
        ALTER TABLE IF EXISTS viaticos DROP CONSTRAINT IF EXISTS fk_viaticos_personas;
        DELETE FROM rel_principal;
        DELETE FROM personas;
        DELETE FROM contactos;
        DELETE FROM educacion;
        DELETE FROM estados WHERE id_estado NOT IN ('EST001', 'EST002', 'EST003', 'EST004', 'EST005');
        ALTER SEQUENCE IF EXISTS seq_personas_id RESTART WITH 1;
        ALTER SEQUENCE IF EXISTS seq_contactos_id RESTART WITH 1;
        ALTER SEQUENCE IF EXISTS seq_educacion_id RESTART WITH 1;
        ALTER SEQUENCE IF EXISTS seq_rel_principal_id RESTART WITH 1;
        ALTER SEQUENCE IF EXISTS seq_prov_cedula RESTART WITH 1;
        ALTER SEQUENCE IF EXISTS seq_estados_id RESTART WITH 6;
      `);
      await recordMigration(client, '30_clean_servidores_publicos', 'Limpieza completa de datos de prueba de servidores publicos');
      results.migrationsRecorded.push('30_clean_servidores_publicos');
      console.log('✅ [Migración 30] Servidores públicos limpiados y secuencias reiniciadas a estado cero.');
    }
  }

  // 10. Migración 31: Presupuesto inicial en paquetes_viaticos
  if (await tableExists(client, 'paquetes_viaticos')) {
    await client.query(`
      ALTER TABLE paquetes_viaticos ADD COLUMN IF NOT EXISTS presupuesto_inicial NUMERIC(15,2) DEFAULT NULL;
    `);
    if (!(await isMigrationRecorded(client, '31_paquetes_viaticos_presupuesto_inicial'))) {
      await recordMigration(client, '31_paquetes_viaticos_presupuesto_inicial', 'Columna presupuesto_inicial en paquetes_viaticos');
      results.migrationsRecorded.push('31_paquetes_viaticos_presupuesto_inicial');
      console.log('✅ [Migración 31] Columna presupuesto_inicial asegurada en paquetes_viaticos.');
    }
  }

  console.log('✅ Migraciones aditivas verificadas sin alterar ni eliminar datos existentes.');
  return results;
}

/**
 * Inicialización segura de la base de datos.
 * Si ya existen tablas en el esquema public, JAMÁS ejecuta 01_schema.sql ni semillas destructivas.
 */
async function initDatabase(options = {}) {
  const { migrateOnly = false, forceWipeConfirmed = false } = options;
  const useDirect = Boolean(process.env.DIRECT_URL && options.cliMode);
  const targetPool = useDirect ? new Pool(buildPoolConfig(true)) : pool;
  const client = await targetPool.connect();

  try {
    const existingTables = await getExistingTables(client);

    // Protección absoluta: si ya existen tablas institucionales, bloquear reinicialización
    if (existingTables.length > 0) {
      if (forceWipeConfirmed) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('BLOQUEADO POR SEGURIDAD: Está prohibido reinicializar o borrar tablas cuando NODE_ENV=production.');
        }
        console.warn('[Talento 360 DB Init] Reinicialización forzada autorizada explícitamente fuera de producción...');
      } else {
        console.log(`[Talento 360 DB Init] Esquema existente detectado (${existingTables.length} tablas). Omitiendo scripts destructivos y verificando solo migraciones aditivas.`);
        return await runSafeMigrations(client);
      }
    }

    if (migrateOnly) {
      throw new Error('La base de datos está vacía (0 tablas). Ejecute la restauración del respaldo oficial o el bootstrap inicial explícito antes de migrar.');
    }

    if (process.env.ALLOW_INITIAL_DB_BOOTSTRAP === 'false' || (!options.cliMode && process.env.ALLOW_INITIAL_DB_BOOTSTRAP !== 'true')) {
      console.log('[Talento 360 DB Init] Bootstrap inicial automático omitido (defina ALLOW_INITIAL_DB_BOOTSTRAP=true solo en primera instalación o restaure su respaldo en Neon).');
      return { skippedBootstrap: true };
    }

    const dbDir = findDatabaseDir();
    console.log(`[Talento 360 DB Init] Base de datos vacía detectada. Ejecutando bootstrap inicial desde ${dbDir}...`);
    await ensureMigrationsTable(client);

    for (let i = 0; i < SQL_FILES.length; i++) {
      const file = SQL_FILES[i];
      const filePath = path.join(dbDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`[!] Archivo no encontrado: ${file}, omitiendo.`);
        continue;
      }
      console.log(`[${i + 1}/${SQL_FILES.length}] Ejecutando ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      await recordMigration(client, file, 'Bootstrap inicial de base de datos vacía');
    }

    const hashedCount = await hashPlaintextPasswordsSafely(client);
    if (hashedCount > 0) {
      console.log(`[Talento 360 DB Init] ${hashedCount} contraseñas iniciales convertidas a bcrypt.`);
    }

    const migrationResult = await runSafeMigrations(client);
    console.log('✅ Base de datos inicializada de forma segura por primera vez.');
    return migrationResult;
  } finally {
    client.release();
    if (useDirect) {
      await targetPool.end();
    }
  }
}

async function printDbStatus() {
  const targetPool = new Pool(buildPoolConfig(Boolean(process.env.DIRECT_URL)));
  const client = await targetPool.connect();
  try {
    const tables = await getExistingTables(client);
    const coreTables = ['usuarios', 'personas', 'rel_principal', 'horarios', 'viaticos', 'vacaciones', 'solicitudes_admin'];
    const counts = {};
    for (const t of coreTables) {
      if (tables.includes(t)) {
        const res = await client.query(`SELECT COUNT(*)::int AS total FROM "${t}";`);
        counts[t] = res.rows[0].total;
      }
    }
    let migrations = [];
    if (tables.includes('schema_migrations')) {
      const migRes = await client.query('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at ASC;');
      migrations = migRes.rows;
    }
    console.log(JSON.stringify({ totalTables: tables.length, counts, appliedMigrations: migrations.length }, null, 2));
  } finally {
    client.release();
    await targetPool.end();
  }
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));

  if (args.has('--status')) {
    printDbStatus()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('❌ Error consultando estado de BD:', err.message);
        process.exit(1);
      });
  } else {
    const migrateOnly = args.has('--migrate-only');
    const forceWipeConfirmed = args.has('--force') && args.has('--confirm-wipe-all-data');

    initDatabase({ migrateOnly, forceWipeConfirmed, cliMode: true })
      .then(() => pool.end())
      .catch(err => {
        console.error('❌ Error en operación de base de datos:', err.message);
        pool.end().finally(() => process.exit(1));
      });
  }
}

module.exports = {
  pool,
  initDatabase,
  runMigrations: runSafeMigrations,
  runSafeMigrations,
};
