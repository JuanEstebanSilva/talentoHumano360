const crypto = require('crypto');
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');

const storage = require('../utils/storage');
const { canRead, canWrite, canViewSensitive, canAccessRequests } = require('../utils/permissions');
const { MAX_FILE_SIZE, validateFile, sanitizeFilename, decodeUploadName, canDisplayInline } = require('../utils/fileValidation');
const { extractCedulaCandidates, suggestTipo } = require('../utils/classifier');
const { createInbox, InboxRejection } = require('../utils/inbox');

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

const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single('archivo');

// ─── Middlewares ──────────────────────────────────────────────────────────────
function auth(req, res, next) {
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o sesión expirada.' });
  }
  if (!canRead(req.user)) {
    return res.status(403).json({ error: 'No tienes acceso al módulo de documentos.' });
  }
  next();
}

function requireWrite(req, res, next) {
  if (!canWrite(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  next();
}

function requireSensitive(req, res, next) {
  if (!canViewSensitive(req.user)) return res.status(403).json({ error: 'Permisos insuficientes.' });
  next();
}

function receiveFile(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo supera el tamaño máximo de 25 MB.' });
    }
    if (err) return res.status(400).json({ error: 'No se pudo recibir el archivo.' });
    if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un archivo.' });
    req.file.originalname = sanitizeFilename(decodeUploadName(req.file.originalname));
    const checked = validateFile(req.file.buffer, req.file.originalname);
    if (checked.error) return res.status(400).json({ error: checked.error });
    req.fileType = checked;
    req.fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    next();
  });
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function sendError(res, err, context) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  console.error(`[documents] ${context}:`, err.message);
  return res.status(500).json({ error: 'Error interno del módulo de documentos.' });
}

function actor(req) {
  return String(req.user.username || 'desconocido').slice(0, 160);
}

async function logEvent(db, req, idDocumento, accion, detalle) {
  await db.query(
    'INSERT INTO documento_eventos (id_documento, accion, detalle, usuario, ip) VALUES ($1, $2, $3, $4, $5)',
    [idDocumento, accion, detalle ? String(detalle).slice(0, 500) : null, actor(req), String(req.ip || '').slice(0, 80)]
  );
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(404, 'Documento no encontrado.');
  return id;
}

function cleanText(value, maxLength) {
  const text = value == null ? '' : String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function parseDate(value) {
  const text = cleanText(value, 10);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new HttpError(400, 'La fecha del documento debe tener el formato AAAA-MM-DD.');
  }
  return text;
}

function normalizeCedula(value) {
  return String(value || '').replace(/[.,\s]/g, '');
}

async function findServidor(db, cedula) {
  const clean = normalizeCedula(cedula);
  if (!clean) return null;
  const { rows } = await db.query(
    `SELECT cedula,
            COALESCE(nombre_completo, TRIM(CONCAT(primer_apellido, ' ', segundo_apellido, ' ', nombres))) AS nombre
       FROM personas
      WHERE REPLACE(REPLACE(cedula, '.', ''), ' ', '') = $1
        AND COALESCE(es_vacante, FALSE) = FALSE
      LIMIT 1`,
    [clean]
  );
  return rows[0] || null;
}

async function getTipo(db, idTipo, user) {
  const id = Number(idTipo);
  const { rows } = Number.isInteger(id)
    ? await db.query('SELECT * FROM tipos_documento WHERE id_tipo = $1 AND activo = TRUE', [id])
    : { rows: [] };
  if (!rows[0]) throw new HttpError(400, 'El tipo de documento no existe o está inactivo.');
  if (rows[0].es_sensible && !canViewSensitive(user)) {
    throw new HttpError(403, 'No tienes permiso para gestionar documentos de este tipo.');
  }
  return rows[0];
}

