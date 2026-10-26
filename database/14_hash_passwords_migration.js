// database/14_hash_passwords_migration.js
// Migración criptográfica segura e idempotente para hashear contraseñas en texto plano en la tabla 'usuarios'
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = 12;

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
        password: process.env.DB_PASSWORD || '',
      }
);

async function migratePasswords() {
  const client = await pool.connect();
  try {
    console.log('[MIGRACION] Iniciando verificación de seguridad de contraseñas en tabla usuarios...');
    await client.query('BEGIN');

    const res = await client.query('SELECT id_usuario, username, password FROM usuarios FOR UPDATE');
    let migratedCount = 0;
    let alreadyHashedCount = 0;

    for (const user of res.rows) {
      const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
      if (isBcrypt) {
        alreadyHashedCount++;
      } else {
        const plainPass = user.password.trim();
        const secureHash = await bcrypt.hash(plainPass, BCRYPT_SALT_ROUNDS);
        await client.query(
          'UPDATE usuarios SET password = $1 WHERE id_usuario = $2',
          [secureHash, user.id_usuario]
        );
        migratedCount++;
        console.log(`  -> Usuario ID ${user.id_usuario} (${user.username}): Contraseña en texto plano convertida a hash bcrypt con coste ${BCRYPT_SALT_ROUNDS}.`);
      }
    }

    await client.query('COMMIT');
    console.log(`[MIGRACION COMPLETADA] Usuarios ya asegurados: ${alreadyHashedCount} | Usuarios migrados exitosamente: ${migratedCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[MIGRACION ERROR] Error durante la migración, cambios revertidos:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migratePasswords().then(() => {
  console.log('[MIGRACION] Proceso finalizado.');
  process.exit(0);
});
