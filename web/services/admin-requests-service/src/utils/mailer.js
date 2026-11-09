/* ═══════════════════════════════════════════════════════════════════════════
   utils/mailer.js — Notificaciones por correo (SMTP / Microsoft 365)

   Variables de entorno:
     SMTP_HOST        p. ej. smtp.office365.com
     SMTP_PORT        587 (STARTTLS) por defecto
     SMTP_SECURE      "true" solo para el puerto 465
     SMTP_USER / SMTP_PASS   cuenta que envía (buzón institucional @boyaca.gov.co)
     MAIL_FROM        remitente visible; por defecto SMTP_USER
     MAIL_ENABLED     "false" fuerza el modo simulado
     MAIL_REDIRECT_TO si se define, TODOS los correos se envían a esta dirección
                      (útil para pruebas, evita escribirle a jefes reales)
     APP_PUBLIC_URL   URL del aplicativo (se incluye como enlace en el correo)

   Sin SMTP_HOST ni credenciales el sistema NO falla: registra el correo en la
   consola y marca la notificación como «simulada».
   ═══════════════════════════════════════════════════════════════════════════ */

let transporter = null;

function mailConfigured() {
  return process.env.MAIL_ENABLED !== 'false' && !!process.env.SMTP_HOST;
}

function getTransporter() {
  if (transporter) return transporter;
  if (!mailConfigured()) return null;
  try {
    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = (process.env.SMTP_USER || '').trim();
    // Las contraseñas de aplicación de Google vienen con espacios (ej. abcd efgh ijkl mnop), los eliminamos automáticamente
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const auth = (user && pass) ? { user, pass } : undefined;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port,
      secure,
      auth,
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    console.log(`[mailer] Transporter SMTP inicializado correctamente para ${process.env.SMTP_HOST}:${port}`);
  } catch (err) {
    console.warn('[mailer] Error inicializando nodemailer (se usará modo simulado):', err.message);
    transporter = null;
  }
  return transporter;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Envía un correo. Nunca lanza: devuelve { estado, detalle }.
 * estado: 'enviada' | 'simulada' | 'fallida'
 */
async function sendMail({ to, subject, html, text }) {
  if (!to || !to.trim()) {
    return { estado: 'fallida', detalle: 'Dirección de correo destino vacía.' };
  }
  to = to.trim();
  const original = to;
  if (process.env.MAIL_REDIRECT_TO) {
    to = process.env.MAIL_REDIRECT_TO;
    subject = `[PRUEBA · destinatario real: ${original}] ${subject}`;
  }
  const tx = getTransporter();
  if (!tx) {
    console.log(`[mailer][MODO SIMULADO] Para: ${to} | Asunto: ${subject}`);
    console.log(`[mailer][NOTA] No hay servidor SMTP configurado (SMTP_HOST no definido en .env). El correo no se envió a la red.`);
    return { estado: 'simulada', detalle: `Correo simulado para ${to} (SMTP sin configurar en .env).` };
  }
  try {
    const user = (process.env.SMTP_USER || '').trim();
    const rawFrom = (process.env.MAIL_FROM || '').trim();
    const fromAddress = rawFrom || (user ? `"Talento Humano 360" <${user}>` : 'no-reply@boyaca.gov.co');
    const info = await tx.sendMail({
      from: fromAddress,
      to, subject, html, text,
    });
    console.log(`[mailer] Correo enviado exitosamente a ${to}. MessageId: ${info.messageId}`);
    return { estado: 'enviada', detalle: `Enviado exitosamente a ${to}.` };
  } catch (err) {
    console.error('[mailer] Error enviando correo a', to, ':', err.message);
    return { estado: 'fallida', detalle: `No se pudo enviar a ${to}: ${err.message}`.slice(0, 480) };
  }
}

// ─── Plantillas ──────────────────────────────────────────────────────────────
function layout(titulo, intro, filas, pie) {
  const rows = filas.filter(f => f[1] !== '' && f[1] != null).map(([k, v]) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#334155;width:34%">${esc(k)}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a">${esc(v)}</td>
      </tr>`).join('');
  const link = process.env.APP_PUBLIC_URL
    ? `<p style="margin:16px 0 0"><a href="${esc(process.env.APP_PUBLIC_URL)}" style="color:#287522;font-weight:600">Abrir Talento 360</a></p>` : '';
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
  <div style="max-width:620px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#287522;color:#ffffff;padding:18px 24px">
      <div style="font-size:12px;letter-spacing:.6px;text-transform:uppercase;opacity:.85">Gobernación de Boyacá · Talento 360</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">${esc(titulo)}</div>
    </div>
    <div style="padding:22px 24px;color:#0f172a;font-size:14px;line-height:1.55">
      <p style="margin:0 0 14px">${intro}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>
      <p style="margin:16px 0 0;color:#475569;font-size:12.5px">${pie}</p>
      ${link}
    </div>
    <div style="padding:12px 24px;background:#f8fafc;color:#64748b;font-size:11.5px;border-top:1px solid #e2e8f0">
      Mensaje automático. Contiene datos personales tratados conforme a la Ley 1581 de 2012; no lo reenvíe a terceros.
    </div>
  </div></body></html>`;
}

function filasPermiso(s) {
  return [
    ['Radicado', s.radicado],
    ['Servidor público', s.persona],
    ['Documento', s.documento],
    ['Correo del solicitante', s.correoSolicitante],
    ['Sectorial', s.sectorial],
    ['Dependencia', s.dependencia],
    ['Nivel / Cargo', `${s.nivel} · ${s.cargo}`],
    ['Fecha(s)', s.fechaTexto],
    ['Jornada / horario', s.jornadaTexto],
    ['Duración', s.duracion],
    ['Motivo', s.motivo],
    ['Soportes adjuntos', s.soportesCount ? `${s.soportesCount} archivo(s) disponible(s) en el aplicativo` : 'Ninguno'],
    ['Observaciones', s.observaciones],
  ];
}

function buildJefeEmail(s) {
  const subject = `Solicitud de permiso laboral ${s.radicado} · ${s.persona}`;
  const html = layout(
    'Nueva solicitud de permiso laboral',
    `Buen día, <strong>${esc(s.jefeNombre)}</strong>. El servidor público <strong>${esc(s.persona)}</strong> radicó una solicitud de permiso laboral y lo indicó como su jefe inmediato.`,
    filasPermiso(s),
    'Para cualquier observación sobre esta solicitud, comuníquese con la Dirección General de Talento Humano.'
  );
  const text = `Nueva solicitud de permiso laboral ${s.radicado}\n\n` +
    filasPermiso(s).filter(f => f[1]).map(([k, v]) => `${k}: ${v}`).join('\n') +
    '\n\nPara cualquier observación comuníquese con la Dirección General de Talento Humano.';
  return { to: s.jefeCorreo, subject, html, text };
}

function buildSolicitanteEmail(s) {
  const subject = `Radicaste tu solicitud de permiso ${s.radicado}`;
  const html = layout(
    'Solicitud de permiso radicada',
    `Hola, <strong>${esc(s.persona)}</strong>. Tu solicitud de permiso laboral quedó registrada con el radicado <strong>${esc(s.radicado)}</strong> y se notificó a tu jefe inmediato (<strong>${esc(s.jefeNombre)}</strong>).`,
    filasPermiso(s),
    'Conserva este radicado para cualquier consulta con la Dirección General de Talento Humano.'
  );
  const text = `Tu solicitud de permiso quedó radicada: ${s.radicado}. Se notificó a tu jefe inmediato (${s.jefeNombre}).`;
  return { to: s.correoSolicitante, subject, html, text };
}

/** Envía al jefe inmediato y confirmación al solicitante. */
async function notifyPermiso(s) {
  const [jefe, sol] = await Promise.all([
    sendMail(buildJefeEmail(s)),
    sendMail(buildSolicitanteEmail(s)),
  ]);
  // El estado global refleja primero lo más importante: el correo al jefe
  const estado = jefe.estado;
  const detalle = `Jefe: ${jefe.detalle} | Solicitante: ${sol.detalle}`.slice(0, 490);
  return { estado, detalle, jefe, solicitante: sol };
}

module.exports = { sendMail, notifyPermiso, buildJefeEmail, buildSolicitanteEmail, mailConfigured };

