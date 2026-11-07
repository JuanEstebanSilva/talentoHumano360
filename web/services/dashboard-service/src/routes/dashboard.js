const router = require('express').Router();
const jwt    = require('jsonwebtoken');
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
    console.warn('[AVISO DE SEGURIDAD] JWT_SECRET no configurado o usando valor por defecto en desarrollo.');
    return secret || 'talento360_secret_2026';
  }
  return secret;
}
const JWT_SECRET = resolveJwtSecret();

function auth(req, res, next) {
  let token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido o sesión expirada.' }); }
}

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get('/stats', auth, async (_, res) => {
  try {
    const [empleados, vacaciones, adminReqs, viaticos, recientes, dependenciasCount] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (
            WHERE COALESCE(p.es_vacante, false) = true 
               OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
               OR p.nombre_completo LIKE 'PLAZA VACANTE%'
          ) AS vacantes,
          COUNT(*) FILTER (
            WHERE NOT (
              COALESCE(p.es_vacante, false) = true 
              OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
              OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            )
            AND (
              LOWER(COALESCE(e.estado_servidor, '')) = 'inactivo' 
              OR UPPER(COALESCE(e.situacion, '')) = 'RETIRADO'
            )
          ) AS inactivos,
          COUNT(*) FILTER (
            WHERE NOT (
              COALESCE(p.es_vacante, false) = true 
              OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
              OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            )
            AND LOWER(COALESCE(e.estado_servidor, 'Activo')) = 'activo'
            AND UPPER(COALESCE(e.situacion, '')) != 'RETIRADO'
          ) AS activos
        FROM rel_principal r
        LEFT JOIN personas p ON p.id_persona = r.id_persona
        LEFT JOIN estados e ON e.id_estado = r.id_estado
      `),
      pool.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE LOWER(estado)='pendiente' OR estado IS NULL) AS pendientes,
               COUNT(*) FILTER (WHERE LOWER(estado) LIKE '%aprobad%' OR LOWER(estado) LIKE '%finaliz%') AS aprobadas,
               COUNT(*) FILTER (WHERE LOWER(estado) LIKE '%rechazad%') AS rechazadas
        FROM vacaciones`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE tipo='Permiso Laboral') AS permisos,
          COUNT(*) FILTER (WHERE tipo='Incapacidad') AS incapacidades,
          COUNT(*) FILTER (WHERE tipo='Licencia') AS licencias,
          COUNT(*) FILTER (WHERE estado='Pendiente') AS pendientes
        FROM solicitudes_admin`),
      pool.query(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(valor_total) FILTER (WHERE estado IN ('Aprobada','Finalizada')), 0) AS valor_total
        FROM viaticos`),
      // Últimas actividades (mezcla de módulos)
      pool.query(`
        SELECT tipo_modulo, persona, dependencia, estado, fecha FROM (
          (SELECT 'Vacación' AS tipo_modulo, COALESCE(apellidos_nombres,'Sin nombre') AS persona,
                  COALESCE(dependencia,'') AS dependencia, COALESCE(estado,'Pendiente') AS estado,
                  COALESCE(hoy,TO_CHAR(NOW(),'DD/MM/YYYY')) AS fecha,
                  id_vacacion AS orden_id
           FROM vacaciones ORDER BY id_vacacion DESC LIMIT 5)
          UNION ALL
          (SELECT tipo AS tipo_modulo, COALESCE(apellidos_nombres,'Sin nombre'), COALESCE(dependencia,''), estado, COALESCE(fecha_solicitud,TO_CHAR(NOW(),'DD/MM/YYYY')),
                  id_solicitud AS orden_id
           FROM solicitudes_admin ORDER BY id_solicitud DESC LIMIT 5)
          UNION ALL
          (SELECT 'Viático' AS tipo_modulo, COALESCE(apellidos_nombres,'Sin nombre'), COALESCE(dependencia,''), estado, COALESCE(fecha_solicitud,TO_CHAR(NOW(),'DD/MM/YYYY')),
                  id_viatico AS orden_id
           FROM viaticos ORDER BY id_viatico DESC LIMIT 5)
        ) sub
        ORDER BY orden_id DESC LIMIT 10`),
      // Conteo dinámico y real de dependencias registradas en la entidad (base 90 + nuevas agregadas)
      pool.query(`
        SELECT COUNT(DISTINCT NULLIF(TRIM(d.dependencia), '')) AS total_dependencias,
               COUNT(DISTINCT r.id_dependencia) AS dependencias_activas
        FROM dependencias d
        LEFT JOIN rel_principal r ON r.id_dependencia = d.id_dependencia
        WHERE d.dependencia IS NOT NULL 
          AND TRIM(d.dependencia) != ''
          AND UPPER(TRIM(d.dependencia)) NOT IN ('HOLAAAAAAAA', 'NO REGISTRADO', 'HOJA2', 'NINGUNA')
      `)
    ]);

    const e = empleados.rows[0];
    const v = vacaciones.rows[0];
    const ar = adminReqs.rows[0];
    const vi = viaticos.rows[0];
    const depData = dependenciasCount.rows[0] || {};
    const totalDeps = parseInt(depData.total_dependencias) || parseInt(depData.dependencias_activas) || 90;

    res.json({
      empleados: {
        total: parseInt(e.total) || 0,
        activos: parseInt(e.activos) || 0,
        inactivos: parseInt(e.inactivos) || 0,
        vacantes: parseInt(e.vacantes) || 0,
        totalDependencias: totalDeps
      },
      totalDependencias: totalDeps,
      vacaciones: {
        total: parseInt(v.total)||0,
        pendientes: parseInt(v.pendientes)||0,
        aprobadas: parseInt(v.aprobadas)||0,
        rechazadas: parseInt(v.rechazadas)||0,
      },
      solicitudesAdmin: {
        permisos: parseInt(ar.permisos)||0,
        incapacidades: parseInt(ar.incapacidades)||0,
        licencias: parseInt(ar.licencias)||0,
        pendientes: parseInt(ar.pendientes)||0,
      },
      viaticos: {
        total: parseInt(vi.total)||0,
        valorTotalAprobado: parseFloat(vi.valor_total)||0,
      },
      actividades: recientes.rows.map(r => ({
        tipo: r.tipo_modulo, persona: (r.persona||'').trim().toUpperCase(),
        dependencia: (r.dependencia||'').trim(), estado: r.estado, fecha: r.fecha,
      })),
    });
  } catch (err) {
    console.error('[dashboard] stats error:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// ─── GET /api/dashboard/chart ─────────────────────────────────────────────────
router.get('/chart', auth, async (_, res) => {
  try {
    const [byType, byStatus, byDep, servRes, depCountRes] = await Promise.all([
      // Por tipo de solicitud
      pool.query(`
        SELECT 'Vacaciones' AS tipo, COUNT(*) AS cantidad FROM vacaciones
        UNION ALL
        SELECT 'Permisos', COUNT(*) FROM solicitudes_admin WHERE tipo='Permiso Laboral'
        UNION ALL
        SELECT 'Incapacidades', COUNT(*) FROM solicitudes_admin WHERE tipo='Incapacidad'
        UNION ALL
        SELECT 'Licencias', COUNT(*) FROM solicitudes_admin WHERE tipo='Licencia'
        UNION ALL
        SELECT 'Viáticos', COUNT(*) FROM viaticos
      `),
      // Por estado
      pool.query(`
        SELECT estado, COUNT(*) AS cantidad FROM (
          SELECT COALESCE(estado,'Pendiente') AS estado FROM vacaciones
          UNION ALL SELECT estado FROM solicitudes_admin
          UNION ALL SELECT estado FROM viaticos
        ) t GROUP BY estado ORDER BY cantidad DESC
      `),
      // Top Dependencias reales según servidores asignados (para la gráfica de barras)
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(d.dependencia), ''), 'Sin Dependencia') AS dependencia, COUNT(r.id_registro) AS cantidad
        FROM rel_principal r
        LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
        GROUP BY d.dependencia
        ORDER BY cantidad DESC
        LIMIT 5
      `),
      // Servidores por estado (Activos, Inactivos, Vacantes)
      pool.query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (
            WHERE COALESCE(p.es_vacante, false) = true 
               OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
               OR p.nombre_completo LIKE 'PLAZA VACANTE%'
          ) AS vacantes,
          COUNT(*) FILTER (
            WHERE NOT (
              COALESCE(p.es_vacante, false) = true 
              OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
              OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            )
            AND (
              LOWER(COALESCE(e.estado_servidor, '')) = 'inactivo' 
              OR UPPER(COALESCE(e.situacion, '')) = 'RETIRADO'
            )
          ) AS inactivos,
          COUNT(*) FILTER (
            WHERE NOT (
              COALESCE(p.es_vacante, false) = true 
              OR UPPER(COALESCE(e.situacion, '')) IN ('VACANTE', 'VACANTE DEFINITIVA') 
              OR p.nombre_completo LIKE 'PLAZA VACANTE%'
            )
            AND LOWER(COALESCE(e.estado_servidor, 'Activo')) = 'activo'
            AND UPPER(COALESCE(e.situacion, '')) != 'RETIRADO'
          ) AS activos
        FROM rel_principal r
        LEFT JOIN personas p ON p.id_persona = r.id_persona
        LEFT JOIN estados e ON e.id_estado = r.id_estado
      `),
      // Total general de dependencias de la entidad (dinámico)
      pool.query(`
        SELECT COUNT(DISTINCT NULLIF(TRIM(dependencia), '')) AS total
        FROM dependencias
        WHERE dependencia IS NOT NULL AND TRIM(dependencia) != ''
          AND UPPER(TRIM(dependencia)) NOT IN ('HOLAAAAAAAA', 'NO REGISTRADO', 'HOJA2', 'NINGUNA')
      `)
    ]);

    const s = servRes.rows[0];
    const totalDeps = parseInt(depCountRes.rows[0]?.total) || 90;

    res.json({
      porTipo: byType.rows.map(r => ({ tipo: r.tipo, cantidad: parseInt(r.cantidad)||0 })),
      porEstado: byStatus.rows.map(r => ({ estado: r.estado, cantidad: parseInt(r.cantidad)||0 })),
      porDependencia: byDep.rows.map(r => ({ dependencia: r.dependencia, cantidad: parseInt(r.cantidad)||0 })),
      totalDependencias: totalDeps,
      servidores: {
        activos: parseInt(s.activos) || 0,
        inactivos: parseInt(s.inactivos) || 0,
        vacantes: parseInt(s.vacantes) || 0,
        total: parseInt(s.total) || 0
      }
    });
  } catch (err) {
    console.error('[dashboard] chart error:', err.message);
    res.status(500).json({ error: 'Error gráficas.' });
  }
});

