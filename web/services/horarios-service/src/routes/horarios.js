const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
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

const JWT_SECRET = process.env.JWT_SECRET || 'talento360_secret_2026';

const VALID_MODALIDADES = ['Presencial', 'Teletrabajo', 'Trabajo en casa', 'Horario flexible'];
const VALID_ESTADOS     = ['Activa', 'Pendiente', 'En revisión', 'Finalizada', 'Rechazada', 'Caducada'];

// ─── Middleware de Autenticación ─────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o sesión expirada.' });
  }
}

function canEdit(role) {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes('administrador') || r.includes('coordinador');
}

function upper(v) {
  return v == null ? '' : String(v).trim().replace(/\s+/g, ' ').toUpperCase();
}

// ─── Calendario de Festivos de Colombia (Ley 51 de 1983 / Ley Emiliani) ──────
// Generador y validador de festivos colombianos para cálculo de días hábiles
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function moveToNextMonday(date) {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0: Sun, 1: Mon, ...
  if (day === 1) return d; // already Monday
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function getColombianHolidays(year) {
  const holidays = new Set();
  const add = (d) => {
    const iso = d.toISOString().split('T')[0];
    holidays.add(iso);
  };

  // Festivos fijos que no se trasladan
  add(new Date(Date.UTC(year, 0, 1)));   // 1 de Enero
  add(new Date(Date.UTC(year, 4, 1)));   // 1 de Mayo
  add(new Date(Date.UTC(year, 6, 20)));  // 20 de Julio
  add(new Date(Date.UTC(year, 7, 7)));   // 7 de Agosto
  add(new Date(Date.UTC(year, 11, 8)));  // 8 de Diciembre
  add(new Date(Date.UTC(year, 11, 25))); // 25 de Diciembre

  // Festivos sujetos a Ley Emiliani (se trasladan al siguiente lunes)
  add(moveToNextMonday(new Date(Date.UTC(year, 0, 6))));   // Reyes Magos (6 Ene)
  add(moveToNextMonday(new Date(Date.UTC(year, 2, 19))));  // San José (19 Mar)
  add(moveToNextMonday(new Date(Date.UTC(year, 5, 29))));  // San Pedro y San Pablo (29 Jun)
  add(moveToNextMonday(new Date(Date.UTC(year, 7, 15))));  // Asunción de la Virgen (15 Ago)
  add(moveToNextMonday(new Date(Date.UTC(year, 9, 12))));  // Día de la Raza (12 Oct)
  add(moveToNextMonday(new Date(Date.UTC(year, 10, 1))));  // Todos los Santos (1 Nov)
  add(moveToNextMonday(new Date(Date.UTC(year, 10, 11)))); // Independencia de Cartagena (11 Nov)

  // Festivos vinculados a Semana Santa y Pascua
  const easter = getEasterSunday(year);

  // Jueves Santo (Pascua - 3 días)
  const holyThursday = new Date(easter.getTime());
  holyThursday.setUTCDate(easter.getUTCDate() - 3);
  add(holyThursday);

  // Viernes Santo (Pascua - 2 días)
  const goodFriday = new Date(easter.getTime());
  goodFriday.setUTCDate(easter.getUTCDate() - 2);
  add(goodFriday);

  // Ascensión del Señor (Pascua + 40 días, trasladado al lunes = +43 días)
  const ascension = new Date(easter.getTime());
  ascension.setUTCDate(easter.getUTCDate() + 43);
  add(ascension);

  // Corpus Christi (Pascua + 60 días, trasladado al lunes = +64 días)
  const corpus = new Date(easter.getTime());
  corpus.setUTCDate(easter.getUTCDate() + 64);
  add(corpus);

  // Sagrado Corazón de Jesús (Pascua + 68 días, trasladado al lunes = +71 días)
  const sacredHeart = new Date(easter.getTime());
  sacredHeart.setUTCDate(easter.getUTCDate() + 71);
  add(sacredHeart);

  return holidays;
}

const holidaysCache = new Map();
function isColombianHoliday(date) {
  const year = date.getUTCFullYear();
  if (!holidaysCache.has(year)) {
    holidaysCache.set(year, getColombianHolidays(year));
  }
  const iso = date.toISOString().split('T')[0];
  return holidaysCache.get(year).has(iso);
}

function isBusinessDay(date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false; // Sábado o Domingo
  return !isColombianHoliday(date);
}

function checkIsBusiness(val) {
  if (!val) return true;
  const s = String(val).toLowerCase();
  if (s.includes('calen')) return false;
  return true;
}

// Cálculo de fecha fin dado fecha inicio y número de días
function computeEndDate(startDateStr, totalDays, isBusiness) {
  if (!startDateStr || !totalDays || totalDays <= 0) return null;
  const parts = startDateStr.split('-');
  const current = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

  if (!isBusiness) {
    // Días calendario continuos
    current.setUTCDate(current.getUTCDate() + totalDays - 1);
    return current.toISOString().split('T')[0];
  }

  // Días hábiles
  let added = 0;
  while (true) {
    if (isBusinessDay(current)) {
      added++;
      if (added >= totalDays) break;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return current.toISOString().split('T')[0];
}

// Conteo de días entre dos fechas
function computeDaysBetween(startDateStr, endDateStr, isBusiness) {
  if (!startDateStr || !endDateStr) return 0;
  const p1 = startDateStr.split('-');
  const p2 = endDateStr.split('-');
  const d1 = new Date(Date.UTC(parseInt(p1[0]), parseInt(p1[1]) - 1, parseInt(p1[2])));
  const d2 = new Date(Date.UTC(parseInt(p2[0]), parseInt(p2[1]) - 1, parseInt(p2[2])));

  if (d2 < d1) return 0;

  if (!isBusiness) {
    const diffMs = d2.getTime() - d1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  let count = 0;
  const cur = new Date(d1.getTime());
  while (cur <= d2) {
    if (isBusinessDay(cur)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// ─── Parser de Formatos Combinados de Duración (REQ-026) ─────────────────────
// Interpreta entradas como "1 año 2 meses 15 días", "6 meses", "45 días", "2 años"
function parseFlexibleDuration(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Debe especificar una duración válida.' };
  }

  const text = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (text.includes('permanente') || text.includes('indefinid') || text.includes('sin definir')) {
    return {
      valid: true,
      years: 0,
      months: 0,
      days: 0,
      isPermanent: true,
      totalDaysEquivalent: 0,
      formattedText: 'Permanente',
    };
  }

  let years = 0;
  let months = 0;
  let days = 0;

  // Regex para años (ano, anio, a, year)
  const yMatch = text.match(/(\d+)\s*(?:ano|anio|a|year)s?/i);
  if (yMatch) years = parseInt(yMatch[1], 10);

  // Regex para meses (mes, m, month)
  const mMatch = text.match(/(\d+)\s*(?:mes|m|month)es?/i);
  if (mMatch) months = parseInt(mMatch[1], 10);

  // Regex para días (dia, d, day)
  const dMatch = text.match(/(\d+)\s*(?:dia|d|day)s?/i);
  if (dMatch) days = parseInt(dMatch[1], 10);

  // Si solo puso un número entero puro sin unidades, asumimos días
  if (!yMatch && !mMatch && !dMatch) {
    const numOnly = parseInt(text.replace(/[^\d]/g, ''), 10);
    if (!isNaN(numOnly) && numOnly > 0) {
      days = numOnly;
    } else {
      return {
        valid: false,
        error: 'Formato no reconocido. Ejemplo: "1 año 2 meses 15 días", "6 meses" o "45 días".',
      };
    }
  }

  // Conversión a días calendario aproximados para validación de límite
  const totalDaysEquivalent = years * 365 + months * 30 + days;
  const maxDaysAllowed = 3 * 365; // Límite estricto de 3 años (1095 días)

  if (totalDaysEquivalent <= 0) {
    return { valid: false, error: 'La duración debe ser mayor a cero días.' };
  }

  if (totalDaysEquivalent > maxDaysAllowed) {
    return {
      valid: false,
      error: `La duración no puede exceder el límite legal de 3 años (1095 días). Su solicitud equivale a aprox. ${totalDaysEquivalent} días.`,
    };
  }

  // Construcción de texto amigable y legible
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);

  return {
    valid: true,
    years,
    months,
    days,
    totalDaysEquivalent,
    formattedText: parts.join(', ') || `${days} días`,
  };
}

// ─── Regla de Negocio REQ-025: Retorno Automático a Presencial por Caducidad ──
async function checkAndProcessExpirations() {
  try {
    // Buscar esquemas activos cuya fecha_fin ya pasó
    const expiredQuery = await pool.query(
      `SELECT * FROM horarios
       WHERE estado = 'Activa'
         AND modalidad IN ('Teletrabajo', 'Trabajo en casa', 'Horario flexible')
         AND fecha_fin IS NOT NULL
         AND fecha_fin < CURRENT_DATE`
    );

    const expiredRows = expiredQuery.rows;
    if (expiredRows.length === 0) return { expiredCount: 0 };

    for (const h of expiredRows) {
      // 1. Marcar el esquema anterior como Caducada / Finalizada
      await pool.query(
        `UPDATE horarios
         SET estado = 'Caducada',
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id_horario = $1`,
        [h.id_horario]
      );

      // 2. Registrar en historial_horarios
      await pool.query(
        `INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
         VALUES ($1, 'Caducidad Automática', 'Activa', 'Caducada',
                 $2, 'Sistema - Retorno Automático')`,
        [
          h.id_horario,
          `Vigencia vencida el ${h.fecha_fin}. El funcionario retorna automáticamente a la modalidad Presencial.`,
        ]
      );

      // 3. Crear o asegurar un esquema Presencial activo para este funcionario
      const presencialCheck = await pool.query(
        `SELECT id_horario FROM horarios
         WHERE documento = $1 AND modalidad = 'Presencial' AND estado = 'Activa'
         LIMIT 1`,
        [h.documento]
      );

      if (presencialCheck.rows.length === 0) {
        const newPres = await pool.query(
          `INSERT INTO horarios (
             documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
             fecha_inicio, duracion_texto, duracion_dias, tipo_calculo,
             numero_resolucion, aprobado_por, observaciones
           ) VALUES (
             $1, $2, $3, $4, 'Presencial', 'Activa',
             CURRENT_DATE, 'Permanente', 365, 'Hábiles',
             $5, 'Sistema Talento 360',
             $6
           ) RETURNING id_horario`,
          [
            h.documento,
            h.apellidos_nombres,
            h.dependencia,
            h.cargo,
            h.numero_resolucion ? `RET-${h.numero_resolucion}` : 'AUTO-RETORNO',
            `Retorno automático a modalidad Presencial tras caducidad de ${h.modalidad} anterior (vigente hasta ${h.fecha_fin}).`,
          ]
        );

        if (newPres.rows.length > 0) {
          await pool.query(
            `INSERT INTO historial_horarios (id_horario, accion, estado_nuevo, nota, actualizado_por)
             VALUES ($1, 'Activación Presencial Automática', 'Activa',
                     'Esquema presencial generado automáticamente por caducidad de modalidad especial anterior.', 'Sistema - Retorno Automático')`,
            [newPres.rows[0].id_horario]
          );
        }
      }

      // 4. Si la modalidad vencida era "Trabajo en casa", reanudar cualquier vacación que hubiera estado pausada
      if (h.modalidad === 'Trabajo en casa') {
        const pausedVacs = await pool.query(
          `SELECT id_vacacion, observaciones FROM vacaciones
           WHERE documento = $1 AND estado ILIKE '%Pausada%'`,
          [h.documento]
        );

        for (const v of pausedVacs.rows) {
          await pool.query(
            `UPDATE vacaciones
             SET estado = 'Aprobada',
                 observaciones = COALESCE(observaciones,'') || ' [Reanudadas automáticamente al caducar Trabajo en casa]'
             WHERE id_vacacion = $1`,
            [v.id_vacacion]
          );

          await pool.query(
            `INSERT INTO historial_solicitudes (id_vacacion, estado_nuevo, nota, actualizado_por)
             VALUES ($1, 'Aprobada', 'Vacaciones reanudadas automáticamente por finalización del periodo de Trabajo en casa.', 'Sistema Horarios')`,
            [v.id_vacacion]
          ).catch(() => {});
        }
      }
    }

    return { expiredCount: expiredRows.length };
  } catch (err) {
    console.error('[horarios-service] Error procesando caducidades:', err);
    return { error: err.message };
  }
}

// ─── Regla de Negocio REQ-024: Pausa de Vacaciones por 'Trabajo en casa' ──────
async function handleVacationPauseForHomeOffice(documento, funcionarioNombre, resId, reqUser) {
  try {
    // Buscar vacaciones en estado Aprobada o Pendiente para este funcionario
    const vacs = await pool.query(
      `SELECT id_vacacion, estado, observaciones FROM vacaciones
       WHERE documento = $1 AND estado IN ('Aprobada', 'Pendiente', 'En revisión')`,
      [documento]
    );

    const pausedIds = [];
    for (const v of vacs.rows) {
      const notaPausa = ` [Vacaciones pausadas por aprobación de Trabajo en casa Res. ${resId || 'S/N'}]`;
      await pool.query(
        `UPDATE vacaciones
         SET estado = 'Pausada (Trabajo en casa)',
             observaciones = COALESCE(observaciones, '') || $1
         WHERE id_vacacion = $2`,
        [notaPausa, v.id_vacacion]
      );

      await pool.query(
        `INSERT INTO historial_solicitudes (id_vacacion, estado_nuevo, nota, actualizado_por)
         VALUES ($1, 'Pausada (Trabajo en casa)', $2, $3)`,
        [
          v.id_vacacion,
          `Pausa automática del conteo de vacaciones por resolución de Trabajo en casa (${resId || 'S/N'}).`,
          reqUser || 'Sistema Horarios',
        ]
      ).catch(() => {});

      pausedIds.push(v.id_vacacion);
    }

    return pausedIds;
  } catch (err) {
    console.error('[horarios-service] Error pausando vacaciones:', err);
    return [];
  }
}

// ─── GET /api/horarios ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const {
    q = '',
    modalidad = '',
    estado = '',
    dependencia = '',
    page = 1,
    limit = 20,
  } = req.query;

  try {
    // Ejecutar verificación de vencimientos y retorno a presencial antes de responder (REQ-025)
    await checkAndProcessExpirations();

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (modalidad && modalidad !== 'Todas') {
      conditions.push(`modalidad = $${idx++}`);
      params.push(modalidad);
    }

    if (estado && estado !== 'Todos') {
      conditions.push(`LOWER(estado) = LOWER($${idx++})`);
      params.push(estado);
    }

    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia}%`);
    }

    if (q) {
      conditions.push(
        `(LOWER(apellidos_nombres) LIKE LOWER($${idx}) OR documento LIKE $${idx} OR LOWER(dependencia) LIKE LOWER($${idx}) OR LOWER(COALESCE(numero_resolucion,'')) LIKE LOWER($${idx}))`
      );
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM horarios WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const query = `
      SELECT * FROM horarios
      WHERE ${where}
      ORDER BY id_horario DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const result = await pool.query(query, params);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: result.rows,
    });
  } catch (err) {
    console.error('[horarios-service] Error en GET /:', err);
    res.status(500).json({ error: 'Error al consultar horarios: ' + err.message });
  }
});

