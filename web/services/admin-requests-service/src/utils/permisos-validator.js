/* ═══════════════════════════════════════════════════════════════════════════
   utils/permisos-validator.js — Validación y normalización de Permisos Laborales
   Aplica las reglas del formulario de la Gobernación (CamposFormulario.xlsx):
   datos del servidor, sectorial → dependencia, nivel → cargo, duración
   (horas / un día / varios días), motivo e incentivos institucionales,
   jefe inmediato y soportes.
   ═══════════════════════════════════════════════════════════════════════════ */

const cat = require('../catalogs/permisos');
const cal = require('./colombia-calendar');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE  = /^([01]\d|2[0-3]):[0-5]\d$/;

function clean(v) { return (v == null ? '' : String(v)).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function fail(campo, error) { return { error, campo }; }
function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

function emailError(value, etiqueta) {
  const v = clean(value).toLowerCase();
  if (!v) return `El ${etiqueta} es requerido.`;
  if (!EMAIL_RE.test(v)) return `El ${etiqueta} no tiene un formato válido.`;
  if (cat.EMAIL_DOMAIN && !v.endsWith('@' + cat.EMAIL_DOMAIN))
    return `El ${etiqueta} debe ser un correo institucional @${cat.EMAIL_DOMAIN}.`;
  return null;
}

function formatHoras(h) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  if (hh && mm) return `${hh} h ${mm} min`;
  return hh ? `${hh} h` : `${mm} min`;
}

