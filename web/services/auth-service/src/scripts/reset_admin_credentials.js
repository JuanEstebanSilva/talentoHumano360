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
  const hashAlejo = await bcrypt.hash('@Alejo123', 10);
  const hashSilva = await bcrypt.hash('admin123', 10);
  const hashAdmin = await bcrypt.hash('admin123', 10);

  // 1. Alejo Leo (Administrador)
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL,
         estado = 'ACTIVO'
     WHERE LOWER(username) = $2`,
    [hashAlejo, 'alejoleo2022@gmail.com']
  );
  console.log('✅ Updated alejoleo2022@gmail.com -> @Alejo123');

  // 2. Juan Esteban Silva (Gestor de Respaldo y Horarios)
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL, 
         estado = 'ACTIVO', 
         modulos = 'admin-backups,horarios', 
         permisos = 'admin-backups:read,admin-backups:write,admin-backups:download,admin-backups:delete,horarios:read,horarios:write,horarios:delete' 
     WHERE LOWER(username) = $2`,
    [hashSilva, 'silvaespejojuanesteban@gmail.com']
  );
  console.log('✅ Updated silvaespejojuanesteban@gmail.com -> admin123');

  // 3. Admin general
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL,
         estado = 'ACTIVO'
     WHERE LOWER(username) = $2`,
    [hashAdmin, 'admin']
  );
  console.log('✅ Updated admin -> admin123');

  const res = await pool.query(
    `SELECT id_usuario, username, nombre, rol, estado, debe_cambiar_password, password 
     FROM usuarios 
     WHERE username IN ('alejoleo2022@gmail.com', 'silvaespejojuanesteban@gmail.com', 'admin')`
  );
  
  for (const u of res.rows) {
    const isAlejoMatch = await bcrypt.compare('@Alejo123', u.password);
    const isAdmin123Match = await bcrypt.compare('admin123', u.password);
    console.log(`User: ${u.username} | debe_cambiar: ${u.debe_cambiar_password} | matches @Alejo123: ${isAlejoMatch} | matches admin123: ${isAdmin123Match}`);
  }

  await pool.end();
}

resetPasswords().catch(e => {
  console.error('Error resetting passwords:', e);
  process.exit(1);
});
