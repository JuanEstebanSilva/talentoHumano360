// ═══════════════════════════════════════════════════════════════════════════════
// init-db.js — Inicializador y Migrador de Base de Datos para Talento 360
// Gobernación de Boyacá · Soporte integral para Desarrollo y Producción (Render)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
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
    };

const pool = new Pool(poolConfig);

// Migraciones de gestión documental, informes e historial de cargas. Son idempotentes:
// se aplican al crear la base y en cada arranque, después de sincronizar roles y permisos.
const ADDITIONAL_MIGRATIONS = [
  '28_documentos.sql',
  '29_informes_automatizacion.sql',
  '30_importaciones.sql',
  '31_soportes_solicitudes.sql',
  '32_importaciones_resultado.sql',
];

// Scripts SQL maestros para inicialización desde cero
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
  ...ADDITIONAL_MIGRATIONS,
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

/**
 * Ejecuta migraciones idempotentes y limpieza de datos sintéticos
 * Se ejecuta SIEMPRE al arrancar el servidor en Render / Docker para garantizar esquema actualizado
 */
async function runMigrations(client, dbDir = null) {
  if (!dbDir) {
    try { dbDir = findDatabaseDir(); } catch (_) { }
  }
  console.log('[Talento 360 DB Migration] Verificando y aplicando migraciones automáticas...');
  const results = { columnsAdded: [], stressDataCleaned: {} };

  try {
    // 1. Columnas de encargo y trazabilidad en rel_principal
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

    // 2. Columnas en personas
    await client.query(`
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS documento_pendiente BOOLEAN DEFAULT false;
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS es_vacante BOOLEAN DEFAULT false;
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS departamento_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS ciudad_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS municipio_expedicion VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS tipo_discapacidad VARCHAR(120);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(10);
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_nacimiento VARCHAR(40);
    `);
    results.columnsAdded.push('personas: campos institucionales');

    // 3. Columnas en educacion y contactos
    await client.query(`
      ALTER TABLE educacion ADD COLUMN IF NOT EXISTS tiene_diplomado BOOLEAN DEFAULT false;
      ALTER TABLE educacion ADD COLUMN IF NOT EXISTS diplomado_cap_sena VARCHAR(255);
      ALTER TABLE contactos ADD COLUMN IF NOT EXISTS celulares JSONB DEFAULT '[]'::jsonb;
    `);
    results.columnsAdded.push('educacion y contactos: diplomado y celulares');

    // 4. Columnas en estados
    await client.query(`
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS estado_servidor VARCHAR(40) DEFAULT 'Activo';
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS funciones VARCHAR(200);
      ALTER TABLE estados ADD COLUMN IF NOT EXISTS funciones_pagadas VARCHAR(200);
    `);
    results.columnsAdded.push('estados: estado_servidor y funciones');

    // 5. Tabla paquetes_viaticos y columna id_paquete en viaticos
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
    results.columnsAdded.push('viaticos: paquetes_viaticos e id_paquete');

    // 6. Columnas en horarios
    await client.query(`
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS codigo VARCHAR(80);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS grado VARCHAR(80);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS secretaria VARCHAR(180);
      ALTER TABLE horarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(80);
    `);
    results.columnsAdded.push('horarios: campos adicionales');

    // 7. Modulos en usuarios y roles
    await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';`);

    if (dbDir) {
      const rolesSqlPath = path.join(dbDir, '15_user_roles_permissions.sql');
      if (fs.existsSync(rolesSqlPath)) {
        const rolesSql = fs.readFileSync(rolesSqlPath, 'utf8');
        await client.query(rolesSql);
        console.log('[Talento 360 DB Migration] Roles y permisos sincronizados correctamente.');
      }

      // Gestión documental, informes e historial de cargas (después de los roles: sus permisos se suman a los sincronizados).
      for (const file of ADDITIONAL_MIGRATIONS) {
        const sqlPath = path.join(dbDir, file);
        if (fs.existsSync(sqlPath)) await client.query(fs.readFileSync(sqlPath, 'utf8'));
      }
    }

    // 8. Limpieza de datos masivos sintéticos de stress test (para restaurar datos reales en producción)
    // 8.1. Limpiar horarios de prueba de carga (~2.061 registros sintéticos generados por 11_stress_test_data.sql)
    const delHor = await client.query(`
      DELETE FROM horarios 
      WHERE herramientas_tic = 'Equipo institucional de computo y conectividad VPN asegurada'
        AND observaciones = 'Esquema registrado y validado en planta de personal'
        AND numero_resolucion LIKE 'RES-%/2026';
    `);
    results.stressDataCleaned.horarios = delHor.rowCount || 0;
    if (delHor.rowCount > 0) {
      console.log(`[Talento 360 DB Migration] Limpiados ${delHor.rowCount} registros sintéticos de prueba de carga en horarios.`);
    }

    // 8.2. Limpiar viáticos de prueba de carga (~15.465 registros sintéticos generados por 11_stress_test_data.sql)
    const delViat = await client.query(`
      DELETE FROM viaticos 
      WHERE motivo IN (
        'Comision institucional de servicios y seguimiento tecnico',
        'Acompanamiento a mesas municipales de concertacion ciudadana',
        'Supervision y control de proyectos departamentales',
        'Inspeccion y verificacion de infraestructura publica',
        'Capacitacion institucional y asistencia administrativa'
      )
      AND observaciones IN (
        'Comision debidamente autorizada',
        'Conforme a agenda institucional',
        'Legalizacion en tramite',
        'Comision cumplida a satisfaccion',
        'SIN VIATICOS'
      )
      AND creado_en >= '2024-01-10';
    `);
    results.stressDataCleaned.viaticos = delViat.rowCount || 0;
    if (delViat.rowCount > 0) {
      console.log(`[Talento 360 DB Migration] Limpiados ${delViat.rowCount} registros sintéticos de prueba de carga en viáticos.`);
    }

    // 8.3. Limpiar usuarios y servidores sintéticos creados por el script de stress test
    await client.query(`
      DELETE FROM usuarios 
      WHERE password = 'Servidor2026*' 
        AND cargo_laboral = 'SERVIDOR PUBLICO DEPARTAMENTAL';

      WITH stress_regs AS (
        SELECT r.id_registro, r.id_persona, r.id_educacion, r.id_contacto, r.id_estado
        FROM rel_principal r
        JOIN educacion edu ON edu.id_educacion = r.id_educacion
        JOIN estados est ON est.id_estado = r.id_estado
        WHERE edu.diplomado_cap_sena = 'GESTION PUBLICA DEPARTAMENTAL'
          AND est.funciones_pagadas = 'CARGO BASE'
          AND est.novedades = 'SIN NOVEDAD REPORTADA'
          AND est.opec LIKE 'OPEC-20%'
          AND r.tiempo_servicio = r.tiempo_total_gobernacion
          AND r.tiempo_servicio LIKE '%anos, %meses'
      )
      DELETE FROM rel_principal WHERE id_registro IN (SELECT id_registro FROM stress_regs);

      -- 8.4. Limpiar entidades huérfanas creadas durante pruebas de carga
      DELETE FROM personas WHERE id_persona NOT IN (SELECT id_persona FROM rel_principal);
      DELETE FROM educacion WHERE id_educacion NOT IN (SELECT id_educacion FROM rel_principal);
      DELETE FROM contactos WHERE id_contacto NOT IN (SELECT id_contacto FROM rel_principal);
      DELETE FROM estados WHERE id_estado NOT IN (SELECT id_estado FROM rel_principal);
    `);

    console.log('✅ Migraciones e integridad de esquema completadas con éxito.');
    return results;
  } catch (err) {
    console.error('❌ Error ejecutando migraciones:', err.message);
    throw err;
  }
}

async function initDatabase(options = { force: false }) {
  const client = await pool.connect();
  try {
    const dbDir = findDatabaseDir();
    console.log(`[Talento 360 DB Init] Directorio de scripts SQL: ${dbDir}`);

    // Verificar si la tabla usuarios ya existe
    const checkTable = await client.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'usuarios'
      LIMIT 1;
    `);

    if (checkTable.rows.length > 0 && !options.force) {
      console.log('[Talento 360 DB Init] La base de datos ya contiene las tablas. Ejecutando migraciones y validaciones...');
      await runMigrations(client, dbDir);
      return;
    }

    console.log('[Talento 360 DB Init] Inicializando esquemas y datos iniciales...');
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
      console.log(`  -> ${file} completado con éxito.`);
    }

    // Ejecutar migraciones adicionales para asegurar columnas
    await runMigrations(client, dbDir);

    console.log('✅ Base de datos de Talento 360 inicializada correctamente.');
  } catch (err) {
    console.error('❌ Error inicializando base de datos:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initDatabase({ force: process.argv.includes('--force') })
    .then(() => pool.end())
    .catch(() => {
      pool.end();
      process.exit(1);
    });
}

module.exports = { pool, initDatabase, runMigrations };