const DOC_SELECT = `
  SELECT d.*, v.nombre_original, v.mime_type, v.tamano_bytes, v.subido_en, v.subido_por,
         t.nombre AS tipo_nombre, t.categoria AS tipo_categoria,
         ts.nombre AS tipo_sugerido_nombre,
         COALESCE(t.es_sensible, ts.es_sensible, FALSE) AS es_sensible
    FROM documentos d
    JOIN documento_versiones v ON v.id_documento = d.id_documento AND v.numero = d.version_actual
    LEFT JOIN tipos_documento t  ON t.id_tipo  = d.id_tipo
    LEFT JOIN tipos_documento ts ON ts.id_tipo = d.id_tipo_sugerido`;

// Un documento pendiente con tipo sugerido sensible se protege desde que entra a la bandeja.
function visibilityClause(user) {
  const conditions = ['d.eliminado_en IS NULL'];
  if (!canViewSensitive(user)) conditions.push('COALESCE(t.es_sensible, ts.es_sensible, FALSE) = FALSE');
  if (!canWrite(user)) conditions.push(`d.estado = 'Clasificado'`);
  return conditions;
}

function toDto(row) {
  return {
    id: row.id_documento,
    titulo: row.titulo,
    descripcion: row.descripcion,
    estado: row.estado,
    cedula: row.cedula,
    nombreServidor: row.nombre_servidor,
    idTipo: row.id_tipo,
    tipoNombre: row.tipo_nombre,
    tipoCategoria: row.tipo_categoria,
    esSensible: row.es_sensible,
    fechaDocumento: row.fecha_documento ? formatDate(row.fecha_documento) : null,
    versionActual: row.version_actual,
    nombreArchivo: row.nombre_original,
    mimeType: row.mime_type,
    tamanoBytes: Number(row.tamano_bytes),
    subidoEn: row.subido_en,
    subidoPor: row.subido_por,
    sugerencia: row.estado === 'Pendiente' ? {
      cedula: row.cedula_sugerida,
      nombreServidor: row.nombre_sugerido,
      idTipo: row.id_tipo_sugerido,
      tipoNombre: row.tipo_sugerido_nombre,
    } : null,
  };
}

function formatDate(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

// Carga el documento solo si este usuario puede verlo. Si no puede, responde 404
// para no revelar que existe un documento sensible con ese identificador.
async function loadVisible(db, id, user) {
  const conditions = visibilityClause(user);
  const { rows } = await db.query(`${DOC_SELECT} WHERE d.id_documento = $1 AND ${conditions.join(' AND ')}`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Documento no encontrado.');
  return rows[0];
}

// ─── Tipos de documento ───────────────────────────────────────────────────────
router.get('/tipos', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_tipo AS id, codigo, nombre, categoria, palabras_clave AS "palabrasClave",
              es_sensible AS "esSensible", activo
         FROM tipos_documento
        WHERE ($1::boolean OR es_sensible = FALSE)
        ORDER BY categoria, nombre`,
      [canViewSensitive(req.user)]
    );
    return res.json({ data: rows });
  } catch (err) {
    return sendError(res, err, 'tipos');
  }
});

router.post('/tipos', auth, requireSensitive, async (req, res) => {
  const nombre = cleanText(req.body?.nombre, 160);
  if (!nombre) return res.status(400).json({ error: 'El nombre del tipo es obligatorio.' });
  const codigo = nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  try {
    const { rows } = await pool.query(
      `INSERT INTO tipos_documento (codigo, nombre, categoria, palabras_clave, es_sensible)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (codigo) DO NOTHING
       RETURNING id_tipo AS id`,
      [codigo, nombre, cleanText(req.body?.categoria, 80) || 'General', cleanText(req.body?.palabrasClave, 1000) || '', req.body?.esSensible === true]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Ya existe un tipo de documento con ese nombre.' });
    return res.status(201).json({ id: rows[0].id });
  } catch (err) {
    return sendError(res, err, 'crear tipo');
  }
});

router.patch('/tipos/:id', auth, requireSensitive, async (req, res) => {
  const b = req.body || {};
  const nombre = b.nombre === undefined ? null : cleanText(b.nombre, 160);
  if (b.nombre !== undefined && !nombre) return res.status(400).json({ error: 'El nombre del tipo es obligatorio.' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE tipos_documento
          SET nombre = COALESCE($2, nombre),
              categoria = COALESCE($3, categoria),
              palabras_clave = COALESCE($4, palabras_clave),
              es_sensible = COALESCE($5, es_sensible),
              activo = COALESCE($6, activo)
        WHERE id_tipo = $1`,
      [
        parseId(req.params.id),
        nombre,
        b.categoria === undefined ? null : cleanText(b.categoria, 80),
        b.palabrasClave === undefined ? null : String(b.palabrasClave).slice(0, 1000),
        typeof b.esSensible === 'boolean' ? b.esSensible : null,
        typeof b.activo === 'boolean' ? b.activo : null,
      ]
    );
    if (!rowCount) return res.status(404).json({ error: 'Tipo de documento no encontrado.' });
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'actualizar tipo');
  }
});