// ─── GET /api/dashboard/system-errors (Administrador — AUD-014) ───────────────
router.get('/system-errors', auth, async (req, res) => {
  const role = String(req.user?.role || req.user?.rol || '').toLowerCase();
  const isAdminRole = (role === 'admin' || role === 'administrador');
  if (!isAdminRole) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador del Sistema.' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const tipoFilter = req.query.tipo;
    const severidadFilter = req.query.severidad || req.query.severity;
    const estadoFilter = req.query.estado;
    const search = req.query.search || req.query.q;
    const servicioFilter = req.query.servicio || req.query.service;
    const desde = req.query.desde || req.query.fecha_inicio;
    const hasta = req.query.hasta || req.query.fecha_fin;

    const conditions = [];
    const params = [];

    if (tipoFilter && tipoFilter !== 'TODOS') {
      params.push(tipoFilter);
      conditions.push(`tipo = $${params.length}`);
    }

    if (severidadFilter && severidadFilter !== 'TODAS' && severidadFilter !== 'TODOS') {
      const sev = String(severidadFilter).toUpperCase().trim();
      if (sev === 'CRITICA' || sev === 'CRITICAL') {
        conditions.push(`(tipo IN ('CRITICAL', 'FATAL', 'UNHANDLED_REJECTION') OR mensaje ILIKE '%fatal%' OR mensaje ILIKE '%500%')`);
      } else if (sev === 'ALTA' || sev === 'ERROR') {
        conditions.push(`(tipo IN ('API_ERROR', 'ERROR', 'DB_ERROR') AND mensaje NOT ILIKE '%fatal%')`);
      } else if (sev === 'MEDIA' || sev === 'WARNING') {
        conditions.push(`(tipo IN ('CONSOLE_ERROR', 'WARNING', 'WARN'))`);
      } else if (sev === 'BAJA' || sev === 'INFO') {
        conditions.push(`(tipo IN ('PAGE_404', 'NOT_FOUND_404', 'INFO'))`);
      }
    }

    if (estadoFilter && estadoFilter !== 'TODOS') {
      params.push(estadoFilter);
      conditions.push(`estado = $${params.length}`);
    }

    if (servicioFilter && servicioFilter !== 'TODOS') {
      params.push(`%${servicioFilter.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(url) LIKE $${params.length} OR LOWER(mensaje) LIKE $${params.length})`);
    }

    if (desde) {
      params.push(new Date(desde));
      conditions.push(`creado_en >= $${params.length}`);
    }

    if (hasta) {
      params.push(new Date(hasta));
      conditions.push(`creado_en <= $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(mensaje) LIKE $${params.length} OR LOWER(url) LIKE $${params.length} OR LOWER(usuario) LIKE $${params.length} OR LOWER(ip_address) LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [listRes, countRes] = await Promise.all([
      pool.query(`
        SELECT id, tipo, mensaje, url, stack, usuario, ip_address, user_agent, estado, reportado_por_usuario, creado_en, resuelto_en, resuelto_por
        FROM system_errors
        ${whereClause}
        ORDER BY creado_en DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2};
      `, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*) as total FROM system_errors ${whereClause};`, params)
    ]);

    const total = parseInt(countRes.rows[0].total) || 0;
    return res.json({
      errors: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[Dashboard System Errors API] Error:', err.message);
    return res.status(500).json({ error: 'Error al consultar el registro de errores.' });
  }
});

module.exports = router;
