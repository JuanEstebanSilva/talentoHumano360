const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  console.warn('[auth] nodemailer no disponible al cargar módulo:', err.message);
}
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

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
        password: process.env.DB_PASSWORD || 'admin123',
        ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

// Asegurar que las columnas para permisos, recuperación de contraseña y cambio obligatorio existan
async function initDb() {
  try {
    await pool.query(`
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
  } catch (err) {
    console.warn('[auth] Verificación de columnas de esquema:', err.message);
  }
}
initDb();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

function formatLockoutTime(seconds) {
  if (seconds < 60) {
    return `${seconds} segundo${seconds === 1 ? '' : 's'}`;
  }
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (sec === 0) {
    return `${min} minuto${min === 1 ? '' : 's'}`;
  }
  return `${min} min y ${sec} s`;
}

async function getLockoutState(identifier) {
  try {
    const res = await pool.query(
      `SELECT failed_attempts, lockout_tier, locked_until 
       FROM auth_failed_logins 
       WHERE identifier = $1 LIMIT 1`,
      [identifier]
    );
    if (res.rows.length === 0) {
      return { isLocked: false, failedAttempts: 0, lockoutTier: 0, remainingAttempts: 5, remainingSeconds: 0 };
    }
    const row = res.rows[0];
    const now = Date.now();
    const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
    if (lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      return {
        isLocked: true,
        failedAttempts: row.failed_attempts,
        lockoutTier: row.lockout_tier,
        remainingAttempts: 0,
        remainingSeconds
      };
    }
    return {
      isLocked: false,
      failedAttempts: row.failed_attempts,
      lockoutTier: row.lockout_tier,
      remainingAttempts: Math.max(0, 5 - row.failed_attempts),
      remainingSeconds: 0
    };
  } catch (err) {
    console.warn('[auth] Error al consultar estado de bloqueo:', err.message);
    return { isLocked: false, failedAttempts: 0, lockoutTier: 0, remainingAttempts: 5, remainingSeconds: 0 };
  }
}

async function recordFailedAttempt(identifier) {
  try {
    const current = await getLockoutState(identifier);
    const now = new Date();
    
    let newAttempts = current.failedAttempts + 1;
    let newTier = current.lockoutTier;
    let lockedUntil = null;
    let isLocked = false;
    let lockoutMinutes = 0;
    let lockoutSeconds = 0;

    if (newAttempts >= 5) {
      // Progresión de bloqueo solicitada:
      // A los 5 fallos (6to intento bloqueado) -> 1 minuto
      // Si vuelve a fallar tras el 1er bloqueo -> 2 minutos
      // Siguientes bloqueos progresan a 3 min y tope máximo de 4 minutos
      newTier = Math.min(newTier + 1, 4);
      lockoutMinutes = newTier; // 1, 2, 3 o 4 minutos
      lockoutSeconds = lockoutMinutes * 60;
      lockedUntil = new Date(Date.now() + lockoutSeconds * 1000);
      isLocked = true;
    }

    await pool.query(
      `INSERT INTO auth_failed_logins (identifier, failed_attempts, lockout_tier, locked_until, last_attempt)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (identifier) DO UPDATE
       SET failed_attempts = $2, lockout_tier = $3, locked_until = $4, last_attempt = $5`,
      [identifier, newAttempts, newTier, lockedUntil, now]
    );

    return {
      isLocked,
      failedAttempts: newAttempts,
      remainingAttempts: Math.max(0, 5 - newAttempts),
      lockoutTier: newTier,
      lockoutMinutes,
      retryAfterSeconds: lockoutSeconds
    };
  } catch (err) {
    console.error('[auth] Error al registrar intento fallido:', err.message);
    return { isLocked: false, failedAttempts: 1, remainingAttempts: 4, lockoutTier: 0, retryAfterSeconds: 0 };
  }
}

async function clearLockout(identifier) {
  try {
    await pool.query(`DELETE FROM auth_failed_logins WHERE identifier = $1`, [identifier]);
  } catch (err) {
    console.warn('[auth] Error al limpiar intentos fallidos:', err.message);
  }
}

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const isDefaultOrInsecure = !secret || secret.trim() === '' || secret.includes('talento360_secret_2026');

  if (isProd) {
    if (isDefaultOrInsecure) {
      console.error('[FATAL CIBERSEGURIDAD] En entorno de producción (NODE_ENV=production), la variable JWT_SECRET es obligatoria y no puede usar el secreto predeterminado o predecible (AUD-011).');
      process.exit(1);
    }
    return secret;
  }

  if (isDefaultOrInsecure) {
    console.warn('[AVISO DE SEGURIDAD] JWT_SECRET no configurado o usando valor por defecto en desarrollo. En producción el servicio fallará explícitamente.');
    return secret || 'talento360_secret_2026';
  }

  return secret;
}

const JWT_SECRET     = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_SALT_ROUNDS = 12;

// Hash precomputado para mitigar ataques de temporización (timing attacks) cuando el usuario no existe
const DUMMY_HASH = '$2a$12$V/AEZH3sAI.ZPJZdnCj3Ue8TU5P/6ekQdo9whQRwfR9H9RyLSjXDm';

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Máximo 1000 intentos de login cada 15 minutos por IP (con omisión de peticiones exitosas)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Por seguridad institucional, espere 15 minutos.' }
});

// Máximo 20 intentos de actualización de perfil cada 15 minutos
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de modificaciones de perfil alcanzado. Intente de nuevo más tarde.' }
});

// Máximo 10 intentos de recuperación de contraseña cada 15 minutos por IP
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación. Por seguridad, intente nuevamente en 15 minutos.' }
});

// ─── Utilidades de Correo y Generación Segura de Contraseña ───────────────────
function generateSecureTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;

  const pick = (charset) => {
    const bytes = crypto.randomBytes(4);
    const rand = bytes.readUInt32BE(0);
    return charset[rand % charset.length];
  };

  const chars = [
    pick(upper), pick(upper),
    pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(symbols), pick(symbols),
    pick(all), pick(all), pick(all), pick(all)
  ];

  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = crypto.randomBytes(4);
    const j = bytes.readUInt32BE(0) % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

function getMailTransporter() {
  if (!nodemailer) {
    throw new Error('Dependencia nodemailer no instalada en el entorno del servidor.');
  }
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: (user && pass) ? {
      user: user,
      pass: pass
    } : undefined,
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
  });
}

function buildRecoveryPlainText(nombre, tempPassword) {
  const nombreDisplay = nombre && nombre.trim() ? nombre.trim() : 'Funcionario';
  return `=====================================================
TALENTO 360 — GOBERNACIÓN DE BOYACÁ
Sistema Integral de Gestión de Talento Humano
=====================================================

Recuperación de Contraseña Institucional

Hola, ${nombreDisplay}:

Recibe un cordial saludo de parte del equipo institucional de Talento 360, plataforma oficial de gestión de talento humano de la Gobernación de Boyacá.

Hemos recibido una solicitud para recuperar el acceso a tu cuenta oficial.

Tu contraseña provisional de acceso es:
-----------------------------------------------------
${tempPassword}
-----------------------------------------------------

⏱ VIGENCIA LIMITADA: 24 horas a partir de este momento.

IMPORTANTE (Paso Obligatorio): Por motivos estrictos de ciberseguridad institucional, deberás cambiar esta contraseña provisional inmediatamente después de iniciar sesión. El sistema te solicitará definir tu nueva contraseña personal antes de habilitar el acceso a los módulos operativos de la plataforma.

Si tú no solicitaste este restablecimiento, desestima este mensaje; tu cuenta permanecerá resguardada. Si sospechas de alguna anomalía, comunícate de inmediato con el Administrador de Plataforma o la Dirección de Talento Humano.

Atentamente,

Equipo de Gestión y Soporte
Talento 360 — Gobernación de Boyacá
Dirección de Talento Humano
Palacio de la Torre — Plaza de Bolívar, Tunja, Boyacá`;
}

function buildRecoveryHtml(nombre, tempPassword, appUrl = 'http://localhost') {
  const nombreDisplay = nombre && nombre.trim() ? nombre.trim() : 'Funcionario';
  const loginUrl = appUrl && appUrl.startsWith('http') ? appUrl : 'http://localhost';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña — Talento 360</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,0.10);border:1.5px solid #e2e8f0;">
          
          <!-- Top Multi-Color Accent Stripe -->
          <tr>
            <td height="5" style="background:linear-gradient(90deg, #28871B 0%, #0d5233 28%, #D1AD2A 62%, #D14600 100%);line-height:5px;font-size:5px;">&nbsp;</td>
          </tr>

          <!-- Header Section with Official Branding -->
          <tr>
            <td style="background:#092e1f;background:radial-gradient(circle at 50% 0%, rgba(209, 173, 42, 0.22) 0%, transparent 70%), linear-gradient(145deg, #062316 0%, #0f4a33 55%, #08291c 100%);padding:36px 24px 30px;text-align:center;border-bottom:2px solid rgba(209, 173, 42, 0.45);">
              
              <!-- Official Coat of Arms / Cóndor (Limpio, SIN círculo blanco ni fondo artificial) -->
              <div style="text-align:center;margin:0 auto 12px;">
                <img src="cid:logoCondor" alt="Escudo Gobernación de Boyacá" width="68" height="68" style="display:inline-block;margin:0 auto;width:68px;height:68px;max-width:68px;border:0;outline:none;" />
              </div>

              <!-- Institutional Subtitle (Limpio, SIN fondo innecesario ni bordes) -->
              <div style="margin-bottom:8px;text-align:center;">
                <span style="font-size:12px;font-weight:800;letter-spacing:2px;color:#FDE047;text-transform:uppercase;">GOBERNACIÓN DE BOYACÁ</span>
              </div>

              <!-- Application Wordmark -->
              <div style="font-size:30px;font-weight:900;letter-spacing:-0.5px;line-height:1.15;margin:0;text-align:center;">
                <span style="color:#ffffff;">Talento</span><span style="color:#D1AD2A;"> 360</span>
              </div>
              <div style="margin-top:6px;color:#cbd5e1;font-size:12.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-align:center;">
                Sistema Integral de Gestión de Talento Humano
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 36px 28px;">
              
              <!-- Category Label (Limpio, SIN fondo gris ni marco) -->
              <div style="margin-bottom:14px;">
                <span style="font-size:11.5px;font-weight:800;letter-spacing:1.5px;color:#738993;text-transform:uppercase;">Seguridad &bull; Restablecimiento de Acceso</span>
              </div>

              <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
                Recuperación de Contraseña
              </h2>

              <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.6;">
                Hola, <strong style="color:#0f172a;">${nombreDisplay}</strong>:
              </p>

              <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.6;">
                Recibe un cordial saludo de parte del equipo institucional de <strong>Talento 360</strong>. Hemos recibido una solicitud formal para recuperar y reanudar el acceso a tu cuenta en la plataforma.
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
                Tu contraseña provisional de acceso de un solo uso es:
              </p>

              <!-- Provisional Password Container -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 26px;background:#f8fafc;border:1.5px solid #738993;border-radius:14px;box-shadow:0 4px 16px rgba(15,23,42,0.04);">
                <tr>
                  <td style="padding:26px 20px;text-align:center;">
                    <div style="font-size:11.5px;font-weight:800;color:#738993;text-transform:uppercase;letter-spacing:1.8px;margin-bottom:12px;">
                      TU CONTRASEÑA PROVISIONAL
                    </div>
                    
                    <!-- Credential Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td style="background:#093323;background:linear-gradient(135deg,#07261a 0%,#0f4a34 50%,#093323 100%);border:2px solid #D1AD2A;border-radius:12px;padding:14px 28px;box-shadow:0 6px 18px rgba(9,51,35,0.35);text-align:center;">
                          <span style="font-family:'Consolas','Courier New',Courier,monospace;font-size:26px;font-weight:900;letter-spacing:4px;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.5);display:inline-block;">
                            ${tempPassword}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Timer Note (Limpio, SIN fondo ni marco) -->
                    <div style="margin-top:14px;text-align:center;">
                      <span style="font-size:13px;color:#D14600;font-weight:700;letter-spacing:0.2px;">
                        &#9201; Vigencia limitada: 24 horas a partir de este momento
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button: Iniciar Sesión -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                      <tr>
                        <td style="background:#0d5233;background:linear-gradient(135deg,#0d5233 0%,#15803d 100%);border-radius:50px;box-shadow:0 4px 14px rgba(13,82,51,0.35);text-align:center;">
                          <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:13px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.3px;color:#ffffff;text-decoration:none;border-radius:50px;">
                            Iniciar Sesión en Talento 360 &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Advisory Box: Cambio obligatorio de contraseña -->
              <div style="background:#fffbeb;border:1.5px solid #d97706;border-left:5px solid #d97706;padding:16px 18px;border-radius:10px;margin:22px 0 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:top;width:24px;padding-right:12px;">
                      <span style="font-size:20px;line-height:1;">&#128274;</span>
                    </td>
                    <td style="vertical-align:top;font-size:13.5px;color:#78350f;line-height:1.55;">
                      <strong style="color:#92400e;">Cambio obligatorio al iniciar sesión:</strong> Por motivos de ciberseguridad institucional, deberás cambiar esta clave provisional <strong>inmediatamente después de iniciar sesión</strong>. El sistema te solicitará definir tu nueva clave personal antes de habilitar el acceso a los módulos operativos.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Safety Disclaimer -->
              <p style="margin:22px 0 0;font-size:12.5px;color:#738993;line-height:1.55;">
                &#128737;&#65039; Si no realizaste esta solicitud de restablecimiento, puedes desestimar este mensaje; tu cuenta permanecerá resguardada. Si consideras que se trata de un intento no autorizado, comunícate de inmediato con el Administrador de la plataforma o la Dirección de Talento Humano.
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background:#f8fafc;padding:26px 32px;border-top:1.5px solid #e2e8f0;text-align:center;">
              <div style="font-size:13px;font-weight:800;color:#0f172a;letter-spacing:0.2px;">
                Equipo de Gestión y Soporte &bull; Talento 360
              </div>
              <div style="margin-top:4px;font-size:12px;color:#738993;">
                Dirección de Talento Humano &middot; Gobernación de Boyacá
              </div>
              <div style="margin-top:2px;font-size:11.5px;color:#94a3b8;">
                Palacio de la Torre &middot; Plaza de Bolívar, Tunja &middot; Boyacá, Colombia
              </div>
              <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.4;">
                Este es un mensaje institucional generado automáticamente por el sistema de autenticación de Talento 360. Por favor no respondas directamente a esta dirección de correo.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Extrae el token desde cabecera Authorization: Bearer o Cookie HttpOnly
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Configura la cookie HttpOnly en la respuesta de forma segura
function setAuthCookie(res, token) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE || 'Lax';
  res.cookie('talento360_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSite,
    maxAge: 8 * 60 * 60 * 1000, // 8 horas en milisegundos
    path: '/'
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Por favor ingresa usuario y contraseña.' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  let lookupUser = normalizedUser;
  if (lookupUser === 'alejandro.leon@boyaca.edu.co' || lookupUser === 'alejandro.leon@boyaca.gov.co' || lookupUser === 'alejandro.leon') {
    lookupUser = 'alejoleo2022@gmail.com';
  }

  const userKey = 'user:' + lookupUser;

  try {
    // 0. Comprobar bloqueo progresivo de seguridad de la cuenta antes de cualquier otra operación
    const userLock = await getLockoutState(userKey);

    if (userLock.isLocked) {
      return res.status(429).json({
        error: `Acceso bloqueado temporalmente por demasiados intentos fallidos. Por favor espere ${formatLockoutTime(userLock.remainingSeconds)} o utilice la opción '¿Olvidaste tu contraseña?'.`,
        isLocked: true,
        retryAfterSeconds: userLock.remainingSeconds,
        lockoutTier: userLock.lockoutTier,
        suggestRecovery: true
      });
    }

    // 1. Buscar si el usuario existe en la base de datos por email o prefijo
    let userResult;
    try {
      userResult = await pool.query(
        `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password, password_reset_expires
         FROM usuarios
         WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
         LIMIT 1`,
        [lookupUser]
      );
    } catch (colErr) {
      if (colErr.message && (colErr.message.includes('modulos') || colErr.message.includes('permisos') || colErr.message.includes('debe_cambiar_password') || colErr.message.includes('password_reset_expires'))) {
        console.warn('[auth] Columnas de autenticación o recuperación pendientes, ejecutando migración segura...');
        try {
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos VARCHAR(255) DEFAULT '*'`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE`);
          await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL`);
          userResult = await pool.query(
            `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password, password_reset_expires
             FROM usuarios
             WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
             LIMIT 1`,
            [lookupUser]
          );
        } catch (migErr) {
          userResult = await pool.query(
            `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado
             FROM usuarios
             WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
             LIMIT 1`,
            [lookupUser]
          );
        }
      } else {
        throw colErr;
      }
    }

    // Mitigación de enumeración de usuarios y registro de intentos fallidos
    if (userResult.rows.length === 0) {
      await bcrypt.compare(normalizedPass, DUMMY_HASH);
      const act = await recordFailedAttempt(userKey);
      if (act.isLocked) {
        return res.status(429).json({
          error: `Ha superado los 5 intentos permitidos. Por seguridad institucional, su acceso ha sido bloqueado por ${formatLockoutTime(act.retryAfterSeconds)}. Si olvidó su contraseña, recupérela haciendo clic en '¿Olvidaste tu contraseña?'.`,
          isLocked: true,
          retryAfterSeconds: act.retryAfterSeconds,
          lockoutTier: act.lockoutTier,
          suggestRecovery: true
        });
      }
      return res.status(401).json({
        error: `Credenciales inválidas. Le quedan ${act.remainingAttempts} intento${act.remainingAttempts === 1 ? '' : 's'} antes del bloqueo temporal del acceso.`,
        isLocked: false,
        failedAttempts: act.failedAttempts,
        remainingAttempts: act.remainingAttempts,
        suggestRecovery: act.remainingAttempts <= 2
      });
    }

    const user = userResult.rows[0];

    // Verificar si la cuenta está activa
    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte a la Dirección de Talento Humano.' });
    }

    // 2. Verificación criptográfica segura con bcrypt
    let passwordMatches = false;
    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

    if (isBcrypt) {
      passwordMatches = await bcrypt.compare(normalizedPass, user.password);
    } else {
      // Migración transparente y segura de contraseñas heredadas en texto plano
      if (user.password === normalizedPass) {
        passwordMatches = true;
        try {
          const upgradedHash = await bcrypt.hash(normalizedPass, BCRYPT_SALT_ROUNDS);
          await pool.query('UPDATE usuarios SET password = $1 WHERE id_usuario = $2', [upgradedHash, user.id_usuario]);
          console.log(`[auth] Contraseña de usuario id=${user.id_usuario} migrada exitosamente a bcrypt.`);
        } catch (migErr) {
          console.error('[auth] Error en migración automática de hash:', migErr.message);
        }
      } else {
        // En caso de fallo con texto plano, simular hash para igualar tiempo
        await bcrypt.compare(normalizedPass, DUMMY_HASH);
      }
    }

    if (!passwordMatches) {
      const act = await recordFailedAttempt(userKey);
      if (act.isLocked) {
        return res.status(429).json({
          error: `Ha superado los 5 intentos permitidos. Por seguridad institucional, su acceso ha sido bloqueado por ${formatLockoutTime(act.retryAfterSeconds)}. Si olvidó su contraseña, recupérela haciendo clic en '¿Olvidaste tu contraseña?'.`,
          isLocked: true,
          retryAfterSeconds: act.retryAfterSeconds,
          lockoutTier: act.lockoutTier,
          suggestRecovery: true
        });
      }
      return res.status(401).json({
        error: `Credenciales inválidas. Le quedan ${act.remainingAttempts} intento${act.remainingAttempts === 1 ? '' : 's'} antes del bloqueo temporal del acceso.`,
        isLocked: false,
        failedAttempts: act.failedAttempts,
        remainingAttempts: act.remainingAttempts,
        suggestRecovery: act.remainingAttempts <= 2
      });
    }

    // Login exitoso: Limpiar intentos fallidos y bloqueos
    await clearLockout(userKey);

    // Verificar si la contraseña provisional ha vencido
    if (user.debe_cambiar_password) {
      if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
        return res.status(401).json({
          error: 'Su contraseña provisional ha expirado. Por favor solicite una nueva recuperación de contraseña.',
          expiredProvisional: true
        });
      }
    }

    let allowedModules = ['dashboard'];
    const rLower = (user.rol || '').toLowerCase();
    if (rLower === 'administrador' || rLower === 'admin') {
      allowedModules = ['*'];
    } else if (rLower === 'sst' || rLower.includes('sst')) {
      allowedModules = ['sst', 'epidemiologico', 'sociodemografico', 'epp'];
    } else if (rLower === 'incapacidades' || rLower.includes('incapacidad')) {
      allowedModules = ['admin-requests', 'incapacidades'];
    } else if (rLower.includes('permiso') && rLower.includes('licencia')) {
      allowedModules = ['admin-requests', 'permisos', 'licencias'];
    } else if (rLower === 'permisos' || rLower.includes('permiso')) {
      allowedModules = ['admin-requests', 'permisos'];
    } else if (user.modulos) {
      allowedModules = user.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    }

    const permissions = resolvePermissions(user.rol, allowedModules, user.permisos);

    const payload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
      modules:  allowedModules,
      permissions: permissions,
      mustChangePassword: !!user.debe_cambiar_password
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Enviar cookie HttpOnly para navegadores y token en JSON para APIs
    setAuthCookie(res, token);
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    return res.status(500).json({ 
      error: 'Error interno del servidor. Verifique la conexión a la base de datos.',
      details: err.message
    });
  }
});

