const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5434,
  database: process.env.DB_NAME || 'talento360',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123'
});

function validateComplexity(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'La contraseña debe contener al menos 8 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra mayúscula.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra minúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un dígito numérico.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un carácter especial (!@#$%^&* etc.).' };
  }
  return { valid: true };
}

function promptPasswordSecurely(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Silenciar la entrada por terminal para no dejar eco de contraseña en pantalla
    const stdin = process.stdin;
    process.stdout.write(promptText);

    let password = '';
    const onData = (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\b':
          password = password.slice(0, -1);
          break;
        default:
          password += char;
          break;
      }
    };

    stdin.on('data', onData);

    rl.question('', () => {
      rl.close();
      console.log('');
      resolve(password.trim());
    });
  });
}

async function getAdminPassword() {
  let password = process.env.ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD;
  if (password) {
    return password.trim();
  }

  // Si no viene en variable de entorno, solicitarla interactivamente
  if (process.stdin.isTTY) {
    password = await promptPasswordSecurely('Ingrese la nueva contraseña administrativa (entrada protegida sin eco): ');
    return password;
  }

  throw new Error('Error de seguridad: No se definió variable de entorno ADMIN_PASSWORD y no se encuentra en sesión TTY interactiva. No se aceptan argumentos por línea de comandos para proteger el historial de procesos.');
}

async function resetPasswords() {
  const adminPass = await getAdminPassword();
  
  const comp = validateComplexity(adminPass);
  if (!comp.valid) {
    console.error(`[SEGURIDAD] Rechazado: ${comp.error}`);
    process.exit(1);
  }

  const hashAdmin = await bcrypt.hash(adminPass, 10);

  // 1. Alejo Leo (Administrador institucional definitivo)
  await pool.query(
    `UPDATE usuarios 
     SET password = $1, 
         debe_cambiar_password = false, 
         password_reset_expires = NULL,
         estado = 'ACTIVO'
     WHERE LOWER(username) = $2`,
    [hashAdmin, 'alejoleo2022@gmail.com']
  );
  console.log('✅ Credencial de alejoleo2022@gmail.com actualizada criptográficamente vía hash bcrypt.');

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
  console.log('✅ Credencial de admin actualizada criptográficamente vía hash bcrypt.');

  const res = await pool.query(
    `SELECT id_usuario, username, nombre, rol, estado, debe_cambiar_password 
     FROM usuarios 
     WHERE username IN ('alejoleo2022@gmail.com', 'admin')`
  );
  
  for (const u of res.rows) {
    console.log(`[USUARIO VERIFICADO] ${u.username} | Rol: ${u.rol} | Estado: ${u.estado} | Hash: [PROTEGIDO]`);
  }

  await pool.end();
}

resetPasswords().catch(e => {
  console.error('Error durante la rotación administrativa:', e.message);
  process.exit(1);
});
