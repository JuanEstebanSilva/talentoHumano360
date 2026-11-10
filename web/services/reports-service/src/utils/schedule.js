// Cálculo de la próxima ejecución. Colombia no tiene horario de verano: el desfase es fijo,
// así el resultado no depende de la zona horaria del servidor.

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const UNIT_MS = { horas: HOUR, dias: DAY, semanas: 7 * DAY };

/** Interpreta 'AAAA-MM-DDTHH:mm' como hora de Colombia. */
function parseBogotaDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return new Date(utc - BOGOTA_OFFSET_MS);
}

function bogotaToday(now = new Date()) {
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

function nextMonthly(inicio, after) {
  const start = new Date(inicio.getTime() + BOGOTA_OFFSET_MS);
  const local = new Date(after.getTime() + BOGOTA_OFFSET_MS);
  let year = local.getUTCFullYear();
  let month = local.getUTCMonth();
  // Se prueban como mucho dos meses: el actual y, si ya pasó, el siguiente.
  for (let i = 0; i < 2; i++) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const candidate = new Date(Date.UTC(
      year, month, Math.min(start.getUTCDate(), lastDay),
      start.getUTCHours(), start.getUTCMinutes()
    ) - BOGOTA_OFFSET_MS);
    if (candidate > after) return candidate;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return null;
}

/**
 * Primera ejecución posterior a `after`. Si el servidor estuvo apagado no se acumulan
 * ejecuciones atrasadas: se ejecuta una vez y se continúa con la siguiente fecha.
 */
function computeNextRun({ frecuencia, intervalo, unidad, inicio }, after = new Date()) {
  const start = new Date(inicio);
  if (start > after) return start;
  if (frecuencia === 'mensual') return nextMonthly(start, after);

  let step;
  if (frecuencia === 'diaria') step = DAY;
  else if (frecuencia === 'semanal') step = 7 * DAY;
  else step = (Number(intervalo) || 1) * (UNIT_MS[unidad] || DAY);

  const steps = Math.floor((after.getTime() - start.getTime()) / step) + 1;
  return new Date(start.getTime() + steps * step);
}

/** Devuelve un mensaje de error, o null si la programación es válida. */
function validateSchedule({ frecuencia, intervalo, unidad }) {
  if (!['diaria', 'semanal', 'mensual', 'personalizada'].includes(frecuencia)) {
    return 'La frecuencia debe ser diaria, semanal, mensual o personalizada.';
  }
  if (frecuencia === 'personalizada') {
    if (!UNIT_MS[unidad]) return 'La unidad del intervalo debe ser horas, días o semanas.';
    if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 1000) {
      return 'El intervalo debe ser un número entero entre 1 y 1000.';
    }
  }
  return null;
}

module.exports = { parseBogotaDateTime, bogotaToday, computeNextRun, validateSchedule };
