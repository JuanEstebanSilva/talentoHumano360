// database/15_seed_roles_and_users.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || 'db',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'talento360',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'admin123',
      }
);

async function main() {
  const client = await pool.connect();
  try {
    console.log('[MIGRACION] Añadiendo columna modulos si no existe...');
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*';
    `);

    const users = [
      {
        username: 'admin',
        pass: 'admin',
        nombre: 'Administrador',
        rol: 'Administrador',
        cargo: 'Administrador del Sistema',
        modulos: '*'
      },
      {
        username: 'angela.ussa@boyaca.gov.co',
        pass: '@Angela123',
        nombre: 'Angela Ussa',
        rol: 'Usuario',
        cargo: 'Gestión de Servidores Públicos',
        modulos: 'dashboard,employees,viaticos,horarios'
      },
      {
        username: 'bergenet.gutierrez@boyaca.gov.co',
        pass: '@Bergenet123',
        nombre: 'Bergenet Gutiérrez',
        rol: 'Usuario',
        cargo: 'Gestión de Viáticos',
        modulos: 'dashboard,employees,viaticos,horarios'
      },
      {
        username: 'doris.canon@boyaca.gov.co',
        pass: '@Doris123',
        nombre: 'Doris Canon',
        rol: 'Usuario',
        cargo: 'Gestión de Horarios y Modalidades',
        modulos: 'dashboard,employees,viaticos,horarios'
      }
    ];

    console.log('[MIGRACION] Creando/actualizando usuarios definidos...');
    for (const u of users) {
      const hash = await bcrypt.hash(u.pass, 10);
      // Eliminar variantes previas si existen
      if (u.username === 'admin') {
        await client.query("DELETE FROM usuarios WHERE LOWER(username) IN ('admin', 'admin@boyaca.gov.co')");
      } else {
        await client.query("DELETE FROM usuarios WHERE LOWER(username) = LOWER('" + u.username + "')");
      }

      await client.query(
        "INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado, modulos) VALUES ($1, $2, $3, $4, $5, 'ACTIVO', $6)",
        [u.username, hash, u.nombre, u.rol, u.cargo, u.modulos]
      );

      console.log(`  -> Usuario listo: ${u.username} (${u.nombre}) | Módulos: ${u.modulos}`);
    }

    const res = await client.query('SELECT id_usuario, username, nombre, rol, cargo_laboral, modulos FROM usuarios ORDER BY id_usuario');
    console.log('\n[MIGRACION COMPLETADA] Usuarios actuales en base de datos:');
    console.table(res.rows);
  } catch (err) {
    console.error('[MIGRACION ERROR]:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
