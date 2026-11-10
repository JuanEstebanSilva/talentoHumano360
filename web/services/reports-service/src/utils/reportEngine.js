// Motor de informes: convierte fuente + filtros en una consulta y entrega filas y criterios.
// Lo usan por igual la vista previa, las exportaciones y las tareas programadas.

const { getSource } = require('./catalog');
const { bogotaToday } = require('./schedule');

const MAX_ROWS = 20000;

const PERIODS = {
  ultimos_7: 'Últimos 7 días',
  ultimos_30: 'Últimos 30 días',
  mes_actual: 'Mes actual',
  mes_anterior: 'Mes anterior',
  anio_actual: 'Año en curso',
  anio_anterior: 'Año anterior',
};

class ReportError extends Error {}

const iso = (date) => date.toISOString().slice(0, 10);

/** Los periodos se calculan en cada ejecución: "mes anterior" siempre será el mes anterior real. */
function resolvePeriod(preset, now = new Date()) {
  const { year, month, day } = bogotaToday(now);
  const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
  switch (preset) {
    case 'ultimos_7': return { desde: iso(utc(year, month, day - 6)), hasta: iso(utc(year, month, day)) };
    case 'ultimos_30': return { desde: iso(utc(year, month, day - 29)), hasta: iso(utc(year, month, day)) };
    case 'mes_actual': return { desde: iso(utc(year, month, 1)), hasta: iso(utc(year, month + 1, 0)) };
    case 'mes_anterior': return { desde: iso(utc(year, month - 1, 1)), hasta: iso(utc(year, month, 0)) };
    case 'anio_actual': return { desde: `${year}-01-01`, hasta: `${year}-12-31` };
    case 'anio_anterior': return { desde: `${year - 1}-01-01`, hasta: `${year - 1}-12-31` };
    default: return null;
  }
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

function buildWhere(source, filtros = {}, now = new Date()) {
  if (filtros === null || typeof filtros !== 'object' || Array.isArray(filtros)) {
    throw new ReportError('Los filtros no tienen un formato válido.');
  }
  const conditions = source.filtroBase ? [source.filtroBase] : [];
  const params = [];
  const criterios = [];
  const bind = (value) => { params.push(value); return `$${params.length}`; };

  for (const [key, value] of Object.entries(filtros)) {
    const filtro = source.filtros.find(f => f.key === key);
    if (!filtro) throw new ReportError(`El filtro "${key}" no existe en este informe.`);
    if (value === null || value === undefined || value === '') continue;

    if (filtro.tipo === 'fechas') {
      if (typeof value !== 'object') throw new ReportError(`El filtro "${filtro.label}" no es válido.`);
      let { desde, hasta } = value;
      let etiqueta = '';
      if (value.periodo) {
        const range = resolvePeriod(value.periodo, now);
        if (!range) throw new ReportError(`El periodo de "${filtro.label}" no es válido.`);
        ({ desde, hasta } = range);
        etiqueta = `${PERIODS[value.periodo]}: `;
      }
      if (!desde && !hasta) continue;
      if ((desde && !isValidDate(desde)) || (hasta && !isValidDate(hasta))) {
        throw new ReportError(`Las fechas de "${filtro.label}" no son válidas.`);
      }
      if (desde && hasta && desde > hasta) {
        throw new ReportError(`En "${filtro.label}", la fecha inicial es posterior a la final.`);
      }
      if (desde) conditions.push(`${filtro.expr} >= ${bind(desde)}::date`);
      if (hasta) conditions.push(`${filtro.expr} <= ${bind(hasta)}::date`);
      criterios.push({ label: filtro.label, valor: `${etiqueta}${desde || 'inicio'} a ${hasta || 'hoy'}`, esPeriodo: true });
    } else if (filtro.tipo === 'numero') {
      if (typeof value !== 'object') throw new ReportError(`El filtro "${filtro.label}" no es válido.`);
      const min = value.min === '' || value.min == null ? null : Number(value.min);
      const max = value.max === '' || value.max == null ? null : Number(value.max);
      if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
        throw new ReportError(`El filtro "${filtro.label}" debe ser numérico.`);
      }
      if (min === null && max === null) continue;
      if (min !== null) conditions.push(`${filtro.expr} >= ${bind(min)}::numeric`);
      if (max !== null) conditions.push(`${filtro.expr} <= ${bind(max)}::numeric`);
      criterios.push({ label: filtro.label, valor: `${min ?? 'sin mínimo'} a ${max ?? 'sin máximo'}` });
    } else {
      if (typeof value !== 'string') throw new ReportError(`El filtro "${filtro.label}" no es válido.`);
      const text = value.trim().slice(0, 300);
      if (!text) continue;
      if (filtro.tipo === 'documento') {
        conditions.push(`REPLACE(REPLACE(${filtro.expr}, '.', ''), ' ', '') = ${bind(text.replace(/[.,\s]/g, ''))}`);
      } else if (filtro.tipo === 'lista') {
        conditions.push(`${filtro.expr} = ${bind(text)}`);
      } else {
        conditions.push(`${filtro.expr} ILIKE ${bind(`%${escapeLike(text)}%`)}`);
      }
      criterios.push({ label: filtro.label, valor: text });
    }
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params, criterios };
}

