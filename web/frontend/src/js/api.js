/* ═══════════════════════════════════════════════════════════════════════════
   api.js — HTTP Client and Global Utilities for all microservices
   ═══════════════════════════════════════════════════════════════════════════ */

function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, n = 30) {
  if (!str) return '';
  return str.length > n ? str.substring(0, n) + '…' : str;
}

const API = (() => {
  const BASE = ((window.TALENTO360_API_URL || '').replace(/\/+$/, '')) + '/api';

  async function request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(BASE + url, { ...options, headers });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && !url.includes('/auth/login')) {
        Auth.clear();
        App.showLogin();
        throw new Error(data.error || 'Sesión expirada. Por favor inicia sesión de nuevo.');
      }
      throw new Error(data.error || `Error ${res.status}`);
    }

    return data;
  }

  return {
    // Auth
    login: (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    updateProfile: (data) =>
      request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

    // Dashboard
    getDashboardStats: () => request('/dashboard/stats'),
    getDashboardChart: () => request('/dashboard/chart'),

    // Employees
    getEmployees: (params = {}) => {
      const p = { ...params };
      if (p.q && typeof p.q === 'string' && /^[\d.,\s]+$/.test(p.q.trim()) && /\d/.test(p.q)) {
        p.q = p.q.trim().replace(/[.,\s]/g, '');
      }
      return request('/employees?' + new URLSearchParams(p));
    },
    getEmployeeByCedula: (cedula) => {
      const clean = (typeof cedula === 'string' && /^[\d.,\s]+$/.test(cedula.trim()) && /\d/.test(cedula))
        ? cedula.trim().replace(/[.,\s]/g, '')
        : encodeURIComponent(cedula);
      return request(`/employees/${clean}`);
    },
    getEmployeeCatalogs: () => request('/employees/catalogs'),
    createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateEmployees: (rows) => request('/employees/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    uploadEmployeesExcel: async (file) => {
      if (!file) throw new Error('No se ha seleccionado ningún archivo.');
      if (file.name.startsWith('~$')) {
        throw new Error('El archivo seleccionado es un temporal de Excel (~$) bloqueado por el sistema. Cierra Microsoft Excel y selecciona el archivo original.');
      }
      const formData = new FormData();
      formData.append('archivo', file);
      const token = Auth.getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res;
      try {
        res = await fetch(BASE + '/employees/importar-excel', {
          method: 'POST',
          headers,
          body: formData
        });
      } catch (fetchErr) {
        console.error('[API.uploadEmployeesExcel] fetch error:', fetchErr);
        if (file.name.startsWith('~$')) {
          throw new Error('El archivo temporal de Excel (~$) está bloqueado por el sistema. Cierra Excel y selecciona el archivo original.');
        }
        throw new Error(`Error de red al transferir el archivo: ${fetchErr.message || 'Verifica que el archivo no esté bloqueado por otra aplicación.'}`);
      }

      if (res.status === 401) {
        Auth.clear();
        App.showLogin();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
      }
      if (res.status === 413) {
        throw new Error('El archivo supera el tamaño máximo permitido por el servidor.');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    },
    updateEmployee: (cedula, data) => request(`/employees/${cedula}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: (cedula) => request(`/employees/${cedula}`, { method: 'DELETE' }),

    // Vacaciones
    getRequests: (params = {}) => request('/requests?' + new URLSearchParams(params)),
    getRequestCatalogs: () => request('/requests/catalogs'),
    createRequest: (data) => request('/requests', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateRequests: (rows) => request('/requests/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    updateRequest: (id, data) => request(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateRequestStatus: (id, estado, notaGestion = '') =>
      request(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, notaGestion }) }),
    deleteRequest: (id) => request(`/requests/${id}`, { method: 'DELETE' }),

    // Solicitudes Administrativas
    getAdminRequests: (params = {}) => request('/admin-requests?' + new URLSearchParams(params)),
    getAdminRequestsStats: () => request('/admin-requests/stats'),
    createAdminRequest: (data) => request('/admin-requests', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateAdminRequests: (rows) => request('/admin-requests/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    updateAdminRequest: (id, data) => request(`/admin-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateAdminRequestStatus: (id, estado, notaGestion = '') =>
      request(`/admin-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, notaGestion }) }),
    deleteAdminRequest: (id) => request(`/admin-requests/${id}`, { method: 'DELETE' }),

    // Viáticos
    getViaticos: (params = {}) => request('/viaticos?' + new URLSearchParams(params)),
    getViaticosStats: () => request('/viaticos/stats'),
    createViatico: (data) => request('/viaticos', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateViaticos: (rows) => request('/viaticos/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    updateViatico: (id, data) => request(`/viaticos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateViaticoStatus: (id, estado, observaciones = '') =>
      request(`/viaticos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, observaciones }) }),
    deleteViatico: (id) => request(`/viaticos/${id}`, { method: 'DELETE' }),

    // Horarios y Modalidades de Trabajo
    getHorarios: (params = {}) => request('/horarios?' + new URLSearchParams(params)),
    getHorariosStats: () => request('/horarios/stats'),
    getHorarioById: (id) => request(`/horarios/${id}`),
    createHorario: (data) => request('/horarios', { method: 'POST', body: JSON.stringify(data) }),
    updateHorario: (id, data) => request(`/horarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateHorarioStatus: (id, estado, nota = '') =>
      request(`/horarios/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, nota }) }),
    deleteHorario: (id) => request(`/horarios/${id}`, { method: 'DELETE' }),
    calculateHorarioDates: (data) => request('/horarios/calculate-dates', { method: 'POST', body: JSON.stringify(data) }),
    checkHorariosExpirations: () => request('/horarios/check-expirations', { method: 'POST' }),
    bulkCreateHorarios: (rows) => request('/horarios/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),

    // Seguridad y Salud en el Trabajo (SST)
    getSstCatalogs: () => request('/sst/catalogs'),
    getSstStats: () => request('/sst/stats'),

    getSstEpidemiologico: (params = {}) => request('/sst/epidemiologico?' + new URLSearchParams(params)),
    createSstEpidemiologico: (data) => request('/sst/epidemiologico', { method: 'POST', body: JSON.stringify(data) }),
    updateSstEpidemiologico: (id, data) => request(`/sst/epidemiologico/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateSstEpidemiologicoStatus: (id, estadoFinalCaso, actividadesPendientes = '') =>
      request(`/sst/epidemiologico/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estadoFinalCaso, actividadesPendientes }) }),
    checkSstEmoVencimientos: () => request('/sst/epidemiologico/check-vencimientos', { method: 'POST' }),
    bulkCreateSstEpidemiologico: (rows) => request('/sst/epidemiologico/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstEpidemiologico: (id) => request(`/sst/epidemiologico/${id}`, { method: 'DELETE' }),

    getSstEpp: (params = {}) => request('/sst/epp?' + new URLSearchParams(params)),
    createSstEpp: (data) => request('/sst/epp', { method: 'POST', body: JSON.stringify(data) }),
    updateSstEpp: (id, data) => request(`/sst/epp/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkCreateSstEpp: (rows) => request('/sst/epp/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstEpp: (id) => request(`/sst/epp/${id}`, { method: 'DELETE' }),

    getSstSociodemografico: (params = {}) => request('/sst/sociodemografico?' + new URLSearchParams(params)),
    createSstSociodemografico: (data) => request('/sst/sociodemografico', { method: 'POST', body: JSON.stringify(data) }),
    updateSstSociodemografico: (id, data) => request(`/sst/sociodemografico/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkCreateSstSociodemografico: (rows) => request('/sst/sociodemografico/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstSociodemografico: (id) => request(`/sst/sociodemografico/${id}`, { method: 'DELETE' }),
  };
})();