// ─── GET /api/horarios/stats ─────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    await checkAndProcessExpirations();

    const statsQuery = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE modalidad = 'Presencial') AS presencial,
        COUNT(*) FILTER (WHERE modalidad = 'Teletrabajo') AS teletrabajo,
        COUNT(*) FILTER (WHERE modalidad = 'Trabajo en casa') AS trabajo_en_casa,
        COUNT(*) FILTER (WHERE modalidad = 'Horario flexible') AS horario_flexible,
        COUNT(*) FILTER (WHERE estado = 'Activa') AS activas,
        COUNT(*) FILTER (WHERE estado = 'Caducada') AS caducadas,
        COUNT(*) FILTER (WHERE estado = 'Activa' AND fecha_fin IS NOT NULL AND fecha_fin <= CURRENT_DATE + INTERVAL '30 days') AS por_vencer
      FROM horarios
    `);

    const r = statsQuery.rows[0];
    res.json({
      total: parseInt(r.total || 0, 10),
      presencial: parseInt(r.presencial || 0, 10),
      teletrabajo: parseInt(r.teletrabajo || 0, 10),
      trabajoEnCasa: parseInt(r.trabajo_en_casa || 0, 10),
      horarioFlexible: parseInt(r.horario_flexible || 0, 10),
      activas: parseInt(r.activas || 0, 10),
      caducadas: parseInt(r.caducadas || 0, 10),
      porVencer: parseInt(r.por_vencer || 0, 10),
    });
  } catch (err) {
    console.error('[horarios-service] Error en stats:', err);
    res.status(500).json({ error: 'Error calculando métricas: ' + err.message });
  }
});

// ─── POST /api/horarios/calculate-dates ───────────────────────────────────────
// Endpoint de utilidad para recálculo en vivo de días hábiles/calendario y validación
router.post('/calculate-dates', auth, (req, res) => {
  const { fechaInicio, duracionTexto, tipoCalculo = 'Hábiles', fechaFin } = req.body;

  if (!fechaInicio) {
    return res.status(400).json({ error: 'La fecha de inicio es requerida.' });
  }

  const isBusiness = checkIsBusiness(tipoCalculo);

  if (duracionTexto) {
    const parseRes = parseFlexibleDuration(duracionTexto);
    if (!parseRes.valid) {
      return res.status(400).json({ error: parseRes.error });
    }

    if (parseRes.isPermanent) {
      return res.json({
        valid: true,
        fechaInicio,
        fechaFin: null,
        duracionTexto: 'Permanente',
        duracionDias: 0,
        tipoCalculo: isBusiness ? 'Hábiles' : 'Calendario',
      });
    }

    const calculatedEndDate = computeEndDate(fechaInicio, parseRes.totalDaysEquivalent, isBusiness);
    return res.json({
      valid: true,
      fechaInicio,
      fechaFin: calculatedEndDate,
      duracionTexto: parseRes.formattedText,
      duracionDias: parseRes.totalDaysEquivalent,
      tipoCalculo: isBusiness ? 'Hábiles' : 'Calendario',
    });
  }

  if (fechaFin) {
    const days = computeDaysBetween(fechaInicio, fechaFin, isBusiness);
    return res.json({
      valid: true,
      fechaInicio,
      fechaFin,
      duracionDias: days,
      duracionTexto: `${days} días ${isBusiness ? 'hábiles' : 'calendario'}`,
      tipoCalculo: isBusiness ? 'Hábiles' : 'Calendario',
    });
  }

  return res.status(400).json({ error: 'Especifique duración o fecha fin.' });
});

// ─── GET /api/horarios/:id ───────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const scheduleRes = await pool.query('SELECT * FROM horarios WHERE id_horario = $1', [id]);
    if (scheduleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Esquema de horario no encontrado.' });
    }

    const histRes = await pool.query(
      'SELECT * FROM historial_horarios WHERE id_horario = $1 ORDER BY id_historial DESC',
      [id]
    );

    res.json({
      horario: scheduleRes.rows[0],
      historial: histRes.rows,
    });
  } catch (err) {
    console.error('[horarios-service] Error consultando horario:', err);
    res.status(500).json({ error: 'Error en la consulta: ' + err.message });
  }
});

// ─── POST /api/horarios/bulk (Carga Masiva Excel) ─────────────────────────────
router.post('/bulk', auth, async (req, res) => {
  if (!canEdit(req.user.role || req.user.rol)) {
    return res.status(403).json({ error: 'Permisos insuficientes para carga masiva.' });
  }

  const rows = Array.isArray(req.body.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : [];
  if (!rows.length) {
    return res.status(400).json({ error: 'No se recibieron registros para importar.' });
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const documento = (row.documento || row.cedula || row['Documento'] || row['Cédula'] || '').toString().trim();
      const apellidos_nombres = (row.apellidos_nombres || row.persona || row.nombreCompleto || row['Servidor Público'] || row['Nombres y Apellidos'] || '').toString().trim();
      const dependencia = (row.dependencia || row['Dependencia'] || 'SECRETARÍA GENERAL').toString().trim();
      const cargo = (row.cargo || row['Cargo'] || 'PROFESIONAL UNIVERSITARIO').toString().trim();

      let modalidad = (row.modalidad || row['Modalidad'] || 'Presencial').toString().trim();
      const matchedMod = VALID_MODALIDADES.find((m) => m.toLowerCase() === modalidad.toLowerCase());
      modalidad = matchedMod || 'Presencial';

      let estado = (row.estado || row['Estado'] || 'Activa').toString().trim();
      const matchedEst = VALID_ESTADOS.find((e) => e.toLowerCase() === estado.toLowerCase());
      estado = matchedEst || 'Activa';

      let fecha_inicio = (row.fecha_inicio || row.fechaInicio || row['Fecha Inicio'] || row['Inicio'] || '').toString().trim();
      if (!fecha_inicio) {
        fecha_inicio = new Date().toISOString().split('T')[0];
      } else if (fecha_inicio.includes('/')) {
        const parts = fecha_inicio.split('/');
        if (parts.length === 3) {
          fecha_inicio = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let duracion_texto = (
        row.duracion_texto ||
        row.duracion ||
        row['Duración'] ||
        row['Duracion'] ||
        (modalidad === 'Presencial' ? 'Permanente' : '1 año')
      ).toString().trim();
      let tipo_calculo = (row.tipo_calculo || row.tipoCalculo || row['Tipo Cómputo'] || row['Tipo Calculo'] || 'Hábiles').toString().trim();
      const isBusiness = checkIsBusiness(tipo_calculo);

      let finalDuracionTexto = duracion_texto;
      let finalDuracionDias = 0;
      let finalFechaFin = null;

      if (/^(permanente|indefinid|sin definir)/i.test(duracion_texto)) {
        finalDuracionTexto = 'Permanente';
        finalDuracionDias = 0;
        finalFechaFin = null;
      } else {
        const parseRes = parseFlexibleDuration(duracion_texto);
        if (parseRes.valid) {
          finalDuracionTexto = parseRes.formattedText;
          finalDuracionDias = parseRes.totalDaysEquivalent;
          finalFechaFin = computeEndDate(fecha_inicio, finalDuracionDias, isBusiness);
        } else {
          finalDuracionTexto = duracion_texto;
          finalDuracionDias = 30;
          finalFechaFin = computeEndDate(fecha_inicio, 30, isBusiness);
        }
      }

      const numero_resolucion = (
        row.numero_resolucion ||
        row.resolucion ||
        row['Número Resolución'] ||
        row['Resolución'] ||
        `RES-2026-${String(Math.floor(1000 + Math.random() * 9000))}`
      ).toString().trim();
      const aprobado_por = (row.aprobado_por || row['Aprobado Por'] || req.user.name || 'Angela Ussa').toString().trim();
      const observaciones = (row.observaciones || row['Observaciones'] || 'Carga Masiva Excel').toString().trim();

      if (!documento || !apellidos_nombres) {
        errors.push(`Fila ${i + 1}: Cédula y Nombre son obligatorios.`);
        skipped++;
        continue;
      }

      const ins = await client.query(
        `INSERT INTO horarios (
           documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
           fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
           numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por,
           observaciones, creado_por
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, CURRENT_DATE, CURRENT_DATE, $13,
           $14, $15
         ) RETURNING id_horario`,
        [
          documento,
          apellidos_nombres.toUpperCase(),
          dependencia.toUpperCase(),
          cargo.toUpperCase(),
          modalidad,
          estado,
          fecha_inicio,
          finalFechaFin,
          finalDuracionTexto,
          finalDuracionDias,
          isBusiness ? 'Hábiles' : 'Calendario',
          numero_resolucion,
          aprobado_por,
          observaciones,
          req.user.name || 'Carga Masiva',
        ]
      );

      const newId = ins.rows[0].id_horario;
      await client.query(
        `INSERT INTO historial_horarios (id_horario, accion, estado_nuevo, nota, actualizado_por)
         VALUES ($1, 'Creación Masiva', $2, 'Carga masiva desde archivo Excel.', $3)`,
        [newId, estado, req.user.name || 'Carga Masiva']
      );

      inserted++;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Se importaron ${inserted} esquemas de horario exitosamente.${skipped ? ` (${skipped} omitidos)` : ''}`,
      inserted,
      skipped,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[horarios] bulk error:', err.message);
    res.status(500).json({ error: 'Error durante la carga masiva: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/horarios ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  if (!canEdit(req.user.role || req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para crear esquemas de horarios.' });
  }

  const {
    documento,
    apellidos_nombres,
    dependencia,
    cargo,
    modalidad,
    estado = 'Activa',
    fecha_inicio,
    fecha_fin,
    duracion_texto,
    tipo_calculo = 'Hábiles',

    // REQ-028 Metadata administrativa
    numero_resolucion,
    fecha_aprobacion,
    fecha_notificacion,
    aprobado_por,
    soporte_acto,

    // Teletrabajo
    subtipo_teletrabajo,
    dias_teletrabajo,
    dias_presencial,
    domicilio_laboral,
    notificacion_arl,
    fecha_reporte_arl,

    // Trabajo en casa
    motivo_trabajo_casa,
    direccion_trabajo_casa,
    herramientas_tic,
    prorroga,

    // Horario flexible
    franja_ingreso,
    franja_salida,
    horas_semanales = 40,
    tiempo_almuerzo = '1 hora',
    justificacion_flex,

    observaciones,
  } = req.body;

  if (!documento || !apellidos_nombres || !modalidad || !fecha_inicio) {
    return res.status(400).json({
      error: 'Documento, Nombre, Modalidad y Fecha de Inicio son obligatorios.',
    });
  }

  if (!VALID_MODALIDADES.includes(modalidad)) {
    return res.status(400).json({
      error: `Modalidad inválida. Debe ser una de: ${VALID_MODALIDADES.join(', ')}`,
    });
  }

  // Parsear y validar duración flexible (REQ-026)
  const isBusiness = checkIsBusiness(tipo_calculo);
  let finalDuracionTexto = duracion_texto || '';
  let finalDuracionDias = 1;
  let finalFechaFin = fecha_fin || null;

  if (duracion_texto) {
    const parseRes = parseFlexibleDuration(duracion_texto);
    if (!parseRes.valid) {
      return res.status(400).json({ error: parseRes.error });
    }
    finalDuracionTexto = parseRes.formattedText;
    finalDuracionDias = parseRes.totalDaysEquivalent;
    if (!finalFechaFin) {
      finalFechaFin = computeEndDate(fecha_inicio, finalDuracionDias, isBusiness);
    }
  } else if (fecha_fin) {
    finalDuracionDias = computeDaysBetween(fecha_inicio, fecha_fin, isBusiness);
    finalDuracionTexto = `${finalDuracionDias} días ${isBusiness ? 'hábiles' : 'calendario'}`;
  } else if (modalidad === 'Presencial') {
    // Para presencial permanente por defecto
    finalDuracionDias = 365;
    finalDuracionTexto = 'Permanente';
  }

  // Validación de metadatos administrativos (REQ-028)
  if (fecha_aprobacion && fecha_notificacion) {
    if (new Date(fecha_notificacion) < new Date(fecha_aprobacion)) {
      return res.status(400).json({
        error: 'La fecha de notificación no puede ser anterior a la fecha de aprobación de la resolución.',
      });
    }
  }

  try {
    const insertRes = await pool.query(
      `INSERT INTO horarios (
         documento, apellidos_nombres, dependencia, cargo, modalidad, estado,
         fecha_inicio, fecha_fin, duracion_texto, duracion_dias, tipo_calculo,
         numero_resolucion, fecha_aprobacion, fecha_notificacion, aprobado_por, soporte_acto,
         subtipo_teletrabajo, dias_teletrabajo, dias_presencial, domicilio_laboral, notificacion_arl, fecha_reporte_arl,
         motivo_trabajo_casa, direccion_trabajo_casa, herramientas_tic, prorroga,
         franja_ingreso, franja_salida, horas_semanales, tiempo_almuerzo, justificacion_flex,
         observaciones, creado_por
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22,
         $23, $24, $25, $26,
         $27, $28, $29, $30, $31,
         $32, $33
       ) RETURNING *`,
      [
        upper(documento),
        upper(apellidos_nombres),
        upper(dependencia || 'SECRETARÍA GENERAL'),
        upper(cargo || 'PROFESIONAL UNIVERSITARIO'),
        modalidad,
        estado || 'Activa',
        fecha_inicio,
        finalFechaFin,
        finalDuracionTexto,
        finalDuracionDias,
        isBusiness ? 'Hábiles' : 'Calendario',
        numero_resolucion ? upper(numero_resolucion) : null,
        fecha_aprobacion || null,
        fecha_notificacion || null,
        aprobado_por || 'Angela Ussa',
        soporte_acto || null,
        subtipo_teletrabajo || null,
        dias_teletrabajo || null,
        dias_presencial || null,
        domicilio_laboral || null,
        Boolean(notificacion_arl),
        fecha_reporte_arl || null,
        motivo_trabajo_casa || null,
        direccion_trabajo_casa || null,
        herramientas_tic || null,
        Boolean(prorroga),
        franja_ingreso || null,
        franja_salida || null,
        parseInt(horas_semanales, 10) || 40,
        tiempo_almuerzo || '1 hora',
        justificacion_flex || null,
        observaciones || null,
        req.user.username || 'admin',
      ]
    );

    const created = insertRes.rows[0];

    // Registrar en auditoría / historial
    await pool.query(
      `INSERT INTO historial_horarios (id_horario, accion, estado_nuevo, nota, actualizado_por)
       VALUES ($1, 'Creación', $2, $3, $4)`,
      [
        created.id_horario,
        created.estado,
        `Creación de esquema de modalidad ${modalidad}. Res: ${numero_resolucion || 'N/A'}. Duración: ${finalDuracionTexto}.`,
        req.user.name || req.user.username || 'Admin',
      ]
    );

    // REQ-024: Si es "Trabajo en casa" y está activa/aprobada, pausar automáticamente las vacaciones
    let pausedVacations = [];
    if (modalidad === 'Trabajo en casa' && (estado === 'Activa' || estado === 'Aprobada')) {
      pausedVacations = await handleVacationPauseForHomeOffice(
        created.documento,
        created.apellidos_nombres,
        numero_resolucion,
        req.user.username
      );
    }

    res.status(201).json({
      message: 'Esquema de horario creado exitosamente.',
      data: created,
      pausedVacationsCount: pausedVacations.length,
      pausedVacations,
    });
  } catch (err) {
    console.error('[horarios-service] Error creando horario:', err);
    res.status(500).json({ error: 'Error al registrar horario: ' + err.message });
  }
});

