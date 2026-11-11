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
    const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(BASE + url, { ...options, headers });
    } catch (networkErr) {
      if (!url.includes('/admin/errors')) {
        let uName = 'Anónimo';
        try {
          const uStr = localStorage.getItem('h360_user');
          if (uStr) uName = JSON.parse(uStr).username || 'Usuario';
        } catch (_) {}
        fetch(BASE + '/admin/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'API_ERROR',
            mensaje: `Fallo de conexión o red al consultar: ${options.method || 'GET'} ${url} — ${networkErr.message}`,
            url: window.location.href,
            usuario: uName
          })
        }).catch(() => {});
      }
      throw networkErr;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/verify-password')) {
        // AUD-012 / AUD-013: Capturar borrador del formulario activo en sessionStorage
        try {
          if (typeof sessionStorage !== 'undefined') {
            const activeContainer = document.querySelector('#modal-body, form, .form-container, #main-content');
            if (activeContainer) {
              const inputs = Array.from(activeContainer.querySelectorAll('input:not([type="password"]):not([type="file"]), textarea, select'));
              const draft = {};
              inputs.forEach(el => {
                const k = el.name || el.id;
                if (k && !k.toLowerCase().includes('password') && !k.toLowerCase().includes('token') && !k.toLowerCase().includes('secret')) {
                  draft[k] = el.type === 'checkbox' ? el.checked : el.value;
                }
              });
              sessionStorage.setItem('talento360_form_draft', JSON.stringify({ timestamp: Date.now(), draft }));
            }
          }
        } catch (_) {}

        // AUD-012: Capturar borrador enriquecido mediante App
        if (typeof App !== 'undefined' && App.captureActiveFormDraft) {
          App.captureActiveFormDraft();
        }

        // Si la aplicación soporta reautenticación en caliente (in-place modal), invocarla
        if (typeof App !== 'undefined' && App.promptReauthentication) {
          return new Promise((resolve, reject) => {
            App.promptReauthentication({
              onSuccess: async () => {
                try {
                  // Reintentar la petición original con el nuevo token renovado
                  const retryRes = await request(url, options);
                  resolve(retryRes);
                } catch (retryErr) {
                  reject(retryErr);
                }
              },
              onCancel: () => {
                reject(new Error('Sesión expirada. Por favor inicie sesión nuevamente.'));
              }
            });
          });
        }

        // Fallback estándar en caso de que App no esté inicializada
        if (typeof Auth !== 'undefined' && Auth.clear) Auth.clear();
        if (typeof App !== 'undefined' && App.showLogin) App.showLogin();
        throw new Error(data.error || 'Sesión expirada. Se guardó un borrador de los datos ingresados para su recuperación.');
      }

      if (res.status >= 500 && !url.includes('/admin/errors')) {
        let uName = 'Anónimo';
        try {
          const uStr = localStorage.getItem('h360_user');
          if (uStr) uName = JSON.parse(uStr).username || 'Usuario';
        } catch (_) {}
        fetch(BASE + '/admin/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'API_ERROR',
            mensaje: `Error ${res.status} en servidor: ${options.method || 'GET'} ${url} — ${data.error || 'Error interno'}`,
            url: window.location.href,
            usuario: uName
          })
        }).catch(() => {});
      }

      throw new Error(data.error || `Error ${res.status}`);
    }

    return data;
  }

  return {
    // Auth
    login: (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    forgotPassword: (email) =>
      request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    changePassword: (data) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    verifyPassword: (username, password) =>
      request('/auth/verify-password', { method: 'POST', body: JSON.stringify({ username, password }) }),
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
    buscarServidor: async (q, limit = 8) => {
      const cleanQ = typeof q === 'string' ? q.trim() : '';
      try {
        const res = await request(`/employees/buscar?q=${encodeURIComponent(cleanQ)}&limit=${limit}`);
        if (res && Array.isArray(res.data)) return res;
      } catch (err) {
        // Fallback transparente en caso de versión previa de servicio
      }
      return API.getEmployees({ q: cleanQ, limit });
    },
    getEmployeeByCedula: (cedula) => {
      const clean = (typeof cedula === 'string' && /^[\d.,\s]+$/.test(cedula.trim()) && /\d/.test(cedula))
        ? cedula.trim().replace(/[.,\s]/g, '')
        : encodeURIComponent(cedula);
      return request(`/employees/${clean}`);
    },
    getEmployeeCatalogs: () => request('/employees/catalogs'),
    createDependencia: (nombre) => request('/employees/dependencias', { method: 'POST', body: JSON.stringify({ nombre }) }),
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
    updateEmployeeStatus: (cedula, estadoServidor, extraData = {}) =>
      request(`/employees/${cedula}/status`, { method: 'PATCH', body: JSON.stringify({ estadoServidor, ...extraData }) }),
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
    getAdminRequestsStats: (params = {}) => {
      const qs = new URLSearchParams({ detailed: '1', ...params }).toString();
      return request('/admin-requests/stats' + (qs ? `?${qs}` : ''));
    },
    createAdminRequest: (data) => request('/admin-requests', { method: 'POST', body: JSON.stringify(data) }),
    updateAdminRequest: (id, data) => request(`/admin-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateAdminRequestStatus: (id, estado, notaGestion = '') =>
      request(`/admin-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, notaGestion }) }),
    deleteAdminRequest: (id) => request(`/admin-requests/${id}`, { method: 'DELETE' }),
    getPermisosCatalogs: () => request('/admin-requests/catalogs/permisos'),
    getLicenciasCatalogs: () => request('/admin-requests/catalogs/licencias'),
    getAdminRequestSoportes: (id) => request(`/admin-requests/${id}/soportes`),
    getAdminRequestSoporteUrl: (id, sid) => `${BASE}/admin-requests/${id}/soportes/${sid}`,
    reenviarNotificacionAdminRequest: (id) =>
      request(`/admin-requests/${id}/reenviar-notificacion`, { method: 'POST' }),

    // Incapacidades (Formato 9. INCAPACIDADES SST — E-DO-ST-F-002 Versión 2)
    getIncapacidades: (params = {}) => request('/admin-requests/incapacidades?' + new URLSearchParams(params)),
    getIncapacidadesStats: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('/admin-requests/incapacidades/stats' + (qs ? `?${qs}` : ''));
    },
    getIncapacidadesCatalogs: () => request('/admin-requests/incapacidades/catalogs'),
    createIncapacidad: (data) => request('/admin-requests/incapacidades', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateIncapacidades: (rows) => request('/admin-requests/incapacidades/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    updateIncapacidad: (id, data) => request(`/admin-requests/incapacidades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateIncapacidadStatus: (id, estado, observaciones = '') =>
      request(`/admin-requests/incapacidades/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, observaciones }) }),
    deleteIncapacidad: (id) => request(`/admin-requests/incapacidades/${id}`, { method: 'DELETE' }),
    getIncapacidadSoportes: (id) => request(`/admin-requests/incapacidades/${id}/soportes`),
    getIncapacidadSoporteUrl: (id, sid) => `${BASE}/admin-requests/incapacidades/${id}/soportes/${sid}`,

    // Viáticos
    getViaticos: (params = {}) => request('/viaticos?' + new URLSearchParams(params)),
    getViaticosRankingFuncionarios: (params = {}) => request('/viaticos/ranking-funcionarios' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '')),
    getViaticosDependencias: (params = {}) => request('/viaticos/dependencias' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '')),
    getViaticosStats: (params = {}) => request('/viaticos/stats' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '')),
    getViaticosAnios: () => request('/viaticos/anios'),
    createViaticosAnio: (data) => request('/viaticos/anios', { method: 'POST', body: JSON.stringify(data) }),
    deleteViaticosAnio: (anio) => request(`/viaticos/anios/${anio}`, { method: 'DELETE' }),
    getViaticosPaquetes: () => request('/viaticos/paquetes'),
    createViaticosPaquete: (data) => request('/viaticos/paquetes', { method: 'POST', body: JSON.stringify(data) }),
    updateViaticosPaquete: (id, data) => request(`/viaticos/paquetes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteViaticosPaquete: (id) => request(`/viaticos/paquetes/${id}`, { method: 'DELETE' }),
    createViatico: (data) => request('/viaticos', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateViaticos: (payload) =>
      request('/viaticos/bulk', { method: 'POST', body: JSON.stringify(Array.isArray(payload) ? { rows: payload } : payload) }),
    updateViatico: (id, data) => request(`/viaticos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateViaticoStatus: (id, estado, observaciones = '', extra = {}) =>
      request(`/viaticos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado, observaciones, ...extra }) }),
    getViaticoHistorial: (id) =>
      request(`/viaticos/${id}/historial`),
    deleteViatico: (id) => request(`/viaticos/${id}`, { method: 'DELETE' }),
    calculateViaticoLiquidacion: (data) =>
      request('/viaticos/calcular-liquidacion', { method: 'POST', body: JSON.stringify(data) }),
    getViaticoSupport: (id) =>
      request(`/viaticos/${id}/soporte`),

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
    getNextHorarioConsecutivo: () => request('/horarios/next-consecutivo'),
    updateHorarioSoporte: (id, soporte_acto) =>
      request(`/horarios/${id}/soporte`, { method: 'PATCH', body: JSON.stringify({ soporte_acto }) }),
    bulkCreateHorarios: (payload) =>
      request('/horarios/bulk', { method: 'POST', body: JSON.stringify(Array.isArray(payload) ? { rows: payload } : payload) }),

    // Seguridad y Salud en el Trabajo (SST)
    getSstCatalogs: () => request('/sst/catalogs'),
    getSstStats: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('/sst/stats' + (qs ? `?${qs}` : ''));
    },

    getSstEpidemiologico: (params = {}) => request('/sst/epidemiologico?' + new URLSearchParams(params)),
    createSstEpidemiologico: (data) => request('/sst/epidemiologico', { method: 'POST', body: JSON.stringify(data) }),
    updateSstEpidemiologico: (id, data) => request(`/sst/epidemiologico/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateSstEpidemiologicoStatus: (id, estadoFinalCaso, actividadesPendientes = '') =>
      request(`/sst/epidemiologico/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estadoFinalCaso, actividadesPendientes }) }),
    checkSstEmoVencimientos: () => request('/sst/epidemiologico/check-vencimientos', { method: 'POST' }),
    bulkCreateSstEpidemiologico: (rows) => request('/sst/epidemiologico/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstEpidemiologico: (id) => request(`/sst/epidemiologico/${id}`, { method: 'DELETE' }),

    getSstEpp: (params = {}) => request('/sst/epp?' + new URLSearchParams(params)),
    getSstEppInventario: () => request('/sst/epp/inventario'),
    updateSstEppInventario: (codigo, data) =>
      request(`/sst/epp/inventario/${encodeURIComponent(codigo)}`, { method: 'PUT', body: JSON.stringify(data) }),
    createSstEpp: (data) => request('/sst/epp', { method: 'POST', body: JSON.stringify(data) }),
    updateSstEpp: (id, data) => request(`/sst/epp/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkCreateSstEpp: (rows) => request('/sst/epp/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstEpp: (id) => request(`/sst/epp/${id}`, { method: 'DELETE' }),

    getSstSociodemografico: (params = {}) => request('/sst/sociodemografico?' + new URLSearchParams(params)),
    createSstSociodemografico: (data) => request('/sst/sociodemografico', { method: 'POST', body: JSON.stringify(data) }),
    updateSstSociodemografico: (id, data) => request(`/sst/sociodemografico/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    bulkCreateSstSociodemografico: (rows) => request('/sst/sociodemografico/bulk', { method: 'POST', body: JSON.stringify({ rows }) }),
    deleteSstSociodemografico: (id) => request(`/sst/sociodemografico/${id}`, { method: 'DELETE' }),

    // Gobernanza Unificada: RBAC, Responsables por Módulo, Auditoría Inmutable y Documentos Institucionales
    getGovernancePermissions: (modulo = '', service = 'admin-requests') =>
      request(`/${service}/governance/permissions?` + new URLSearchParams(modulo ? { modulo } : {})),
    checkGovernancePermission: async (modulo = 'permisos') => {
      const sstMods = ['epidemiologico', 'sociodemografico', 'epp'];
      const service = sstMods.includes(modulo) ? 'sst' : 'admin-requests';
      const res = await request(`/${service}/governance/permissions?` + new URLSearchParams({ modulo }));
      const perm = (res && res.permissions && res.permissions[modulo]) || {};
      return {
        isAdmin: Boolean(res?.isAdmin || perm.isAdmin),
        isResponsable: Boolean(perm.isResponsable),
        canManage: Boolean(perm.canManage || res?.isAdmin),
        canApprove: Boolean(perm.canApprove || perm.canManage || res?.isAdmin),
        canImport: Boolean(perm.canImport || perm.canManage || res?.isAdmin),
        canExport: Boolean(perm.canExport || perm.canManage || res?.isAdmin),
        roleType: perm.roleType || (res?.isAdmin ? 'Administrador' : 'Funcionario'),
        responsables: res?.responsables || [],
      };
    },
    getGovernanceUsers: (service = 'admin-requests') =>
      request(`/${service}/governance/users`),
    saveModuloResponsable: (data, service = 'admin-requests') =>
      request(`/${service}/governance/responsables`, { method: 'POST', body: JSON.stringify(data) }),
    deleteModuloResponsable: (id, service = 'admin-requests') =>
      request(`/${service}/governance/responsables/${id}`, { method: 'DELETE' }),
    getAuditoriaModulos: (params = {}, service = 'admin-requests') =>
      request(`/${service}/governance/auditoria?` + new URLSearchParams(params)),
    getDocumentosInstitucionales: (modulo = '', service = 'admin-requests') =>
      request(`/${service}/governance/documentos?` + new URLSearchParams(modulo ? { modulo } : {})),
    getDocumentoVersiones: (id, service = 'admin-requests') =>
      request(`/${service}/governance/documentos/${id}/versiones`),
    createDocumentoInstitucional: (data, service = 'admin-requests') =>
      request(`/${service}/governance/documentos`, { method: 'POST', body: JSON.stringify(data) }),
    updateDocumentoInstitucional: (id, data, service = 'admin-requests') =>
      request(`/${service}/governance/documentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDocumentoInstitucional: (id, service = 'admin-requests') =>
      request(`/${service}/governance/documentos/${id}`, { method: 'DELETE' }),
    downloadDocumentoInstitucional: async (id, nombreArchivo = 'Documento_Institucional', service = 'admin-requests', versionId = null) => {
      const token = Auth.getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const pathUrl = versionId
        ? `${BASE}/${service}/governance/documentos/${id}/versiones/${versionId}/download`
        : `${BASE}/${service}/governance/documentos/${id}/download`;
      const res = await fetch(pathUrl, { headers });
      if (!res.ok) throw new Error('No se pudo descargar el documento institucional.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },

    // Administración Técnica: Monitoreo de Errores y Copias de Seguridad
    reportError: (payload) =>
      request('/admin/errors', { method: 'POST', body: JSON.stringify(payload) }).catch(err => {
        console.warn('[API.reportError] No se pudo enviar el reporte:', err.message);
        return { success: false };
      }),
    getAdminErrors: (params = {}) =>
      request('/admin/errors?' + new URLSearchParams(params)),
    updateAdminErrorStatus: (id, estado) =>
      request(`/admin/errors/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
    deleteAdminError: (id) =>
      request(`/admin/errors/${id}`, { method: 'DELETE' }),
    clearAllAdminErrors: (onlyResolved = false) =>
      request('/admin/errors/clear-all', { method: 'POST', body: JSON.stringify({ onlyResolved }) }),

    // Administración Técnica: Copias de Seguridad (Backups)
    getAdminBackups: () =>
      request('/admin/backups'),
    generateAdminBackup: () =>
      request('/admin/backups/generate', { method: 'POST' }),
    deleteAdminBackup: (id) =>
      request(`/admin/backups/${id}`, { method: 'DELETE' }),
    getAdminBackupConfig: () =>
      request('/admin/backups/config'),
    updateAdminBackupConfig: (config) =>
      request('/admin/backups/config', { method: 'PUT', body: JSON.stringify(config) }),
    getAdminBackupDownloadUrl: (id) => {
      const base = ((window.TALENTO360_API_URL || '').replace(/\/+$/, '')) + '/api';
      return `${base}/admin/backups/download/${id}`;
    },
  };
})();

window.API = API;
