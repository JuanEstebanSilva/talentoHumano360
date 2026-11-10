const router = require('express').Router();

const pool = require('../db');
const { SOURCES, getSource, describeSource } = require('../utils/catalog');
const { MAX_ROWS, PERIODS, ReportError, runReport, loadOptions } = require('../utils/reportEngine');
const { auth, hasFullAccess, canAutomate, canAccessSource } = require('../utils/permissions');

// Fuentes que este usuario puede consultar, con sus filtros y columnas.
router.get('/catalogo', auth, (req, res) => {
  res.json({
    fuentes: SOURCES.filter(s => canAccessSource(req.user, s)).map(describeSource),
    periodos: PERIODS,
    maxFilas: MAX_ROWS,
    puedeAutomatizar: canAutomate(req.user),
  });
});

router.get('/opciones/:fuente', auth, async (req, res) => {
  const source = getSource(req.params.fuente);
  if (!canAccessSource(req.user, source)) return res.status(404).json({ error: 'Informe no encontrado.' });
  try {
    return res.json({ opciones: await loadOptions(pool, source) });
  } catch (err) {
    console.error('[reports] opciones:', err.message);
    return res.status(500).json({ error: 'No se pudieron cargar las opciones de los filtros.' });
  }
});

// Vista previa paginada o, con todo=true, el conjunto completo para exportar.
router.post('/generar', auth, async (req, res) => {
  const { fuente, filtros, columnas, page, limit, todo } = req.body || {};
  const source = getSource(fuente);
  if (!canAccessSource(req.user, source)) return res.status(404).json({ error: 'Informe no encontrado.' });
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  try {
    const result = await runReport(pool, {
      fuente, filtros, columnas,
      limit: todo === true ? MAX_ROWS : pageSize,
      offset: todo === true ? 0 : (pageNumber - 1) * pageSize,
    });
    return res.json({
      ...result,
      page: todo === true ? 1 : pageNumber,
      totalPages: todo === true ? 1 : Math.max(1, Math.ceil(result.total / pageSize)),
      truncado: todo === true && result.total > MAX_ROWS,
    });
  } catch (err) {
    if (err instanceof ReportError) return res.status(400).json({ error: err.message });
    console.error('[reports] generar:', err.message);
    return res.status(500).json({ error: 'No se pudo generar el informe.' });
  }
});

// Historial de cargas masivas: cada usuario ve las suyas; Administrador y Coordinador, todas.
router.get('/importaciones', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const own = !hasFullAccess(req.user);
  const where = own ? 'WHERE LOWER(usuario) = LOWER($1)' : '';
  const params = own ? [req.user.username] : [];
  try {
    const [list, count] = await Promise.all([
      pool.query(
        `SELECT id_importacion AS id, modulo, archivo, usuario, total_filas AS total, insertados, actualizados,
                duplicados, omitidos, errores, resultado, motivo, creado_en AS fecha
           FROM importaciones ${where}
          ORDER BY creado_en DESC, id_importacion DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params
      ),
      pool.query(`SELECT COUNT(*) AS total FROM importaciones ${where}`, params),
    ]);
    const total = Number(count.rows[0].total);
    return res.json({ data: list.rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('[reports] importaciones:', err.message);
    return res.status(500).json({ error: 'No se pudo consultar el historial de importaciones.' });
  }
});

module.exports = router;