// ─── PUT /api/horarios/:id ───────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role || req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para modificar esquemas.' });
  }

  const { id } = req.params;
  const currentQ = await pool.query('SELECT * FROM horarios WHERE id_horario = $1', [id]);
  if (currentQ.rows.length === 0) {
    return res.status(404).json({ error: 'Esquema de horario no encontrado.' });
  }
  const current = currentQ.rows[0];

  const {
    dependencia = current.dependencia,
    cargo = current.cargo,
    modalidad = current.modalidad,
    estado = current.estado,
    fecha_inicio = current.fecha_inicio,
    fecha_fin = current.fecha_fin,
    duracion_texto = current.duracion_texto,
    tipo_calculo = current.tipo_calculo,

    numero_resolucion = current.numero_resolucion,
    fecha_aprobacion = current.fecha_aprobacion,
    fecha_notificacion = current.fecha_notificacion,
    aprobado_por = current.aprobado_por,
    soporte_acto = current.soporte_acto,

    subtipo_teletrabajo = current.subtipo_teletrabajo,
    dias_teletrabajo = current.dias_teletrabajo,
    dias_presencial = current.dias_presencial,
    domicilio_laboral = current.domicilio_laboral,
    notificacion_arl = current.notificacion_arl,
    fecha_reporte_arl = current.fecha_reporte_arl,

    motivo_trabajo_casa = current.motivo_trabajo_casa,
    direccion_trabajo_casa = current.direccion_trabajo_casa,
    herramientas_tic = current.herramientas_tic,
    prorroga = current.prorroga,

    franja_ingreso = current.franja_ingreso,
    franja_salida = current.franja_salida,
    horas_semanales = current.horas_semanales,
    tiempo_almuerzo = current.tiempo_almuerzo,
    justificacion_flex = current.justificacion_flex,

    observaciones = current.observaciones,
  } = req.body;

  try {
    const isBusiness = checkIsBusiness(tipo_calculo);
    let finalDuracionTexto = duracion_texto;
    let finalDuracionDias = current.duracion_dias;
    let finalFechaFin = fecha_fin;

    if (duracion_texto && duracion_texto !== current.duracion_texto) {
      const parseRes = parseFlexibleDuration(duracion_texto);
      if (!parseRes.valid) return res.status(400).json({ error: parseRes.error });
      finalDuracionTexto = parseRes.formattedText;
      finalDuracionDias = parseRes.totalDaysEquivalent;
      finalFechaFin = computeEndDate(fecha_inicio, finalDuracionDias, isBusiness);
    }

    const updateRes = await pool.query(
      `UPDATE horarios SET
         dependencia = $1, cargo = $2, modalidad = $3, estado = $4,
         fecha_inicio = $5, fecha_fin = $6, duracion_texto = $7, duracion_dias = $8, tipo_calculo = $9,
         numero_resolucion = $10, fecha_aprobacion = $11, fecha_notificacion = $12, aprobado_por = $13, soporte_acto = $14,
         subtipo_teletrabajo = $15, dias_teletrabajo = $16, dias_presencial = $17, domicilio_laboral = $18, notificacion_arl = $19, fecha_reporte_arl = $20,
         motivo_trabajo_casa = $21, direccion_trabajo_casa = $22, herramientas_tic = $23, prorroga = $24,
         franja_ingreso = $25, franja_salida = $26, horas_semanales = $27, tiempo_almuerzo = $28, justificacion_flex = $29,
         observaciones = $30, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_horario = $31
       RETURNING *`,
      [
        upper(dependencia),
        upper(cargo),
        modalidad,
        estado,
        fecha_inicio,
        finalFechaFin,
        finalDuracionTexto,
        finalDuracionDias,
        isBusiness ? 'Hábiles' : 'Calendario',
        numero_resolucion ? upper(numero_resolucion) : null,
        fecha_aprobacion || null,
        fecha_notificacion || null,
        aprobado_por,
        soporte_acto,
        subtipo_teletrabajo,
        dias_teletrabajo,
        dias_presencial,
        domicilio_laboral,
        Boolean(notificacion_arl),
        fecha_reporte_arl || null,
        motivo_trabajo_casa,
        direccion_trabajo_casa,
        herramientas_tic,
        Boolean(prorroga),
        franja_ingreso,
        franja_salida,
        parseInt(horas_semanales, 10) || 40,
        tiempo_almuerzo,
        justificacion_flex,
        observaciones,
        id,
      ]
    );

    const updated = updateRes.rows[0];

    // Auditoría
    await pool.query(
      `INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
       VALUES ($1, 'Actualización', $2, $3, 'Actualización de campos del esquema.', $4)`,
      [id, current.estado, updated.estado, req.user.name || req.user.username || 'Admin']
    );

    // Si cambió a Trabajo en casa y está activa, pausar vacaciones (REQ-024)
    if (modalidad === 'Trabajo en casa' && (estado === 'Activa' || estado === 'Aprobada')) {
      await handleVacationPauseForHomeOffice(
        updated.documento,
        updated.apellidos_nombres,
        updated.numero_resolucion,
        req.user.username
      );
    }

    res.json({ message: 'Horario actualizado correctamente.', data: updated });
  } catch (err) {
    console.error('[horarios-service] Error actualizando horario:', err);
    res.status(500).json({ error: 'Error al actualizar horario: ' + err.message });
  }
});

