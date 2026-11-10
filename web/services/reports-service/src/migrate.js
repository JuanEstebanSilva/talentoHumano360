// Aplica al arrancar las migraciones de Gestión Documental, Informes e historial de cargas.
// PostgreSQL solo ejecuta database/*.sql cuando la base está vacía; en una instalación con
// datos estas tablas no existirían. Todas las migraciones se pueden repetir sin dañar datos.
const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  '28_documentos.sql',
  '29_informes_automatizacion.sql',
  '30_importaciones.sql',
  '31_soportes_solicitudes.sql',
  '32_importaciones_resultado.sql',
];
const LOCK_ID = 360028; // Evita que dos instancias las apliquen a la vez.

async function runMigrations(pool, dir = process.env.MIGRATIONS_DIR || path.join(__dirname, '../database')) {
  if (!fs.existsSync(dir)) {
    console.warn(`[reports-service] No se encontró ${dir}; no se aplicaron migraciones.`);
    return [];
  }
  const applied = [];
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    for (const file of MIGRATIONS) {
      const full = path.join(dir, file);
      if (!fs.existsSync(full)) throw new Error(`Falta la migración ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(full, 'utf8'));
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${file}: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
  return applied;
}

module.exports = { runMigrations, MIGRATIONS };