// ─── Consulta ─────────────────────────────────────────────────────────────────
router.get('/resumen', auth, async (req, res) => {
  try {
    const conditions = visibilityClause(req.user);
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE d.estado = 'Pendiente')   AS pendientes,
              COUNT(*) FILTER (WHERE d.estado = 'Clasificado') AS clasificados,
              COUNT(DISTINCT d.cedula)                         AS servidores
         FROM documentos d
         LEFT JOIN tipos_documento t  ON t.id_tipo  = d.id_tipo
         LEFT JOIN tipos_documento ts ON ts.id_tipo = d.id_tipo_sugerido
        WHERE ${conditions.join(' AND ')}`
    );
    return res.json({
      pendientes: Number(rows[0].pendientes),
      clasificados: Number(rows[0].clasificados),
      servidores: Number(rows[0].servidores),
    });
  } catch (err) {
    return sendError(res, err, 'resumen');
  }
});

router.get('/', auth, async (req, res) => {
  const { q, cedula, idTipo, estado } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const conditions = visibilityClause(req.user);
  const params = [];
  const addParam = (value) => { params.push(value); return `$${params.length}`; };

  if (typeof q === 'string' && q.trim()) {
    const term = addParam(`%${q.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const searches = [`d.titulo ILIKE ${term}`, `d.nombre_servidor ILIKE ${term}`, `v.nombre_original ILIKE ${term}`, `d.cedula ILIKE ${term}`];
    // Permite buscar una cédula escrita con puntos o espacios.
    if (/^[\d.,\s]+$/.test(q.trim())) {
      searches.push(`REPLACE(REPLACE(d.cedula, '.', ''), ' ', '') LIKE ${addParam(`%${normalizeCedula(q)}%`)}`);
    }
    conditions.push(`(${searches.join(' OR ')})`);
  }
  if (typeof cedula === 'string' && cedula.trim()) {
    conditions.push(`REPLACE(REPLACE(d.cedula, '.', ''), ' ', '') = ${addParam(normalizeCedula(cedula))}`);
  }
  const tipoId = Number(idTipo);
  if (idTipo && Number.isInteger(tipoId)) conditions.push(`d.id_tipo = ${addParam(tipoId)}`);
  if (estado === 'Pendiente' || estado === 'Clasificado') conditions.push(`d.estado = ${addParam(estado)}`);

  const where = conditions.join(' AND ');
  try {
    const [list, count] = await Promise.all([
      pool.query(
        `${DOC_SELECT} WHERE ${where}
         ORDER BY v.subido_en DESC, d.id_documento DESC
         LIMIT ${addParam(limit)} OFFSET ${addParam((page - 1) * limit)}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) AS total
           FROM documentos d
           JOIN documento_versiones v ON v.id_documento = d.id_documento AND v.numero = d.version_actual
           LEFT JOIN tipos_documento t  ON t.id_tipo  = d.id_tipo
           LEFT JOIN tipos_documento ts ON ts.id_tipo = d.id_tipo_sugerido
          WHERE ${where}`,
        params.slice(0, params.length - 2)
      ),
    ]);
    const total = Number(count.rows[0].total);
    return res.json({ data: list.rows.map(toDto), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    return sendError(res, err, 'listar');
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const row = await loadVisible(pool, id, req.user);
    const [versions, events] = await Promise.all([
      pool.query(
        `SELECT numero, nombre_original AS "nombreArchivo", mime_type AS "mimeType", tamano_bytes AS "tamanoBytes",
                nota, subido_por AS "subidoPor", subido_en AS "subidoEn"
           FROM documento_versiones WHERE id_documento = $1 ORDER BY numero DESC`,
        [id]
      ),
      canWrite(req.user)
        ? pool.query(
            `SELECT accion, detalle, usuario, creado_en AS fecha
               FROM documento_eventos WHERE id_documento = $1 ORDER BY creado_en DESC, id_evento DESC LIMIT 50`,
            [id]
          )
        : { rows: [] },
    ]);
    return res.json({
      ...toDto(row),
      versiones: versions.rows.map(v => ({ ...v, tamanoBytes: Number(v.tamanoBytes) })),
      eventos: events.rows,
    });
  } catch (err) {
    return sendError(res, err, 'detalle');
  }
});

router.get('/:id/archivo', auth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const row = await loadVisible(pool, id, req.user);
    const numero = req.query.version ? parseInt(req.query.version, 10) : row.version_actual;
    const { rows } = await pool.query(
      'SELECT * FROM documento_versiones WHERE id_documento = $1 AND numero = $2',
      [id, numero]
    );
    const version = rows[0];
    if (!version) throw new HttpError(404, 'La versión solicitada no existe.');

    const inline = req.query.inline === '1' && canDisplayInline(version.mime_type);
    const stream = storage.open(version.clave_almacenamiento);
    stream.once('error', (err) => {
      console.error('[documents] archivo no disponible:', err.message);
      if (!res.headersSent) res.status(404).json({ error: 'El archivo no está disponible en el almacenamiento.' });
      else res.destroy();
    });
    stream.once('open', async () => {
      try {
        // Toda consulta de un archivo queda registrada antes de entregarlo.
        await logEvent(pool, req, id, inline ? 'Visualización' : 'Descarga', `Versión ${numero}`);
      } catch (err) {
        stream.destroy();
        return sendError(res, err, 'auditoría');
      }
      const asciiName = version.nombre_original.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.setHeader('Content-Type', version.mime_type);
      res.setHeader('Content-Length', version.tamano_bytes);
      res.setHeader('Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(version.nombre_original)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      stream.pipe(res);
    });
  } catch (err) {
    return sendError(res, err, 'archivo');
  }
});

// ─── Carga ────────────────────────────────────────────────────────────────────
async function rejectDuplicate(db, hash, user) {
  const { rows } = await db.query(
    `SELECT d.id_documento AS id, d.titulo, COALESCE(t.es_sensible, ts.es_sensible, FALSE) AS es_sensible
       FROM documento_versiones v
       JOIN documentos d ON d.id_documento = v.id_documento
       LEFT JOIN tipos_documento t  ON t.id_tipo  = d.id_tipo
       LEFT JOIN tipos_documento ts ON ts.id_tipo = d.id_tipo_sugerido
      WHERE v.sha256 = $1 AND d.eliminado_en IS NULL
      LIMIT 1`,
    [hash]
  );
  if (!rows[0]) return;
  const visible = !rows[0].es_sensible || canViewSensitive(user);
  throw new HttpError(409, 'Este archivo ya está cargado en el sistema.',
    visible ? { duplicado: { id: rows[0].id, titulo: rows[0].titulo } } : {});
}

async function buildSuggestion(db, filename) {
  const { rows: tipos } = await db.query('SELECT * FROM tipos_documento WHERE activo = TRUE');
  const tipo = suggestTipo(filename, tipos);
  let servidor = null;
  for (const candidate of extractCedulaCandidates(filename)) {
    servidor = await findServidor(db, candidate);
    if (servidor) break;
  }
  return { tipo, servidor };
}

// Registra un archivo ya validado. Sin tipo y cédula, entra a la bandeja como Pendiente con una
// sugerencia. Lo usan por igual la carga manual y la entrada automática desde carpeta.
async function ingestFile(req) {
  const b = req.body || {};
  let storedKey = null;
  let client;
  try {
    client = await pool.connect();
    await rejectDuplicate(client, req.fileHash, req.user);

    const tipo = b.idTipo ? await getTipo(client, b.idTipo, req.user) : null;
    // Un soporte toma el servidor de su solicitud, que puede venir de una carga sin ficha en personas.
    const servidor = req.soporte
      ? { cedula: req.soporte.cedula, nombre: req.soporte.nombre }
      : (b.cedula ? await findServidor(client, b.cedula) : null);
    if (b.cedula && !servidor) throw new HttpError(400, 'No existe un servidor público con esa cédula.');

    const classified = Boolean(tipo && servidor);
    const suggestion = classified ? { tipo: null, servidor: null } : await buildSuggestion(client, req.file.originalname);
    const defaultTitle = req.file.originalname.replace(/\.[^.]+$/, '');

    storedKey = await storage.save(req.file.buffer, req.fileType.ext);

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO documentos (id_tipo, cedula, nombre_servidor, id_tipo_sugerido, cedula_sugerida, nombre_sugerido,
                               titulo, descripcion, fecha_documento, estado, creado_por, id_solicitud_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id_documento`,
      [
        tipo?.id_tipo ?? null, servidor?.cedula ?? null, servidor?.nombre ?? null,
        tipo ? null : suggestion.tipo?.id_tipo ?? null,
        servidor ? null : suggestion.servidor?.cedula ?? null,
        servidor ? null : suggestion.servidor?.nombre ?? null,
        cleanText(b.titulo, 280) || defaultTitle.slice(0, 280),
        cleanText(b.descripcion, 2000),
        parseDate(b.fechaDocumento),
        classified ? 'Clasificado' : 'Pendiente',
        actor(req),
        req.soporte?.idSolicitud ?? null,
      ]
    );
    const id = rows[0].id_documento;
    await insertVersion(client, req, id, 1, storedKey, null);
    await logEvent(client, req, id, 'Carga', req.file.originalname);
    await client.query('COMMIT');
    return { id, estado: classified ? 'Clasificado' : 'Pendiente' };
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    if (storedKey) await storage.remove(storedKey).catch(() => {});
    throw err;
  } finally {
    client?.release();
  }
}

router.post('/', auth, requireWrite, receiveFile, async (req, res) => {
  try {
    const { id, estado } = await ingestFile(req);
    const created = await loadVisible(pool, id, req.user).catch(() => null);
    return res.status(201).json(created ? toDto(created) : { id, estado, protegido: true });
  } catch (err) {
    return sendError(res, err, 'cargar');
  }
});

// ─── Soportes de solicitudes administrativas ──────────────────────────────────
const SUPPORT_TYPE_BY_REQUEST = {
  Incapacidad: 'INCAPACIDAD',
  Licencia: 'SOPORTE_LICENCIA',
  'Permiso Laboral': 'SOPORTE_PERMISO',
};

function requireRequestAccess(req, res, next) {
  if (!canAccessRequests(req.user)) return res.status(403).json({ error: 'No tienes acceso a las solicitudes administrativas.' });
  next();
}

router.get('/soportes/solicitud/:id', auth, requireRequestAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const request = await pool.query(
      `SELECT t.es_sensible
         FROM solicitudes_admin s
         LEFT JOIN tipos_documento t ON t.codigo = CASE s.tipo
           WHEN 'Incapacidad' THEN 'INCAPACIDAD'
           WHEN 'Licencia' THEN 'SOPORTE_LICENCIA'
           WHEN 'Permiso Laboral' THEN 'SOPORTE_PERMISO'
         END
        WHERE s.id_solicitud = $1`,
      [id]
    );
    if (!request.rows[0]) throw new HttpError(404, 'Solicitud no encontrada.');

    // La restricción depende del tipo de solicitud, no de si hay archivos:
    // quien no tiene permiso no puede deducir si existe un soporte sensible.
    const restringido = request.rows[0].es_sensible === true && !canViewSensitive(req.user);
    const puedeAdjuntar = canWrite(req.user) && !restringido;
    if (restringido) return res.json({ data: [], restringido, puedeAdjuntar });

    const conditions = visibilityClause(req.user);
    const { rows } = await pool.query(
      `${DOC_SELECT} WHERE d.id_solicitud_admin = $1 AND ${conditions.join(' AND ')} ORDER BY v.subido_en DESC, d.id_documento DESC`,
      [id]
    );
    return res.json({ data: rows.map(toDto), restringido, puedeAdjuntar });
  } catch (err) {
    return sendError(res, err, 'soportes');
  }
});

router.post('/soportes/solicitud/:id', auth, requireWrite, requireRequestAccess, receiveFile, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { rows } = await pool.query(
      'SELECT id_solicitud, tipo, documento, apellidos_nombres FROM solicitudes_admin WHERE id_solicitud = $1',
      [id]
    );
    const solicitud = rows[0];
    if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada.');
    if (!String(solicitud.documento || '').trim()) {
      throw new HttpError(400, 'La solicitud no tiene cédula: complétala antes de adjuntar el soporte.');
    }
    const tipo = await pool.query('SELECT id_tipo FROM tipos_documento WHERE codigo = $1', [SUPPORT_TYPE_BY_REQUEST[solicitud.tipo]]);
    if (!tipo.rows[0]) throw new HttpError(500, 'Falta el tipo de documento para este soporte.');

    req.body = {
      idTipo: tipo.rows[0].id_tipo,
      titulo: `Soporte de ${solicitud.tipo.toLowerCase()} — solicitud ${id}`,
    };
    req.soporte = { idSolicitud: id, cedula: solicitud.documento.trim(), nombre: solicitud.apellidos_nombres };

    const created = await ingestFile(req);
    return res.status(201).json(toDto(await loadVisible(pool, created.id, req.user)));
  } catch (err) {
    return sendError(res, err, 'cargar soporte');
  }
});

// ─── Entrada automática desde carpeta ─────────────────────────────────────────
const inbox = createInbox({
  validate(buffer, name) {
    const checked = validateFile(buffer, name);
    return checked.error ? { error: checked.error } : { type: checked };
  },
  async ingest({ buffer, name, type, hash }) {
    try {
      await ingestFile({
        body: {},
        ip: '',
        file: { originalname: name, buffer, size: buffer.length },
        fileType: type,
        fileHash: hash,
        // Solo clasifica de forma pendiente; una persona con permiso confirma cada documento.
        user: { username: 'entrada-automatica', role: 'Coordinador', modules: [] },
      });
    } catch (err) {
      if (err instanceof HttpError) throw new InboxRejection(err.message);
      throw err;
    }
  },
});
if (inbox.enabled) inbox.start();
router.scanInbox = inbox.scan; // Para las pruebas.

async function insertVersion(db, req, idDocumento, numero, key, nota) {
  await db.query(
    `INSERT INTO documento_versiones
       (id_documento, numero, nombre_original, mime_type, extension, tamano_bytes, sha256, clave_almacenamiento, nota, subido_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [idDocumento, numero, req.file.originalname, req.fileType.mime, req.fileType.ext, req.file.size, req.fileHash, key, nota, actor(req)]
  );
}

router.post('/:id/versiones', auth, requireWrite, receiveFile, async (req, res) => {
  let storedKey = null;
  let client;
  try {
    client = await pool.connect();
    const id = parseId(req.params.id);
    await loadVisible(client, id, req.user);
    await rejectDuplicate(client, req.fileHash, req.user);
    storedKey = await storage.save(req.file.buffer, req.fileType.ext);

    await client.query('BEGIN');
    // El bloqueo evita que dos cargas simultáneas tomen el mismo número de versión.
    const { rows } = await client.query(
      'UPDATE documentos SET version_actual = version_actual + 1, actualizado_en = CURRENT_TIMESTAMP WHERE id_documento = $1 RETURNING version_actual',
      [id]
    );
    const numero = rows[0].version_actual;
    await insertVersion(client, req, id, numero, storedKey, cleanText(req.body?.nota, 500));
    await logEvent(client, req, id, 'Nueva versión', `Versión ${numero}: ${req.file.originalname}`);
    await client.query('COMMIT');
    return res.status(201).json({ id, versionActual: numero });
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    if (storedKey) await storage.remove(storedKey).catch(() => {});
    return sendError(res, err, 'nueva versión');
  } finally {
    client?.release();
  }
});

// ─── Clasificación y edición ──────────────────────────────────────────────────
router.patch('/:id', auth, requireWrite, async (req, res) => {
  const b = req.body || {};
  try {
    const id = parseId(req.params.id);
    const current = await loadVisible(pool, id, req.user);

    const tipo = b.idTipo !== undefined ? await getTipo(pool, b.idTipo, req.user) : null;
    let servidor = null;
    if (b.cedula !== undefined) {
      servidor = await findServidor(pool, b.cedula);
      if (!servidor) throw new HttpError(400, 'No existe un servidor público con esa cédula.');
    }
    const titulo = b.titulo === undefined ? current.titulo : cleanText(b.titulo, 280);
    if (!titulo) throw new HttpError(400, 'El título es obligatorio.');

    const idTipo = tipo ? tipo.id_tipo : current.id_tipo;
    const cedula = servidor ? servidor.cedula : current.cedula;
    const nombre = servidor ? servidor.nombre : current.nombre_servidor;
    const estado = idTipo && cedula ? 'Clasificado' : 'Pendiente';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE documentos
            SET id_tipo = $2, cedula = $3, nombre_servidor = $4, titulo = $5, descripcion = $6, fecha_documento = $7, estado = $8::varchar,
                id_tipo_sugerido = CASE WHEN $8::varchar = 'Clasificado' THEN NULL ELSE id_tipo_sugerido END,
                cedula_sugerida  = CASE WHEN $8::varchar = 'Clasificado' THEN NULL ELSE cedula_sugerida END,
                nombre_sugerido  = CASE WHEN $8::varchar = 'Clasificado' THEN NULL ELSE nombre_sugerido END,
                actualizado_en = CURRENT_TIMESTAMP
          WHERE id_documento = $1`,
        [
          id, idTipo, cedula, nombre, titulo,
          b.descripcion === undefined ? current.descripcion : cleanText(b.descripcion, 2000),
          b.fechaDocumento === undefined ? current.fecha_documento : parseDate(b.fechaDocumento),
          estado,
        ]
      );
      const justClassified = current.estado === 'Pendiente' && estado === 'Clasificado';
      await logEvent(client, req, id, justClassified ? 'Clasificación' : 'Edición', `${nombre || 'Sin servidor'} · ${tipo?.nombre || current.tipo_nombre || 'Sin tipo'}`);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return res.json(toDto(await loadVisible(pool, id, req.user)));
  } catch (err) {
    return sendError(res, err, 'actualizar');
  }
});

// Borrado lógico: el archivo y su historial se conservan para trazabilidad.
router.delete('/:id', auth, requireWrite, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const id = parseId(req.params.id);
    await loadVisible(client, id, req.user);
    await client.query('BEGIN');
    await client.query(
      'UPDATE documentos SET eliminado_en = CURRENT_TIMESTAMP, eliminado_por = $2 WHERE id_documento = $1',
      [id, actor(req)]
    );
    await logEvent(client, req, id, 'Eliminación', cleanText(req.body?.motivo, 500));
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    return sendError(res, err, 'eliminar');
  } finally {
    client?.release();
  }
});

module.exports = router;