function pickColumns(source, columnas) {
  if (columnas === undefined || columnas === null || (Array.isArray(columnas) && !columnas.length)) {
    return source.columnas.filter(c => c.porDefecto);
  }
  if (!Array.isArray(columnas)) throw new ReportError('Las columnas no tienen un formato válido.');
  const unknown = columnas.find(key => !source.columnas.some(c => c.key === key));
  if (unknown) throw new ReportError(`La columna "${unknown}" no existe en este informe.`);
  return source.columnas.filter(c => columnas.includes(c.key));
}

/** Valida filtros y columnas sin consultar la base de datos. */
function validateDefinition(fuente, filtros, columnas) {
  const source = getSource(fuente);
  if (!source) throw new ReportError('El informe solicitado no existe.');
  buildWhere(source, filtros);
  pickColumns(source, columnas);
  return source;
}

async function runReport(db, { fuente, filtros, columnas, limit = MAX_ROWS, offset = 0, now = new Date() }) {
  const source = getSource(fuente);
  if (!source) throw new ReportError('El informe solicitado no existe.');
  const { where, params, criterios } = buildWhere(source, filtros, now);
  const selected = pickColumns(source, columnas);
  const select = selected.map(c => `${c.expr} AS "${c.key}"`).join(', ');
  const rowLimit = Math.min(MAX_ROWS, Math.max(1, Number(limit) || MAX_ROWS));

  const [rows, count] = await Promise.all([
    db.query(
      `SELECT ${select} FROM ${source.from} ${where} ORDER BY ${source.orden}
       LIMIT ${rowLimit} OFFSET ${Math.max(0, Number(offset) || 0)}`,
      params
    ),
    db.query(`SELECT COUNT(*) AS total FROM ${source.from} ${where}`, params),
  ]);

  return {
    fuente: source.id,
    fuenteNombre: source.nombre,
    columnas: selected.map(({ key, label }) => ({ key, label })),
    filas: rows.rows,
    total: Number(count.rows[0].total),
    criterios,
    generadoEn: new Date().toISOString(),
  };
}

/** Valores existentes para los filtros de lista: nunca se ofrecen opciones inventadas. */
async function loadOptions(db, source) {
  const entries = await Promise.all(source.filtros
    .filter(f => f.tipo === 'lista')
    .map(async (filtro) => {
      if (filtro.opciones) return [filtro.key, filtro.opciones];
      const { rows } = await db.query(
        `SELECT DISTINCT ${filtro.expr} AS valor FROM ${source.from}
         ${source.filtroBase ? `WHERE ${source.filtroBase}` : ''} ORDER BY 1 LIMIT 500`
      );
      return [filtro.key, rows.map(r => r.valor).filter(v => v !== null && String(v).trim() !== '')];
    }));
  return Object.fromEntries(entries);
}

module.exports = { MAX_ROWS, PERIODS, ReportError, resolvePeriod, buildWhere, pickColumns, validateDefinition, runReport, loadOptions };
