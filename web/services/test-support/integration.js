// Arranque común para las pruebas de integración de los módulos. Requiere TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'Definir TEST_DATABASE_URL para ejecutar';
const SECRET = 'secreto-solo-para-pruebas';

// Monta un router en una app de Express contra la base de prueba.
// cleanup(pool) corre al final aunque alguna prueba falle.
async function startRouter(t, mount, routerPath, cleanup) {
  process.env.DATABASE_URL = url;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = SECRET;

  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { Pool } = require('pg');
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(`/api/${mount}`, require(routerPath));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/${mount}`;
  const pool = new Pool({ connectionString: url, ssl: false });
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Los routers ajustan columnas al cargar.

  t.after(async () => {
    if (cleanup) await cleanup(pool).catch((err) => console.warn('[limpieza]', err.message));
    await pool.end();
    await new Promise((resolve) => server.close(resolve));
    setImmediate(() => process.exit(process.exitCode || 0));
  });

  const token = (role = 'Usuario', modules = [], permissions = []) => {
    let finalRole = role;
    let finalModules = Array.isArray(modules) ? [...modules] : [];
    let finalPerms = Array.isArray(permissions) ? [...permissions] : [];

    if (Array.isArray(role)) {
      finalModules = role;
      finalRole = typeof modules === 'string' ? modules : 'Usuario';
    }

    const rLower = String(finalRole || '').toLowerCase();
    if (finalModules.length === 0) {
      if (rLower === 'administrador' || rLower === 'admin') {
        finalModules = ['*'];
      } else if (rLower === 'sst' || rLower.includes('sst')) {
        finalModules = ['sst', 'epidemiologico', 'sociodemografico', 'epp'];
      } else if (rLower === 'incapacidades' || rLower.includes('incapacidad')) {
        finalModules = ['admin-requests', 'incapacidades'];
      } else if (rLower.includes('permiso') || rLower.includes('licencia')) {
        finalModules = ['admin-requests', 'permisos', 'licencias'];
      } else if (rLower === 'coordinador') {
        finalModules = ['*'];
      } else {
        finalModules = ['admin-requests', 'dashboard', 'sst'];
      }
    }

    return jwt.sign({
      username: 'integracion@prueba',
      role: finalRole,
      rol: finalRole,
      modules: finalModules,
      permissions: finalPerms
    }, SECRET);
  };
  const call = async (method, path, tk, body) => {
    const headers = {};
    if (tk) headers.Authorization = `Bearer ${tk}`;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { status: res.status, body: json };
  };
  return { pool, call, token };
}

// Documento numérico único por ejecución.
const uniqueDoc = () => `9${String(Date.now()).slice(-8)}`;

module.exports = { skip, startRouter, uniqueDoc };