// ─── PATCH /api/horarios/:id/status ──────────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  if (!canEdit(req.user.role || req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para modificar estados.' });
  }

  const { id } = req.params;
  const { estado, nota = '' } = req.body;

  if (!estado) return res.status(400).json({ error: 'El estado es obligatorio.' });

  try {
    const curQ = await pool.query('SELECT * FROM horarios WHERE id_horario = $1', [id]);
    if (curQ.rows.length === 0) return res.status(404).json({ error: 'Horario no encontrado.' });
    const current = curQ.rows[0];

    const updateRes = await pool.query(
      `UPDATE horarios SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_horario = $2 RETURNING *`,
      [estado, id]
    );
    const updated = updateRes.rows[0];

    await pool.query(
      `INSERT INTO historial_horarios (id_horario, accion, estado_anterior, estado_nuevo, nota, actualizado_por)
       VALUES ($1, 'Cambio de Estado', $2, $3, $4, $5)`,
      [
        id,
        current.estado,
        estado,
        nota || `Cambio de estado a ${estado}`,
        req.user.name || req.user.username || 'Admin',
      ]
    );

    // REQ-024: Si cambió a Activa en Trabajo en casa
    let pausedVacations = [];
    if (updated.modalidad === 'Trabajo en casa' && (estado === 'Activa' || estado === 'Aprobada')) {
      pausedVacations = await handleVacationPauseForHomeOffice(
        updated.documento,
        updated.apellidos_nombres,
        updated.numero_resolucion,
        req.user.username
      );
    }

    res.json({
      message: `Estado actualizado a ${estado}`,
      data: updated,
      pausedVacationsCount: pausedVacations.length,
    });
  } catch (err) {
    console.error('[horarios-service] Error actualizando estado:', err);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

// ─── DELETE /api/horarios/:id ────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  if (!canEdit(req.user.role || req.user.rol)) {
    return res.status(403).json({ error: 'No tienes permisos para eliminar horarios.' });
  }

  const { id } = req.params;
  try {
    const del = await pool.query('DELETE FROM horarios WHERE id_horario = $1 RETURNING id_horario', [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: 'Horario no encontrado.' });

    res.json({ message: 'Esquema de horario eliminado exitosamente.' });
  } catch (err) {
    console.error('[horarios-service] Error eliminando:', err);
    res.status(500).json({ error: 'Error al eliminar: ' + err.message });
  }
});

// ─── POST /api/horarios/check-expirations ─────────────────────────────────────
router.post('/check-expirations', auth, async (req, res) => {
  const result = await checkAndProcessExpirations();
  res.json({
    message: 'Verificación de caducidades y retorno a presencial completada.',
    ...result,
  });
});

module.exports = router;
