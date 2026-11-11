const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'talento360',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123'
});

async function resetPasswords() {
  const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || process.argv[2];
  if (!adminPass) {
    console.error('Error: Se requiere definir ADMIN_DEFAULT_PASSWORD o pasar la contraseña como argumento por CLI.');
    process.exit(1);
  }

  const hashAdmin = await bcrypt.hash(adminPass, 10);

  // 1. Alejo Leo (Administrador)
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL,
         estado = 'ACTIVO'
     WHERE LOWER(username) = $2`,
    [hashAdmin, 'alejoleo2022@gmail.com']
  );
  console.log('✅ Credencial de alejoleo2022@gmail.com actualizada a hash bcrypt seguro.');

  // 2. Admin general
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL,
         estado = 'ACTIVO'
     WHERE LOWER(username) = $2`,
    [hashAdmin, 'admin']
  );
  console.log('✅ Credencial de admin actualizada a hash bcrypt seguro.');

  const res = await pool.query(
    `SELECT id_usuario, username, nombre, rol, estado, debe_cambiar_password 
     FROM usuarios 
     WHERE username IN ('alejoleo2022@gmail.com', 'admin')`
  );
  
  for (const u of res.rows) {
    console.log(`User: ${u.username} | Estado: ${u.estado} | debe_cambiar: ${u.debe_cambiar_password}`);
  }

  await pool.end();
}

resetPasswords().catch(e => {
  console.error('Error resetting passwords:', e);
  process.exit(1);
});
