/* ═══════════════════════════════════════════════════════════════════════════
   utils/colombia-calendar.js — Días hábiles y festivos de Colombia
   Todas las fechas se manejan en UTC (medianoche) para evitar desfases de zona
   horaria. Formato de texto del sistema: DD/MM/AAAA.
   Festivos: Ley 51 de 1983 (Ley Emiliani) + festivos móviles de Semana Santa.
   ═══════════════════════════════════════════════════════════════════════════ */

const DAY_MS = 24 * 60 * 60 * 1000;

function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }
function pad(n) { return String(n).padStart(2, '0'); }
function isoKey(date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }

// Domingo de Pascua (algoritmo gregoriano anónimo)
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

// Traslada al lunes siguiente (si ya es lunes, se mantiene)
function nextMonday(date) {
  const dow = date.getUTCDay(); // 0 dom … 6 sáb
  const delta = dow === 1 ? 0 : (8 - dow) % 7;
  return addDays(date, delta);
}

const festivosCache = new Map();
function festivos(year) {
  if (festivosCache.has(year)) return festivosCache.get(year);
  const set = new Set();
  // Fijos
  [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].forEach(([m, d]) => set.add(isoKey(utc(year, m, d))));
  // Trasladables al lunes (Ley Emiliani)
  [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]]
    .forEach(([m, d]) => set.add(isoKey(nextMonday(utc(year, m, d)))));
  // Semana Santa y festivos móviles
  const easter = easterSunday(year);
  set.add(isoKey(addDays(easter, -3)));              // Jueves Santo
  set.add(isoKey(addDays(easter, -2)));              // Viernes Santo
  set.add(isoKey(nextMonday(addDays(easter, 39))));  // Ascensión del Señor
  set.add(isoKey(nextMonday(addDays(easter, 60))));  // Corpus Christi
  set.add(isoKey(nextMonday(addDays(easter, 68))));  // Sagrado Corazón de Jesús
  festivosCache.set(year, set);
  return set;
}

function isFestivo(date) { return festivos(date.getUTCFullYear()).has(isoKey(date)); }
function isBusinessDay(date) {
  const dow = date.getUTCDay();
  return dow !== 0 && dow !== 6 && !isFestivo(date);
}

// Cuenta los días hábiles entre dos fechas (ambas incluidas)
function countBusinessDays(start, end) {
  let n = 0;
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) if (isBusinessDay(d)) n++;
  return n;
}

// Devuelve la fecha del n-ésimo día hábil contando desde «start» (start cuenta como el 1.º)
function nthBusinessDay(start, n) {
  let d = start, count = isBusinessDay(d) ? 1 : 0;
  while (count < n) { d = addDays(d, 1); if (isBusinessDay(d)) count++; }
  return d;
}

// DD/MM/AAAA → Date (UTC) | null
function parseDMY(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str || '').trim());
  if (!m) return null;
  const d = utc(+m[3], +m[2], +m[1]);
  return (d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1]) ? d : null;
}
function formatDMY(date) { return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`; }

// Fecha de nacimiento almacenada como texto libre (DD/MM/AAAA, AAAA-MM-DD, serial de Excel…) → Date | null
function parseFlexibleDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) { const d = utc(+m[1], +m[2], +m[3]); return isNaN(d) ? null : d; }
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
  if (m) { const d = utc(+m[3], +m[2], +m[1]); return isNaN(d) ? null : d; }
  if (/^\d{4,5}(\.\d+)?$/.test(s)) { // serial de Excel (días desde 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(parseFloat(s)) * DAY_MS);
    return isNaN(d) ? null : d;
  }
  return null;
}

module.exports = {
  DAY_MS, addDays, isoKey, utc, festivos, isFestivo, isBusinessDay, countBusinessDays,
  nthBusinessDay, parseDMY, formatDMY, parseFlexibleDate,
};