// ─── POST /api/auth/verify-password ───────────────────────────────────────────
router.post('/verify-password', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ valid: false, error: 'Por favor ingrese usuario y contraseña.' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  let lookupUser = normalizedUser;
  if (lookupUser === 'alejandro.leon@boyaca.edu.co' || lookupUser === 'alejandro.leon@boyaca.gov.co' || lookupUser === 'alejandro.leon') {
    lookupUser = 'alejoleo2022@gmail.com';
  }

  try {
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, rol, estado
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [lookupUser]
    );

    if (userResult.rows.length === 0) {
      await bcrypt.compare(normalizedPass, DUMMY_HASH);
      return res.status(400).json({ valid: false, error: 'Credenciales inválidas.' });
    }

    const user = userResult.rows[0];

    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ valid: false, error: 'Usuario inactivo. Contacte a la Dirección de Talento Humano.' });
    }

    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    let matches = false;

    if (isBcrypt) {
      matches = await bcrypt.compare(normalizedPass, user.password);
    } else {
      if (user.password === normalizedPass) {
        matches = true;
      } else {
        await bcrypt.compare(normalizedPass, DUMMY_HASH);
      }
    }

    if (!matches) {
      return res.status(400).json({ valid: false, error: 'Contraseña incorrecta.' });
    }

    return res.json({ valid: true, message: 'Contraseña verificada correctamente.' });
  } catch (err) {
    console.error('[auth] Verify password error:', err.message);
    return res.status(500).json({ valid: false, error: 'Error interno del servidor al verificar la contraseña.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('talento360_token', { path: '/' });
  return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const token = req.body?.token || extractToken(req);
  if (!token) return res.status(400).json({ error: 'Token requerido.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch {
    return res.status(401).json({ valid: false, error: 'Token inválido o expirado.' });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Por favor ingresa tu correo electrónico institucional.' });
  }

  const normalizedInput = email.trim().toLowerCase();
  const GENERIC_SUCCESS = {
    success: true,
    message: 'Si la dirección ingresada corresponde a una cuenta registrada y activa en Talento 360, hemos enviado un correo con tu contraseña provisional e instrucciones. Por favor revisa tu bandeja de entrada o carpeta de spam.'
  };

  try {
    // 1. Primera comprobación: existencia del usuario en la tabla de autenticación
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, nombre, rol, estado, debe_cambiar_password, password_reset_expires
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [normalizedInput]
    );

    if (userResult.rows.length === 0) {
      // Mitigación de timing attack si el usuario no existe
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    const user = userResult.rows[0];

    // 2. Segunda comprobación: vinculación efectiva con la plataforma y rol válido
    if (!user.rol || typeof user.rol !== 'string' || !user.rol.trim()) {
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    // 3. Tercera comprobación: estado activo de la cuenta
    if (!user.estado || user.estado.toUpperCase() !== 'ACTIVO') {
      await bcrypt.compare(normalizedInput, DUMMY_HASH);
      return res.json(GENERIC_SUCCESS);
    }

    // Determinar la dirección de destino
    let destinationEmail = user.username.includes('@') ? user.username.trim().toLowerCase() : null;
    if (!destinationEmail && normalizedInput.includes('@')) {
      destinationEmail = normalizedInput;
    }
    if (!destinationEmail) {
      return res.json(GENERIC_SUCCESS);
    }

    // 4. Generación criptográficamente segura de contraseña provisional aleatoria
    const tempPassword = generateSecureTemporaryPassword();
    const tempHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);

    // Estado anterior para compensación transaccional
    const prevPassword = user.password;
    const prevDebeCambiar = user.debe_cambiar_password || false;
    const prevExpires = user.password_reset_expires || null;

    // 5. Actualizar en base de datos con vigencia de 24 horas y cambio obligatorio
    await pool.query(
      `UPDATE usuarios
       SET password = $1,
           debe_cambiar_password = true,
           password_reset_expires = NOW() + INTERVAL '24 hours'
       WHERE id_usuario = $2`,
      [tempHash, user.id_usuario]
    );

    // Restablecer intentos fallidos y bloqueos temporales de la cuenta
    try {
      await Promise.all([
        clearLockout('user:' + normalizedInput),
        clearLockout('user:' + user.username.trim().toLowerCase()),
        clearLockout('ip:' + getClientIp(req))
      ]);
    } catch (_) {}

    // 6. Enviar correo auténtico por SMTP Gmail
    try {
      const transporter = getMailTransporter();
      const mailFrom = process.env.MAIL_FROM || `Talento 360 — Gobernación de Boyacá <${process.env.SMTP_USER}>`;
      const appUrl = process.env.APP_PUBLIC_URL || process.env.APP_URL || 'http://localhost';

      // Adjuntar el logo institucional oficial de Cóndor para renderizado inline sin bloqueo
      const candidatePaths = [
        path.join(__dirname, '../assets/logoCondor.png'),
        path.join(__dirname, '../../../../frontend/src/imgs/logoCondor.png'),
        '/app/src/assets/logoCondor.png'
      ];
      const validLogoPath = candidatePaths.find(p => {
        try { return fs.existsSync(p); } catch { return false; }
      });

      const attachments = [];
      if (validLogoPath) {
        attachments.push({
          filename: 'logoCondor.png',
          path: validLogoPath,
          cid: 'logoCondor'
        });
      }

      await transporter.sendMail({
        from: mailFrom,
        to: destinationEmail,
        subject: 'Recuperación de contraseña — Talento 360',
        text: buildRecoveryPlainText(user.nombre, tempPassword),
        html: buildRecoveryHtml(user.nombre, tempPassword, appUrl),
        attachments: attachments
      });

      console.log(`[auth-recovery] Correo de recuperación enviado exitosamente a: ${destinationEmail} (id_usuario=${user.id_usuario})`);
      return res.json(GENERIC_SUCCESS);
    } catch (mailError) {
      console.error(`[auth-recovery] Error al enviar correo SMTP a ${destinationEmail}:`, mailError.message);

      // Mecanismo de compensación: restaurar estado previo intacto
      try {
        await pool.query(
          `UPDATE usuarios
           SET password = $1,
               debe_cambiar_password = $2,
               password_reset_expires = $3
           WHERE id_usuario = $4`,
          [prevPassword, prevDebeCambiar, prevExpires, user.id_usuario]
        );
        console.log(`[auth-recovery] Compensación exitosa: Contraseña y estado revertidos para id_usuario=${user.id_usuario}`);
      } catch (revErr) {
        console.error(`[auth-recovery] Fallo catastrófico al compensar id_usuario=${user.id_usuario}:`, revErr.message);
      }

      return res.status(500).json({
        error: 'No fue posible enviar el correo de recuperación en este momento. Por favor verifique la conexión o intente más tarde.'
      });
    }
  } catch (err) {
    console.error('[auth-recovery] Error general en recuperación:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor durante la recuperación de contraseña.' });
  }
});

// ─── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  const token = extractToken(req) || req.body?.token;
  let username = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      username = decoded.username;
    } catch {
      // Token inválido o expirado
    }
  }

  if (!username && req.body?.username) {
    username = req.body.username.trim().toLowerCase();
  }

  if (!username) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.' });
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios: contraseña provisional, nueva contraseña y confirmación.' });
  }

  const curPass = currentPassword.trim();
  const newPass = newPassword.trim();
  const confPass = confirmPassword.trim();

  if (newPass !== confPass) {
    return res.status(400).json({ error: 'La nueva contraseña y su confirmación no coinciden.' });
  }

  if (newPass === curPass) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la contraseña provisional actual.' });
  }

  // Política de seguridad: mínimo 8 caracteres, mayúscula, minúscula, número
  if (newPass.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  if (!/[A-Z]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una letra mayúscula.' });
  }
  if (!/[a-z]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos una letra minúscula.' });
  }
  if (!/[0-9]/.test(newPass)) {
    return res.status(400).json({ error: 'La nueva contraseña debe incluir al menos un número.' });
  }

  try {
    const userResult = await pool.query(
      `SELECT id_usuario, username, password, nombre, rol, cargo_laboral, estado, modulos, permisos, debe_cambiar_password
       FROM usuarios
       WHERE (LOWER(username) = $1 OR LOWER(SPLIT_PART(username, '@', 1)) = $1)
       LIMIT 1`,
      [username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = userResult.rows[0];

    if (user.estado && user.estado.toUpperCase() !== 'ACTIVO') {
      return res.status(403).json({ error: 'Cuenta de usuario inactiva.' });
    }

    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    let matches = false;

    if (isBcrypt) {
      matches = await bcrypt.compare(curPass, user.password);
    } else {
      matches = (user.password === curPass);
    }

    if (!matches) {
      return res.status(400).json({ error: 'La contraseña provisional actual ingresada es incorrecta.' });
    }

    const newHash = await bcrypt.hash(newPass, BCRYPT_SALT_ROUNDS);

    await pool.query(
      `UPDATE usuarios
       SET password = $1,
           debe_cambiar_password = false,
           password_reset_expires = NULL
       WHERE id_usuario = $2`,
      [newHash, user.id_usuario]
    );

    console.log(`[auth] Contraseña actualizada exitosamente para usuario id=${user.id_usuario} (${user.username}). Bandera de cambio obligatorio desactivada.`);

    // Restablecer contadores y bloqueos tras cambio exitoso
    try {
      await Promise.all([
        clearLockout('user:' + username.toLowerCase()),
        clearLockout('user:' + user.username.toLowerCase()),
        clearLockout('ip:' + getClientIp(req))
      ]);
    } catch (_) {}

    let allowedModules = ['dashboard'];
    const rLower = (user.rol || '').toLowerCase();
    if (rLower === 'administrador' || rLower === 'admin') {
      allowedModules = ['*'];
    } else if (rLower === 'sst' || rLower.includes('sst')) {
      allowedModules = ['sst', 'epidemiologico', 'sociodemografico', 'epp'];
    } else if (rLower === 'incapacidades' || rLower.includes('incapacidad')) {
      allowedModules = ['admin-requests', 'incapacidades'];
    } else if (rLower.includes('permiso') && rLower.includes('licencia')) {
      allowedModules = ['admin-requests', 'permisos', 'licencias'];
    } else if (rLower === 'permisos' || rLower.includes('permiso')) {
      allowedModules = ['admin-requests', 'permisos'];
    } else if (user.modulos) {
      allowedModules = user.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    }

    const permissions = resolvePermissions(user.rol, allowedModules, user.permisos);

    const freshPayload = {
      username: user.username,
      name:     user.nombre,
      role:     user.rol,
      jobTitle: user.cargo_laboral || resolveJobTitle(user.rol),
      department: resolveDepartment(user.rol),
      modules:  allowedModules,
      permissions: permissions,
      mustChangePassword: false
    };

    const newToken = jwt.sign(freshPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, newToken);

    return res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes utilizar tu nueva contraseña.',
      token: newToken,
      user: freshPayload
    });
  } catch (err) {
    console.error('[auth] Error al cambiar contraseña:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor al actualizar la contraseña.' });
  }
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Token de autenticación requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.mustChangePassword && req.path !== '/change-password' && req.path !== '/logout' && req.path !== '/verify') {
      return res.status(403).json({
        error: 'Debe cambiar su contraseña provisional antes de continuar.',
        mustChangePassword: true
      });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
}

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put('/profile', authMiddleware, profileLimiter, async (req, res) => {
  const { nombre, currentPassword, newPassword } = req.body;
  const username = req.user.username;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido.' });
  }

  const cleanNombre = nombre.trim();

  try {
    // Buscar usuario en base de datos
    const userQ = await pool.query(
      'SELECT id_usuario, username, password, nombre, rol, cargo_laboral FROM usuarios WHERE LOWER(username) = LOWER($1) AND estado = \'ACTIVO\' LIMIT 1',
      [username]
    );

    if (userQ.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const currentUser = userQ.rows[0];

    // Si se solicita cambio de contraseña
    let finalPassword = currentUser.password;
    if (newPassword && newPassword.trim()) {
      if (!currentPassword || !currentPassword.trim()) {
        return res.status(400).json({ error: 'Debe ingresar su contraseña actual para cambiarla.' });
      }

      // Verificación segura con bcrypt
      const isBcrypt = currentUser.password && (currentUser.password.startsWith('$2a$') || currentUser.password.startsWith('$2b$'));
      let currentMatches = false;

      if (isBcrypt) {
        currentMatches = await bcrypt.compare(currentPassword.trim(), currentUser.password);
      } else {
        currentMatches = (currentUser.password === currentPassword.trim());
      }

      if (!currentMatches) {
        return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
      }

      // Política de robustez: mínimo 8 caracteres
      if (newPassword.trim().length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      }

      // Hashear siempre con factor de coste 12
      finalPassword = await bcrypt.hash(newPassword.trim(), BCRYPT_SALT_ROUNDS);
    }

    // Actualizar en base de datos únicamente campos autorizados (nombre, password)
    const updateQ = await pool.query(
      'UPDATE usuarios SET nombre = $1, password = $2 WHERE LOWER(username) = LOWER($3) RETURNING username, nombre, rol, cargo_laboral, modulos, permisos',
      [cleanNombre, finalPassword, username]
    );

    const updatedUser = updateQ.rows[0];
    let userMods = ['dashboard'];
    if ((updatedUser.rol || '').toLowerCase() === 'administrador') {
      userMods = ['*'];
    } else if (updatedUser.modulos) {
      userMods = updatedUser.modulos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    }
    const userPerms = resolvePermissions(updatedUser.rol, userMods, updatedUser.permisos);

    const payload = {
      username: updatedUser.username,
      name:     updatedUser.nombre,
      role:     updatedUser.rol,
      jobTitle: updatedUser.cargo_laboral || resolveJobTitle(updatedUser.rol),
      department: resolveDepartment(updatedUser.rol),
      modules:  userMods,
      permissions: userPerms,
    };

    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, newToken);

    return res.json({
      message: 'Perfil actualizado exitosamente.',
      user: payload,
      token: newToken
    });
  } catch (err) {
    console.error('[auth] Update profile error:', err.message);
    return res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

function resolvePermissions(role, modules, explicitPerms = null) {
  const r = (role || '').toLowerCase();
  const mods = Array.isArray(modules) ? modules : [];
  if (r === 'administrador' || r === 'admin' || mods.includes('*')) {
    return ['*'];
  }

  // Si el usuario tiene permisos granulares explícitos configurados en la base de datos
  if (explicitPerms && typeof explicitPerms === 'string' && explicitPerms.trim() !== '') {
    const list = explicitPerms.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (list.length > 0) return list;
  }

  const perms = [];
  if (mods.includes('dashboard')) perms.push('dashboard:read');
  if (mods.includes('employees')) {
    perms.push('employees:read', 'employees:write', 'employees:delete', 'employees:import', 'employees:export');
  }
  if (mods.includes('horarios')) {
    perms.push('horarios:read', 'horarios:write', 'horarios:delete');
  }
  if (mods.includes('viaticos')) {
    perms.push('viaticos:read', 'viaticos:write', 'viaticos:status', 'viaticos:import', 'viaticos:delete');
  }
  if (mods.includes('requests') || mods.includes('admin-requests') || mods.includes('permisos') || mods.includes('licencias') || mods.includes('incapacidades')) {
    perms.push('requests:read', 'requests:write', 'admin-requests:read', 'admin-requests:write');
    if (mods.includes('permisos')) perms.push('permisos:read', 'permisos:write');
    if (mods.includes('licencias')) perms.push('licencias:read', 'licencias:write');
    if (mods.includes('incapacidades')) perms.push('incapacidades:read', 'incapacidades:write');
  }
  if (mods.includes('sst')) {
    perms.push('sst:read', 'sst:write', 'epidemiologico:read', 'epidemiologico:write', 'sociodemografico:read', 'sociodemografico:write', 'epp:read', 'epp:write');
  }
  if (mods.includes('admin-backups') || mods.includes('backups')) {
    perms.push('admin-backups:read', 'admin-backups:write', 'admin-backups:download', 'admin-backups:delete');
  }
  return perms;
}

function resolveJobTitle(role) {
  if (!role) return 'Usuario del Sistema';
  const r = role.toLowerCase();
  if (r.includes('respaldo') || r.includes('backup')) return 'Gestor de Copias de Seguridad y Respaldo';
  if (r === 'sst' || r.includes('sst')) return 'Responsable de Seguridad y Salud en el Trabajo (SST)';
  if (r === 'incapacidades' || r.includes('incapacidad')) return 'Responsable de Incapacidades y Ausentismo Laboral';
  if (r.includes('permiso') && r.includes('licencia')) return 'Responsable de Permisos y Licencias Laborales';
  if (r === 'permisos' || r.includes('permiso')) return 'Responsable de Permisos Laborales';
  if (r.includes('coordinador')) return 'Coordinador de Solicitudes';
  if (r.includes('consulta') || r.includes('funcionario')) return 'Servidor Público';
  return 'Usuario del Sistema';
}

function resolveDepartment(role) {
  if (!role) return 'Dirección de Talento Humano';
  const r = role.toLowerCase();
  if (r === 'sst' || r.includes('sst') || r === 'incapacidades' || r.includes('incapacidad')) {
    return 'Subdirección de Seguridad y Salud en el Trabajo';
  }
  if (r.includes('consulta')) return 'Secretaría General';
  return 'Dirección de Talento Humano';
}

module.exports = router;
