// ═══════════════════════════════════════════════════════════════════════════════
// init-db.js — Inicializador de Base de Datos para Talento 360 en Producción
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

const SQL_FILES = [
  '01_schema.sql',
  '02_seed_data.sql',
  '03_new_modules.sql',
  '04_horarios.sql',
  '05_divipola_and_hr_rules.sql',
  '06_hr_updates_experiencia_multiple.sql',
  '07_add_tiempo_total_gobernacion.sql',
  '08_full_divipola_update.sql',
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
      console.log('[Talento 360 DB Init] La base de datos ya contiene las tablas. Omitiendo inicialización.');
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

module.exports = { initDatabase };