// Magic bytes → tipo real del archivo (no se confía solo en la extensión/MIME enviados)
function sniffMime(buf) {
  if (buf.length >= 4 && buf.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  return null;
}

function parseSoportes(list, keptCount) {
  if (list == null) return { soportes: [] };
  if (!Array.isArray(list)) return { error: fail('soportes', 'Formato de soportes inválido.') };
  if (keptCount + list.length > cat.SOPORTES.maxArchivos)
    return { error: fail('soportes', `Máximo ${cat.SOPORTES.maxArchivos} soportes por solicitud.`) };
  const soportes = [];
  for (const f of list) {
    const nombre = clean((f && f.nombre) || '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 200);
    const b64 = String((f && f.base64) || '').replace(/^data:[^;]+;base64,/, '');
    if (!nombre || !b64) return { error: fail('soportes', 'Uno de los soportes está vacío o sin nombre.') };
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return { error: fail('soportes', `El soporte «${nombre}» está vacío.`) };
    if (buffer.length > cat.SOPORTES.maxBytes)
      return { error: fail('soportes', `El soporte «${nombre}» supera ${cat.SOPORTES.maxBytes / 1024 / 1024} MB.`) };
    const tipo = sniffMime(buffer);
    if (!tipo || !cat.SOPORTES.tipos.includes(tipo))
      return { error: fail('soportes', `El soporte «${nombre}» debe ser PDF, JPG o PNG.`) };
    soportes.push({ nombre, tipo, buffer });
  }
  return { soportes };
}

/**
 * @param {object} body            payload del formulario
 * @param {object} opts
 * @param {object} opts.pool       pool de PostgreSQL
 * @param {number} [opts.excludeId]       id de la solicitud que se edita (se excluye de los límites)
 * @param {number} [opts.keptSoportes]    soportes ya guardados que se conservan (edición)
 * @returns {Promise<{error?:string,campo?:string,data?:object}>}
 */
async function validatePermiso(body, { pool, excludeId = 0, keptSoportes = 0 }) {
  const advertencias = [];

  // 1. Datos del servidor público
  const persona = clean(body.persona).toUpperCase();
  if (persona.length < 5) return fail('persona', 'Ingrese los nombres y apellidos completos del servidor público.');
  const documento = String(body.documento == null ? '' : body.documento).trim();
  if (!/^\d{5,12}$/.test(documento))
    return fail('documento', 'El documento debe contener solo números, sin puntos ni texto (5 a 12 dígitos).');
  const eSol = emailError(body.correoSolicitante, 'correo del servidor público');
  if (eSol) return fail('correoSolicitante', eSol);
  const correoSolicitante = clean(body.correoSolicitante).toLowerCase();
  const codigo = clean(body.codigo || '').slice(0, 80);
  const grado = clean(body.grado || '').slice(0, 80);

  // 2. Sectorial → Dependencia / Nivel → Cargo
  const sectorial = clean(body.sectorial);
  const sec = cat.SECTORIALES.find(s => s.nombre === sectorial);
  if (!sec) return fail('sectorial', 'Seleccione una sectorial válida.');
  const rawDep = clean(body.dependencia);
  const depClean = rawDep.replace(/^\d+(\.\d+)*\s*/, '').toUpperCase();
  const matchedDep = sec.dependencias.find(d => d.replace(/^\d+(\.\d+)*\s*/, '').toUpperCase() === depClean) || (sec.dependencias.includes(rawDep) ? rawDep : null);
  if (!matchedDep)
    return fail('dependencia', 'La dependencia no corresponde a la sectorial seleccionada.');
  const dependencia = matchedDep;
  const nivel = clean(body.nivel);
  const niv = cat.NIVELES.find(n => n.nombre === nivel);
  if (!niv) return fail('nivel', 'Seleccione un nivel válido.');
  const cargo = clean(body.cargo);
  if (!niv.cargos.includes(cargo)) return fail('cargo', 'El cargo no corresponde al nivel seleccionado.');

  // 3. Duración
  const modalidad = clean(body.modalidad);
  if (!cat.MODALIDADES.some(m => m.id === modalidad))
    return fail('modalidad', 'Seleccione si el permiso es por horas, por un día o por varios días.');

  const fi = cal.parseDMY(body.fechaInicio);
  if (!fi) return fail('fechaInicio', 'La fecha de inicio no es válida.');
  let ff = fi, dias = 1, jornada = null, horaSalida = null, horaEntrada = null, horasSolicitadas = null;
  let duracion = '', jornadaTexto = '';

  if (modalidad === 'varios_dias') {
    ff = cal.parseDMY(body.fechaFin);
    if (!ff) return fail('fechaFin', 'La fecha final no es válida.');
    if (ff.getTime() <= fi.getTime()) return fail('fechaFin', 'La fecha final debe ser posterior a la fecha de inicio.');
    if ((ff.getTime() - fi.getTime()) / cal.DAY_MS > 366) return fail('fechaFin', 'El rango de fechas no puede superar un año.');
    if (!cal.isBusinessDay(fi)) return fail('fechaInicio', 'La fecha de inicio debe ser un día hábil (no fin de semana ni festivo).');
    if (!cal.isBusinessDay(ff)) return fail('fechaFin', 'La fecha final debe ser un día hábil (no fin de semana ni festivo).');
    dias = cal.countBusinessDays(fi, ff);
    jornada = cat.JORNADAS.find(j => j.id === 'TODO_EL_DIA');
    duracion = `${dias} días hábiles`;
    jornadaTexto = 'Todo el día (varios días)';
  } else {
    if (!cal.isBusinessDay(fi)) return fail('fechaInicio', 'La fecha seleccionada no es un día hábil (fin de semana o festivo).');
    const jornadaId = clean(body.jornada);
    jornada = cat.JORNADAS.find(j => j.id === jornadaId && j.modalidad === modalidad);
    if (!jornada) return fail('jornada', 'Seleccione una jornada válida.');

    if (modalidad === 'horas') {
      horaSalida = clean(body.horaSalida); horaEntrada = clean(body.horaEntrada);
      if (!TIME_RE.test(horaSalida) || !TIME_RE.test(horaEntrada))
        return fail('horaSalida', 'Indique la hora de salida y la hora de entrada (formato HH:MM).');
      const [vMin, vMax] = jornada.ventana.map(toMin);
      const hs = toMin(horaSalida), he = toMin(horaEntrada);
      if (hs < vMin || hs > vMax || he < vMin || he > vMax)
        return fail('horaSalida', `Para la jornada de la ${jornada.label.toLowerCase()} las horas deben estar entre ${jornada.ventana[0]} y ${jornada.ventana[1]}.`);
      if (hs === he) return fail('horaEntrada', 'La hora de entrada y la de salida no pueden ser iguales.');
      horasSolicitadas = Math.round((Math.abs(he - hs) / 60) * 100) / 100;
      duracion = formatHoras(horasSolicitadas);
      jornadaTexto = `${jornada.label}: salida ${horaSalida} · entrada ${horaEntrada}`;
    } else {
      duracion = jornada.id === 'TODO_EL_DIA' ? '1 día' : 'Medio día';
      jornadaTexto = jornada.label;
    }
  }

  // 4. Motivo e incentivos
  const motivo = cat.getMotivo(clean(body.motivoCategoria));
  if (!motivo) return fail('motivoCategoria', 'Seleccione el motivo del permiso.');
  let incentivo = null;
  if (motivo.opciones) {
    incentivo = cat.getIncentivo(motivo.id, clean(body.motivoIncentivo));
    if (!incentivo) return fail('motivoIncentivo', 'Seleccione una de las opciones del motivo elegido.');
  }
  const reglas = (incentivo && incentivo.reglas) || {};
  const nombreIncentivo = incentivo ? incentivo.label.replace(/\s*\(.*$/, '').replace(/\s+-\s+.*$/, '') : '';

  if (reglas.modalidades && !reglas.modalidades.includes(modalidad)) {
    const etiquetas = reglas.modalidades.map(id => cat.MODALIDADES.find(m => m.id === id).label.toLowerCase()).join(' o ');
    return fail('modalidad', `«${nombreIncentivo}» solo aplica para permisos de ${etiquetas}.`);
  }
  if (reglas.jornadas && modalidad === 'dia' && !reglas.jornadas.includes(jornada.id)) {
    const etiquetas = reglas.jornadas.map(id => cat.JORNADAS.find(j => j.id === id).label.toLowerCase()).join(' o ');
    return fail('jornada', `«${nombreIncentivo}» solo aplica para la jornada: ${etiquetas}.`);
  }
  if (reglas.diasExactos && dias !== reglas.diasExactos)
    return fail('fechaFin', `«${nombreIncentivo}» corresponde a exactamente ${reglas.diasExactos} días hábiles (seleccionó ${dias}).`);

  // 5. Jefe inmediato
  const jefeNombre = clean(body.jefeNombre).toUpperCase();
  if (jefeNombre.length < 5) return fail('jefeNombre', 'Ingrese el nombre completo del jefe inmediato.');
  const eJefe = emailError(body.jefeCorreo, 'correo del jefe inmediato');
  if (eJefe) return fail('jefeCorreo', eJefe);
  const jefeCorreo = clean(body.jefeCorreo).toLowerCase();
  if (jefeCorreo === correoSolicitante)
    return fail('jefeCorreo', 'El correo del jefe inmediato no puede ser el mismo del servidor público solicitante.');

  // 6. Soportes
  const parsed = parseSoportes(body.soportes, keptSoportes);
  if (parsed.error) return parsed.error;
  if (reglas.soporteObligatorio && keptSoportes + parsed.soportes.length < 1)
    return fail('soportes', `«${nombreIncentivo}» requiere adjuntar al menos un soporte.`);

  // 7. Reglas que consultan la base de datos
  if (reglas.cumpleanos) {
    let nacimiento = null;
    try {
      const r = await pool.query('SELECT fecha_nacimiento FROM personas WHERE cedula = $1 LIMIT 1', [documento]);
      nacimiento = r.rows[0] ? cal.parseFlexibleDate(r.rows[0].fecha_nacimiento) : null;
    } catch (err) { console.warn('[permisos] no se pudo consultar fecha de nacimiento:', err.message); }
    if (!nacimiento) {
      advertencias.push('No se pudo verificar automáticamente la fecha de cumpleaños; Talento Humano debe validarla.');
    } else {
      const ok = [fi.getUTCFullYear(), fi.getUTCFullYear() - 1].some(y => {
        const b = cal.utc(y, nacimiento.getUTCMonth() + 1, nacimiento.getUTCDate());
        return fi.getTime() >= b.getTime() && fi.getTime() <= cal.addDays(b, 30).getTime();
      });
      if (!ok) {
        const dd = String(nacimiento.getUTCDate()).padStart(2, '0'), mm = String(nacimiento.getUTCMonth() + 1).padStart(2, '0');
        return fail('fechaInicio', `«Celebra la vida» debe tomarse el día del cumpleaños (${dd}/${mm}) o dentro de los 30 días siguientes.`);
      }
    }
  }

  if (reglas.limite && incentivo) {
    const year = String(fi.getUTCFullYear());
    const params = [documento, incentivo.id, excludeId || 0, year];
    let sql = `SELECT COUNT(*)::int AS n FROM solicitudes_admin
               WHERE tipo = 'Permiso Laboral' AND documento = $1 AND motivo_incentivo = $2
                 AND estado NOT ILIKE 'rechazad%' AND id_solicitud <> $3
                 AND fecha_inicio ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' AND RIGHT(fecha_inicio, 4) = $4`;
    if (reglas.limite.periodo === 'semestre') {
      params.push(fi.getUTCMonth() < 6);
      sql += ' AND ((SUBSTRING(fecha_inicio, 4, 2))::int <= 6) = $5';
    }
    const { rows } = await pool.query(sql, params);
    if (rows[0].n >= reglas.limite.max)
      return fail('motivoIncentivo', `Ya existe una solicitud de «${nombreIncentivo}» para este ${reglas.limite.periodo === 'semestre' ? 'semestre' : 'año'}.`);
  }

  const fechaInicio = cal.formatDMY(fi), fechaFin = cal.formatDMY(ff);
  return {
    data: {
      persona, documento, correoSolicitante, codigo, grado, sectorial, dependencia, nivel, cargo,
      modalidad, jornada: jornada.label, horaSalida, horaEntrada, horasSolicitadas,
      fechaInicio, fechaFin, dias,
      motivoCategoria: motivo.id, motivoIncentivo: incentivo ? incentivo.id : null,
      motivoLabel: incentivo ? `${motivo.label}: ${incentivo.label}` : motivo.label,
      jefeNombre, jefeCorreo,
      observaciones: clean(body.observaciones).slice(0, 480),
      duracion, jornadaTexto,
      fechaTexto: fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} al ${fechaFin}`,
      soportes: parsed.soportes,
      advertencias,
    },
  };
}

module.exports = { validatePermiso, formatHoras, clean };

