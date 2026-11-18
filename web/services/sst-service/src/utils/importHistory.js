// Historial común de cargas masivas (tabla importaciones, ver database/30 y 32).
// Middleware que se pone en la ruta de carga: lee la respuesta que la ruta ya envía y la registra,
// sin cambiar la lógica de la carga. Un fallo al registrar nunca afecta la respuesta.
function decodeName(name) {
  return Buffer.from(String(name), 'latin1').toString('utf8');
}

function num(...values) {
  for (const v of values) {
    const n = Number(v);
    if (v !== undefined && v !== null && Number.isFinite(n)) return n;
  }
  return 0;
}

function errorText(e) {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    if (e.error && (e.fila || e.hoja)) return `${e.hoja ? `Hoja ${e.hoja}, ` : ''}fila ${e.fila}: ${e.error}`;
    return e.error || e.message || JSON.stringify(e);
  }
  return String(e);
}

function trackImport(pool, modulo) {
  return (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      try {
        const status = res.statusCode;
        if (status !== 401 && status !== 403) {
          const rows = Array.isArray(req.body?.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : [];
          const archivo = String(req.file ? decodeName(req.file.originalname) : (req.body?.nombreArchivo || '')).slice(0, 255) || null;
          const usuario = req.user?.username || 'web';
          if (status >= 400) {
            pool.query(
              `INSERT INTO importaciones (modulo, archivo, usuario, total_filas, omitidos, resultado, motivo)
               VALUES ($1, $2, $3, $4, $4, $5, $6)`,
              [modulo, archivo, usuario, rows.length, status >= 500 ? 'Fallida' : 'Rechazada',
                String(body?.error || body?.message || '').slice(0, 500) || null]
            ).catch(err => console.warn(`[${modulo}] historial de importación:`, err.message));
          } else {
            const r = body?.resumen || {};
            const errores = Array.isArray(body?.errores) ? body.errores : Array.isArray(body?.errors) ? body.errors : [];
            pool.query(
              `INSERT INTO importaciones (modulo, archivo, usuario, total_filas, insertados, actualizados, duplicados, omitidos, errores)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
              [modulo, archivo, usuario,
                rows.length || num(r.totalFilas, body?.total),
                num(r.insertados, body?.inserted, body?.filasInsertadas),
                num(r.actualizados, body?.updated, body?.filasActualizadas),
                num(body?.duplicates),
                num(r.omitidos, r.fallidos, body?.skipped),
                JSON.stringify(errores.slice(0, 50).map(errorText))]
            ).catch(err => console.warn(`[${modulo}] historial de importación:`, err.message));
          }
        }
      } catch (err) {
        console.warn(`[${modulo}] historial de importación:`, err.message);
      }
      return json(body);
    };
    next();
  };
}

module.exports = trackImport;
