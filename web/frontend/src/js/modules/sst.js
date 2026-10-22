/* ═══════════════════════════════════════════════════════════════════════════
   sst.js — Módulo de Seguridad y Salud en el Trabajo (SST — Talento 360)
   Submódulos:\n   1. Perfil Epidemiológico y EMO\n   2. Entrega de Elementos de Protección Personal (EPP)\n   3. Perfil Sociodemográfico
   ═══════════════════════════════════════════════════════════════════════════ */

const SstModule = (() => {
  const TABS = {
    epidemiologico: {
      key: 'epidemiologico',
      title: 'Perfil Epidemiológico y EMO',
      code: '',
      desc: 'Control de Exámenes Médicos Ocupacionales (EMO), restricciones, PVE y seguimiento de accidentes/enfermedades laborales',
      btnCreate: 'Nuevo Registro EMO'
    },
    epp: {
      key: 'epp',
      title: 'Entrega de Elementos de Protección Personal (EPP)',
      code: '',
      desc: 'Suministro, reposición y verificación de entrega de Elementos de Protección Personal',
      btnCreate: 'Registrar Entrega EPP'
    },
    sociodemografico: {
      key: 'sociodemografico',
      title: 'Perfil Sociodemográfico',
      code: '',
      desc: 'Caracterización sociodemográfica, familiar, educativa y laboral de los servidores públicos y contratistas',
      btnCreate: 'Nuevo Perfil Sociodemográfico'
    }
  };

  let state = {
    tab: 'epidemiologico',
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
    filters: { q: '', subFilter1: 'Todos', subFilter2: 'Todos' },
    stats: {},
    catalogs: null
  };

  let currentUploadedFile = null;
  let employeeSearchTimeout = null;

  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadStats() {
    API.getSstStats().then(stats => {
      state.stats = stats || {};
      const grid = document.getElementById('sst-stats-grid');
      if (!grid) return;

      if (state.tab === 'epp') {
        grid.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.totalEpp) || 0}</span>
              <span class="stat-label">Total Dotaciones</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.servidoresDotados) || 0}</span>
              <span class="stat-label">Servidores Dotados</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.eppEntregados) || 0}</span>
              <span class="stat-label">EPP Entregados</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${Math.max(0, (parseInt(stats.totalEpp) || 0) - (parseInt(stats.eppEntregados) || 0))}</span>
              <span class="stat-label">En Reposición / Pendiente</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">Verificado</span>
              <span class="stat-label">Firma en Entrega</span>
            </div>
          </div>
        `;
      } else if (state.tab === 'sociodemografico') {
        grid.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.totalSociodemografico) || 0}</span>
              <span class="stat-label">Perfiles Registrados</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.dependenciasCubiertas) || 0}</span>
              <span class="stat-label">Dependencias Cubiertas</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">Activo</span>
              <span class="stat-label">Censo y Caracterización</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">100%</span>
              <span class="stat-label">Confidencialidad Ley 1581</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">Vigencia 2026</span>
              <span class="stat-label">Actualización Periódica</span>
            </div>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="stat-card">
            <div class="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.totalEmo) || 0}</span>
              <span class="stat-label">Total Exámenes EMO</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.emoVigentes) || 0}</span>
              <span class="stat-label">EMO Vigentes</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.emoAlertas) || 0}</span>
              <span class="stat-label">Alertas / Vencidos</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.casosSeguimiento) || 0}</span>
              <span class="stat-label">En Seguimiento</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-value">${parseInt(stats.direccionadosPve) || 0}</span>
              <span class="stat-label">Direccionados PVE</span>
            </div>
          </div>
        `;
      }
    }).catch(err => {
      console.error('[SstModule] Error cargando estadísticas SST:', err);
    });
  }

  // ─── Catálogos Fallback Locales ────────────────────────────────────────────
  const DEFAULT_CATALOGS = {
    eppCatalogo: [
      { codigo: 'A',  nombre: 'A. Casco de seguridad' },
      { codigo: 'B',  nombre: 'B. Gorro o Cofias' },
      { codigo: 'C',  nombre: 'C. Gorro Zafari' },
      { codigo: 'D',  nombre: 'D. Tapones externos' },
      { codigo: 'E',  nombre: 'E. Tapones de copa (orejeras)' },
      { codigo: 'F',  nombre: 'F. Careta (guadañar)' },
      { codigo: 'G',  nombre: 'G. Monogafas' },
      { codigo: 'H',  nombre: 'H. Gafas de seguridad' },
      { codigo: 'I',  nombre: 'I. Gafas de seguridad / UV' },
      { codigo: 'J',  nombre: 'J. Respirador con filtros' },
      { codigo: 'K',  nombre: 'K. Filtros para respiradores' },
      { codigo: 'L',  nombre: 'L. Respirador ffp2 o n95' },
      { codigo: 'M',  nombre: 'M. Mascarilla desechable' },
      { codigo: 'N',  nombre: 'N. Guantes de poliuretano' },
      { codigo: 'O',  nombre: 'O. Guantes de vaqueta' },
      { codigo: 'P',  nombre: 'P. Guantes de Nitrilo' },
      { codigo: 'Q',  nombre: 'Q. Guantes de látex' },
      { codigo: 'R',  nombre: 'R. Guantes de caucho' },
      { codigo: 'S',  nombre: 'S. Guantes sustancias químicas' },
      { codigo: 'T',  nombre: 'T. Chaleco Trabajo en campo' },
      { codigo: 'U',  nombre: 'U. Overol de dos piezas cinta reflectiva' },
      { codigo: 'V',  nombre: 'V. Overol antifluidos' },
      { codigo: 'W',  nombre: 'W. Bata manga larga antifluido' },
      { codigo: 'X',  nombre: 'X. Delantal Carnaza' },
      { codigo: 'Y',  nombre: 'Y. Zapato cerrado' },
      { codigo: 'Z',  nombre: 'Z. Botas de Seguridad' },
      { codigo: 'AA', nombre: 'AA. Botas pantaneras con puntera' },
      { codigo: 'AB', nombre: 'AB. Otros' }
    ],
        sedes: [
      "ARCHIVO GENERAL DEL DEPARTAMENTO - Centro.",
      "ARCHIVO GENERAL DEL DEPARTAMENTO - Topo.",
      "AUDITORIO JOSE MOSSER Y OFICINAS.",
      "BIBLIOTECA DEPARTAMENTAL \"EDUARDO TORRES QUINTERO\"ARCHIVO COBRO COACTIVO.",
      "BIBLIOTECA PEDRO PASCACIO MARTÍNEZ. (CASA JUAN DE CASTELLANOS)",
      "BODEGA TALLERES DE OBRAS PÚBLICAS DEL DEPARTAMENTO DE BOYACÁ.",
      "BODEGA VECTORES",
      "CASA DE BOYACÁ EN BOGOTÁ.",
      "CASA DE LA TORRE",
      "CASA PRIVADA DEL SEÑOR GOBERNADOR.",
      "CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 203 B INTERIOR.",
      "CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 209 B INTERIOR",
      "CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 206 B INTERIOR.",
      "CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 207 B INTERIOR.",
      "CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 208 B INTERIOR",
      "EDIFICIO CENTRO EXPERIMENTAL PILOTO - CEP.",
      "EDIFICIO LOTERÍA DE BOYACÁ",
      "EDIFICIO LOTERÍA DE BOYACÁ PISO 4",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 8° OFICINA 805",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1002",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1003",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1004",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1006",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1007",
      "EDIFICIO LOTERÍA DE BOYACÁ - PISO 11°",
      "ESCUELA DE ARTES.",
      "FONDO TERRITORIAL DE PENSIONES DE BOYACÁ.",
      "JARDÍN BOTÁNICO.",
      "LABORATORIO DEPARTAMENTAL DE SALUD PÚBLICA.",
      "MONUMENTO HISTÓRICO DEL PUENTE DE BOYACÁ.",
      "OFICINAS DEL CDGRD.",
      "PALACIO DE SERVICIOS CULTURALES",
      "PARQUEADERO DEL DEPARTAMENTO.",
      "SECRETARIA DE EDUCACION DE BOYACÁ.",
      "SECRETARÍA DE SALUD DE BOYACÁ - CRISDI",
      "SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.",
      "VIVE DIGITAL Y VIVE LAB.",
      "EDIFICIO INTELIGENTE - BICENTENARIO"
],
    dependencias: [
      "DES - Despacho del gobernador",
      "DES - Oficina Asesora de Control Interno de Gestión",
      "DES - Oficina Asesora de Control Interno Disciplinario",
      "DES - Unidad Administrativa de Comunicaciones y Protocolo",
      "DES - UCOM - Subdirección de Radio y Televisión",
      "DES - Unidad Administrativa de Relaciones Nacionales Internacionales",
      "DES - Unidad Administrativa Especial de Asesoría y Defensa Jurídica del Departamento",
      "DES - Unidad Administrativa para la Gestión del Riesgo y del Desastre",
      "SAGR - SECRETARIA DE AGRICULTURA (Despacho)",
      "SAGR - Dirección de Desarrollo Rural Integral",
      "SAGR - Dirección de Productividad Agropecuaria",
      "SAGR - Dirección de Bienestar Campesino",
      "SAMB - SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE (Despacho)",
      "SAMB - Dirección de Gestión del Recurso Hídrico y Saneamiento Básico",
      "SCON - SECRETARIA DE CONTRATACION (Despacho)",
      "SCON - Dirección Administrativa Contractual",
      "SCON - Dirección de Procesos de Selección",
      "SCUP - SECRETARIA DE CULTURA Y PATRIMONIO (Despacho)",
      "SDEM - SECRETARIA DE DESARROLLO EMPRESARIAL (Despacho)",
      "SDEM - Dirección de Desarrollo Empresarial",
      "SDEM - Dirección de Inversión y Comercio",
      "SEDU - SECRETARIA DE EDUCACIÓN (Despacho)",
      "*SEDU - INSTITUCIÓN EDUCATIVA DEL DEPARTAMENTO",
      "SEDU - Oficina Asesora para la Gestión Estratégica del Sector Educación",
      "SEDU - Oficina Asesora y Defensa Jurídica del Sector Educación",
      "SEDU - Dirección Técnico Pedagógica",
      "SEDU - DTP - Programa de Adultos y Jóvenes en Extra Edad",
      "SEDU - DTP - Programa del Plan Alimentario Escolar",
      "SEDU - DTP - Subdirección de Calidad Educativa",
      "SEDU - DTP - Subdirección de Cobertura y Ruralidad",
      "SEDU - DTP - Subdirección de Inspección de Vigilancia",
      "SEDU - DTP - Subdirección de Núcleos Educativos",
      "SEDU - Dirección Administrativa Financiera",
      "SEDU - DAF - Subdirección de Talento Humano",
      "SGEN - SECRETARIA GENERAL (Despacho)",
      "SGEN - Dirección General de Talento Humano",
      "SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo",
      "SGEN - Dirección de Servicios Administrativos y Logísticos",
      "SGEN - DSA - Subdirección de Atención al Ciudadano",
      "SGEN - DSA - Subdirección de Gestión Documental",
      "SGOB - SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL (Despacho)",
      "SGOB - Dirección de Dialogo Social y Convivencia",
      "SGOB - Dirección de Participación y Acción Comunal",
      "SGOB -Dirección de Juventud",
      "SHAC - SECRETARIA DE HACIENDA (Despacho)",
      "SHAC - Dirección Financiera Y Fiscal",
      "SHAC - DFF - Subdirección de Cobro Coactivo",
      "SHAC - DFF - Subdirección Central de Cuentas",
      "SHAC - DFF - Subdirección de Contabilidad",
      "SHAC - DFF - Subdirección de Presupuesto",
      "SHAC - Dirección Departamental de Pasivos Pensionales",
      "SHAC - DPP - Subdirección Administrativa de Pasivos Pensionales",
      "SHAC - DPP - Subdirección Jurídica de Pasivos Pensionales",
      "SHAC - Dirección de Recaudo y Fiscalización",
      "SHAC - Tesorería General",
      "SINF - SECRETARIA DE INFRAESTRUCTURA PUBLICA (Despacho)",
      "SINF - Dirección de Desarrollo de la Infraestructura Vial",
      "SINF - Dirección de Vivienda Edificaciones y Obra Publica",
      "SINF - Dirección Técnica de Estudios y Diseños",
      "SINS - SECRETARIA DE INTEGRACIÓN SOCIAL (Despacho)",
      "SINS - Dirección de Familia, Infancia, Adolescencia y Adulto Mayor",
      "SINS - Dirección de la Mujer e Inclusión Social",
      "SMIN - SECRETARIA DE MINAS Y ENERGIA (Despacho)",
      "SPLA - SECRETARIA DE PLANEACIÓN (Despacho)",
      "SPLA - Dirección de Inversión Publica del Departamento",
      "SPLA - Dirección de Seguimiento y Planeación Territorial",
      "SPLA - Dirección Geográfica y de Gestión Territorial",
      "SPLA - Oficina Asesora de Planeación y Métodos de Gestión",
      "SSAL - SECRETARIA DE SALUD (Despacho)",
      "SSAL - Dirección de Aseguramiento en Salud",
      "SSAL - Dirección de Prestación de Servicios de Salud",
      "SSAL - Dirección de Promoción y Prevención en Salud",
      "SSAL - DPP - Subdirección de Promoción Social en Salud",
      "SSAL - Oficina Asesora de Defensa Jurídica del Sector Salud",
      "SSAL - Oficina Asesora para la Gestión Estratégica del Sector Salud",
      "STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)",
      "STIC - Dirección de Apropiación de TIC",
      "STIC - Dirección de Sistemas de Información",
      "STUR - SECRETARIA DE TURISMO (Despacho)",
      "DES - Oficina Asesora de Control Interno de Gestión",
      "DES - Oficina Asesora de Control Interno Disciplinario",
      "DES - Unidad Administrativa de Comunicaciones y Protocolo",
      "DES - UCOM - Subdirección de Radio y Televisión",
      "DES - Unidad Administrativa de Relaciones Nacionales Internacionales",
      "DES - Unidad Administrativa Especial de Asesoría y Defensa Jurídica del Departamento",
      "DES - Unidad Administrativa para la Gestión del Riesgo y del Desastre",
      "SAGR - SECRETARIA DE AGRICULTURA (Despacho)",
      "SAGR - Dirección de Bienestar Campesino",
      "SAGR - Dirección de Desarrollo Rural Integral",
      "SAGR - Dirección de Productividad Agropecuaria",
      "SAMB - SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE (Despacho)",
      "SAMB - Dirección de Gestión del Recurso Hídrico y Saneamiento Básico",
      "SCON - SECRETARIA DE CONTRATACION (Despacho)",
      "SCON - Dirección Administrativa Contractual",
      "SCON - Dirección de Procesos de Selección",
      "SCUP - SECRETARIA DE CULTURA Y PATRIMONIO (Despacho)",
      "SDEM - SECRETARIA DE DESARROLLO EMPRESARIAL (Despacho)",
      "SDEM - Dirección de Desarrollo Empresarial",
      "SDEM - Dirección de Inversión y Comercio",
      "SEDU - SECRETARIA DE EDUCACIÓN (Despacho)",
      "SEDU - Oficina Asesora para la Gestión Estratégica del Sector Educación",
      "SEDU - Oficina Asesora y Defensa Jurídica del Sector Educación",
      "SEDU - Dirección Técnico Pedagógica",
      "SEDU - DTP - Programa de Adultos y Jóvenes en Extra Edad",
      "SEDU - DTP - Programa del Plan Alimentario Escolar",
      "SEDU - DTP - Subdirección de Calidad Educativa",
      "SEDU - DTP - Subdirección de Cobertura y Ruralidad",
      "SEDU - DTP - Subdirección de Inspección de Vigilancia",
      "SEDU - DTP - Subdirección de Núcleos Educativos",
      "SEDU - Dirección Administrativa Financiera",
      "SEDU - DAF - Subdirección de Talento Humano",
      "SGEN - SECRETARIA GENERAL (Despacho)",
      "SGEN - Dirección General de Talento Humano",
      "SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo",
      "SGEN - Dirección de Servicios Administrativos y Logísticos",
      "SGEN - DSA - Subdirección de Atención al Ciudadano",
      "SGEN - DSA - Subdirección de Gestión Documental",
      "SGOB - SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL (Despacho)",
      "SGOB - Dirección de Dialogo Social y Convivencia",
      "SGOB - Dirección de Participación y Acción Comunal",
      "SGOB -Dirección de Juventud",
      "SHAC - SECRETARIA DE HACIENDA (Despacho)",
      "SHAC - Dirección Financiera Y Fiscal",
      "SHAC - DFF - Subdirección de Cobro Coactivo",
      "SHAC - DFF - Subdirección Central de Cuentas",
      "SHAC - DFF - Subdirección de Contabilidad",
      "SHAC - DFF - Subdirección de Presupuesto",
      "SHAC - Dirección Departamental de Pasivos Pensionales",
      "SHAC - DPP - Subdirección Administrativa de Pasivos Pensionales",
      "SHAC - DPP - Subdirección Jurídica de Pasivos Pensionales",
      "SHAC - Dirección de Recaudo y Fiscalización",
      "SHAC - Tesorería General",
      "SINF - SECRETARIA DE INFRAESTRUCTURA PUBLICA (Despacho)",
      "SINF - Dirección de Desarrollo de la Infraestructura Vial",
      "SINF - Dirección de Vivienda Edificaciones y Obra Publica",
      "SINF - Dirección Técnica de Estudios y Diseños",
      "SINS - SECRETARIA DE INTEGRACIÓN SOCIAL (Despacho)",
      "SINS - Dirección de Familia, Infancia, Adolescencia y Adulto Mayor",
      "SINS - Dirección de la Mujer e Inclusión Social",
      "SMIN - SECRETARIA DE MINAS Y ENERGIA (Despacho)",
      "SPLA - SECRETARIA DE PLANEACIÓN (Despacho)",
      "SPLA - Dirección de Inversión Publica del Departamento",
      "SPLA - Dirección de Seguimiento y Planeación Territorial",
      "SPLA - Dirección Geográfica y de Gestión Territorial",
      "SPLA - Oficina Asesora de Planeación y Métodos de Gestión",
      "SSAL - SECRETARIA DE SALUD (Despacho)",
      "SSAL - Dirección de Aseguramiento en Salud",
      "SSAL - Dirección de Prestación de Servicios de Salud",
      "SSAL - Dirección de Promoción y Prevención en Salud",
      "SSAL - DPP - Subdirección de Promoción Social en Salud",
      "SSAL - Oficina Asesora de Defensa Jurídica del Sector Salud",
      "SSAL - Oficina Asesora para la Gestión Estratégica del Sector Salud",
      "STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)",
      "STIC - Dirección de Apropiación de TIC",
      "STIC - Dirección de Sistemas de Información",
      "STUR - SECRETARIA DE TURISMO (Despacho)"
],
    tiposEmo: ['Ingreso', 'Periódico', 'Egreso', 'Post Incapacidad', 'Trabajo en alturas'],
    estadosCaso: ['Vigente', 'En Seguimiento', 'En Rehabilitación', 'Próximo a Vencer', 'Vencido', 'Cerrado'],
    programasPve: [
      'No aplica',
      'PVE Biomecánico / Osteomuscular',
      'PVE Psicosocial',
      'PVE Visual',
      'PVE Auditivo',
      'PVE Cardiovascular y Metabólico',
      'PVE Respiratorio',
      'PVE Voz'
    ],
    estadosAccidente: [
      'No aplica',
      'En investigación / Reporte inicial',
      'En tratamiento médico',
      'En proceso de rehabilitación',
      'En calificación PCL (ARL / Junta)',
      'Cerrado sin secuelas',
      'Cerrado con secuelas',
      'Caso archivado'
    ],
    estadosEnfermedad: [
      'No aplica',
      'En estudio / Calificación de origen',
      'Origen laboral calificado en firme',
      'En tratamiento médico especializado',
      'En rehabilitación laboral',
      'Con reubicación / adecuación laboral',
      'Cerrado / Dictamen emitido'
    ],
    epsSugerencias: [
      'No aplica',
      'Nueva EPS',
      'Sanitas EPS',
      'Salud Total EPS',
      'Famisanar EPS',
      'Coosalud EPS',
      'Compensar EPS',
      'EPS Sura',
      'ARL Positiva Compañía de Seguros',
      'Asmet Salud',
      'Seguimiento por Medicina Laboral'
    ],
    restriccionesFrecuentes: [
      'NINGUNA',
      'Evitar levantamiento de cargas mayores a 5 kg',
      'Evitar levantamiento de cargas mayores a 10 kg',
      'Evitar bipedestación prolongada (más de 2 horas continuas)',
      'Evitar sedestación prolongada (realizar pausas activas cada 2 horas)',
      'Evitar movimientos repetitivos y flexoextensión forzada de miembros superiores',
      'Uso permanente de lentes correctivos para trabajo con pantallas (PVD)',
      'Uso obligatorio de elementos de protección auditiva',
      'Restricción para trabajo en alturas y espacios confinados',
      'Restricción para conducción de vehículos automotores'
    ],
    recomendacionesFrecuentes: [
      'Pausas activas e higiene postural',
      'Pausas activas visuales y ergonómicas cada 2 horas',
      'Adecuación ergonómica del puesto de trabajo (silla, descansapiés, soporte monitor)',
      'Seguimiento por optometría / oftalmología anual',
      'Seguimiento por audiometría ocupacional anual',
      'Control médico periódico por EPS tratante',
      'Ingreso y adherencia al Programa de Vigilancia Epidemiológica (PVE)',
      'Promoción de estilos de vida y trabajo saludable, actividad física y control de peso',
      'Seguimiento conjunto con ARL Positiva'
    ],
    actividadesPendientesFrecuentes: [
      'Ninguna',
      'Programar inspección de puesto de trabajo',
      'Seguimiento al cumplimiento de recomendaciones médicas en puesto de trabajo',
      'Remisión a especialista EPS tratante',
      'Seguimiento a dictamen de calificación ARL Positiva',
      'Programación de examen médico ocupacional de control',
      'Adecuación de elementos ergonómicos (silla ergonómica / descansapiés / soporte monitor)',
      'Capacitación y sensibilización en higiene postural y autocuidado'
    ],
    tiposIdentificacion: ['Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'Tarjeta de Identidad'],
    razas: ['Blanco/Mestizo', 'Afrodescendiente', 'Indígena', 'Raizal', 'Palenquero', 'Gitano', 'OTRA'],
    estadosCiviles: ['Soltero (a)', 'Casado(a)', 'Unión Libre', 'Divorciado(a)', 'Viudo(a)'],
    composicionesFamiliares: [
      'Padre',
      'Madre',
      'Conyuge Permanente, Hijos',
      'Hijos',
      'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )'
    ],
    tiposVivienda: ['Propia', 'Arriendo', 'Familiar'],
    estratos: ['1', '2', '3', '4', '5', '6'],
    escolaridades: [
      'Ninguna', 'Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo',
      'Profesional', 'Especialización', 'Maestría', 'Doctorado', 'Posdoctorado'
    ],
    rangosIngresos: ['Entre 1 y 3 SMMLV', 'Entre 3 y 6 SMMLV', 'Mas de 6 SMMLV'],
    tiposCargo: ['Asistencial', 'Técnico', 'Profesional', 'Asesor', 'Directivo', 'Libre Nombramiento', 'N/A'],
    tiposVinculacion: [
      'Carrera Administrativa', 'Provisional', 'Libre Nombramiento',
      'Planta Temporal', 'CPS', 'Estudiante/Aprendiz', 'Judicante', 'Tercerizado'
    ],
    rangosAntiguedad: [
      'Menos de 1 año.', 'Entre 1 y 4 años', 'Entre 4 y 10 años',
      'Entre 10 y 20 años', 'Entre 20 y 30 años', 'Mas de 30 años', 'N/A - CPS.'
    ]
  };

  function getCats() {
    const backend = state.catalogs || {};
    const merged = Object.assign({}, DEFAULT_CATALOGS);
    for (const [key, val] of Object.entries(backend)) {
      if (Array.isArray(val) && val.length > 0) {
        merged[key] = val;
      }
    }
    return merged;
  }

  function badgeClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('vigente') || e.includes('entregado') || e.includes('cerrado')) return 'badge--aprobada';
    if (e.includes('seguimiento') || e.includes('rehabilit') || e.includes('próximo') || e.includes('reposic')) return 'badge--revision';
    if (e.includes('vencid') || e.includes('devuelt')) return 'badge--rechazada';
    return 'badge--pendiente';
  }

  function formatDate(dStr) {
    if (!dStr) return '—';
    const clean = String(dStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  }

  // ─── Autocompletado de Servidores Públicos ─────────────────────────────────
  function onEmployeeInput(query) {
    clearTimeout(employeeSearchTimeout);
    const dropdown = document.getElementById('sst-autocomplete-list');
    if (!dropdown) return;

    const q = (query || '').trim();
    if (q.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    employeeSearchTimeout = setTimeout(async () => {
      try {
        const res = await API.getEmployees({ q, limit: 8 });
        const list = (res.data || []).filter(emp => !emp.esVacante);
        if (!list.length) {
          dropdown.style.display = 'none';
          return;
        }
        dropdown.innerHTML = list.map(emp => `
          <div class="autocomplete-item" onclick='SstModule.selectEmployee(${JSON.stringify({
            cedula: emp.cedula || '',
            nombreCompleto: emp.nombreCompleto || '',
            apellidos: `${emp.primerApellido || ''} ${emp.segundoApellido || ''}`.trim(),
            nombres: emp.nombres || '',
            dependencia: emp.dependencia || '',
            cargo: emp.cargoActual || emp.cargoBase || '',
            edad: emp.edad || '',
            sexo: emp.sexo || '',
            telefono: emp.celular || emp.telefonoFijo || '',
            fechaIngreso: emp.fechaIngreso || '',
            ciudad: emp.ciudad || 'Tunja',
            estudios: emp.estudios || '',
            clasificacion: emp.clasificacionEmpleo || 'Carrera Administrativa'
          }).replace(/'/g, '&#39;')})'>
            <div class="autocomplete-item-main">
              <strong>${escHtml(emp.nombreCompleto)}</strong>
              <span class="badge badge--pendiente" style="font-size:10px">C.C. ${escHtml(emp.cedula)}</span>
            </div>
            <div class="autocomplete-item-sub">${escHtml(emp.cargoActual || emp.cargoBase || '')} · ${escHtml(emp.dependencia || '')}</div>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      } catch {
        dropdown.style.display = 'none';
      }
    }, 260);
  }

    function onFechaEmoChange(val) {
    if (!val) return;
    const tipo = document.getElementById('sst-tipo-emo')?.value;
    const proxInput = document.getElementById('sst-prox-emo');
    if (proxInput && tipo !== 'Egreso') {
      try {
        const d = new Date(val + 'T00:00:00');
        d.setFullYear(d.getFullYear() + 1);
        proxInput.value = d.toISOString().split('T')[0];
      } catch (_) {}
    }
  }

  function onTipoEmoChange(val) {
    const proxInput = document.getElementById('sst-prox-emo');
    if (!proxInput) return;
    if (val === 'Egreso') {
      proxInput.value = '';
    } else if (!proxInput.value) {
      const fEmo = document.getElementById('sst-fecha-emo')?.value;
      if (fEmo) onFechaEmoChange(fEmo);
    }
  }

  function onAtToggle(val) {
    const fAt = document.getElementById('sst-fecha-at');
    const estAt = document.getElementById('sst-estado-at');
    const isSi = val === 'SI';
    if (fAt) {
      fAt.disabled = !isSi;
      if (!isSi) fAt.value = '';
    }
    if (estAt) {
      estAt.disabled = !isSi;
      if (!isSi) estAt.value = 'No aplica';
      else if (estAt.value === 'No aplica') estAt.value = 'En investigación / Reporte inicial';
    }
  }

  function onElToggle(val) {
    const fEl = document.getElementById('sst-fecha-el');
    const estEl = document.getElementById('sst-estado-el');
    const isSi = val === 'SI';
    if (fEl) {
      fEl.disabled = !isSi;
      if (!isSi) fEl.value = '';
    }
    if (estEl) {
      estEl.disabled = !isSi;
      if (!isSi) estEl.value = 'No aplica';
      else if (estEl.value === 'No aplica') estEl.value = 'En estudio / Calificación de origen';
    }
  }

  function onApellidosNombresChange() {
    const ape = (document.getElementById('sst-apellidos')?.value || '').trim();
    const nom = (document.getElementById('sst-nombres')?.value || '').trim();
    const nomInput = document.getElementById('sst-nombre');
    if (nomInput && (ape || nom)) {
      nomInput.value = `${ape} ${nom}`.trim();
    }
  }

  function selectEmployee(emp) {
    const dropdown = document.getElementById('sst-autocomplete-list');
    if (dropdown) dropdown.style.display = 'none';

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== '') el.value = val;
    };

    setVal('sst-nombre', emp.nombreCompleto);
    setVal('sst-doc', emp.cedula);
    setVal('sst-apellidos', emp.apellidos || (emp.nombreCompleto ? emp.nombreCompleto.split(' ').slice(0, 2).join(' ') : ''));
    setVal('sst-nombres', emp.nombres || (emp.nombreCompleto ? emp.nombreCompleto.split(' ').slice(2).join(' ') : ''));
    setVal('sst-dep', emp.dependencia);
    setVal('sst-cargo', emp.cargo);
    setVal('sst-tel', emp.telefono);
    setVal('sst-edad', emp.edad);
    if (emp.fechaIngreso) {
      const fIng = String(emp.fechaIngreso).split('T')[0];
      setVal('sst-ingreso', fIng);
    }
    setVal('sst-profesion', emp.estudios);
    setVal('sst-mpio-res', emp.ciudad);
    if (emp.sexo) {
      const s = emp.sexo.toUpperCase().startsWith('F') ? 'Femenino' : 'Masculino';
      setVal('sst-sexo', s);
    }
  }

  // ─── Dropdown de Opciones Secundarias (Ley de Hick & WCAG 2.1 AA) ──────────
  function toggleActionsDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('sst-dropdown-menu');
    const toggleBtn = document.getElementById('sst-dropdown-toggle');
    if (!menu || !toggleBtn) return;
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      const firstItem = menu.querySelector('.actions-dropdown-item');
      if (firstItem) firstItem.focus();
    } else {
      closeActionsDropdown();
    }
  }

  function closeActionsDropdown() {
    const menu = document.getElementById('sst-dropdown-menu');
    const toggleBtn = document.getElementById('sst-dropdown-toggle');
    if (menu) menu.setAttribute('hidden', '');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus();
    }
  }

  function handleDropdownKeydown(event) {
    if (event.key === 'Escape') {
      closeActionsDropdown();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const menu = document.getElementById('sst-dropdown-menu');
      if (menu && menu.hasAttribute('hidden')) {
        toggleActionsDropdown(event);
      } else if (menu) {
        const first = menu.querySelector('.actions-dropdown-item');
        if (first) first.focus();
      }
    }
  }

  function bindDropdownOutsideClick() {
    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.actions-dropdown-wrap');
      const menu = document.getElementById('sst-dropdown-menu');
      if (menu && !menu.hasAttribute('hidden') && wrap && !wrap.contains(e.target)) {
        menu.setAttribute('hidden', '');
        const toggleBtn = document.getElementById('sst-dropdown-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const menu = document.getElementById('sst-dropdown-menu');
        if (menu && !menu.hasAttribute('hidden')) {
          closeActionsDropdown();
        }
      }
    });
  }

  // ─── Render Principal del Módulo SST ──────────────────────────────────────
  async function render(container, initialTab = 'epidemiologico') {
    if (TABS[initialTab]) state.tab = initialTab;
    state.page = 1;
    state.filters = { q: '', subFilter1: 'Todos', subFilter2: 'Todos' };

    const tabCfg = TABS[state.tab];
    const canManage = Auth.canEdit();

    container.innerHTML = `
      <div class="module-enter">
        <div class="page-header">
          <div class="page-header-info">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 class="page-heading" id="sst-heading">${escHtml(tabCfg.title)}</h1>
            </div>
            <p class="page-desc" id="sst-desc">${escHtml(tabCfg.desc)}</p>
          </div>
          <div class="page-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Dropdown de Opciones Secundarias (Hick's Law) -->
            <div class="actions-dropdown-wrap">
              <button
                type="button"
                class="btn btn-secondary actions-dropdown-btn"
                id="sst-dropdown-toggle"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="sst-dropdown-menu"
                onclick="SstModule.toggleActionsDropdown(event)"
                onkeydown="SstModule.handleDropdownKeydown(event)"
                title="Opciones secundarias (Excel y plantillas)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                <span>Acciones</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div
                class="actions-dropdown-menu"
                id="sst-dropdown-menu"
                role="menu"
                aria-labelledby="sst-dropdown-toggle"
                hidden
              >
                <!-- 1. Exportar a Excel -->
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.openExportProfileModal();"
                  title="Exportar perfil seleccionado a plantilla oficial o listado completo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <div>
                    <strong>Exportar a Excel</strong>
                    <small>Descargar perfil en plantilla oficial (.xlsx) o tabla actual</small>
                  </div>
                </button>

                <!-- 2. Descargar la Plantilla Oficial -->
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.downloadOfficialTemplate();"
                  title="Descargar archivo Excel oficial en blanco para diligenciar"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  <div>
                    <strong>Descargar la Plantilla Oficial</strong>
                    <small>Archivo Excel vacío oficial con columnas y listas de validación</small>
                  </div>
                </button>

                <!-- 3. Cargue Masivo de un Excel -->
                ${canManage ? `
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.openImportModal();"
                  title="Cargar archivo Excel con perfiles y guardar en el sistema"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div>
                    <strong>Cargue Masivo de un Excel</strong>
                    <small>Importar múltiples perfiles registrados desde archivo Excel</small>
                  </div>
                </button>` : ''}

                <!-- 4. Descargar Reporte Anual -->
                <button
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="actions-dropdown-item"
                  onclick="SstModule.closeActionsDropdown(); SstModule.generateAnnualReport();"
                  style="border-top: 1px solid var(--border-color, #e2e8f0); margin-top: 4px; padding-top: 8px;"
                  title="Generar y descargar informe anual con estadísticas y base completa"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-primary-400, #16a34a);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                  <div>
                    <strong style="color:var(--color-primary-400, #16a34a);">Descargar Reporte Anual</strong>
                    <small>Consolidado anual con estadísticas, gráficos e indicadores SST</small>
                  </div>
                </button>
              </div>
            </div>

            <!-- Acción Primaria (CTA - Visual Salience) -->
            ${canManage ? `
            <button class="btn btn-primary btn-primary-cta" id="sst-create-btn" onclick="SstModule.openCreate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span id="sst-create-btn-text">${escHtml(tabCfg.btnCreate)}</span>
            </button>` : ''}
          </div>
        </div>

        <!-- KPIs SST -->
        <div class="stats-grid" id="sst-stats-grid" style="margin-bottom:var(--space-5);">
          ${renderStatsSkeletons()}
        </div>

        <!-- Pestañas de Submódulos SST -->
        <div class="module-tabs">
          <button class="tab-btn ${state.tab === 'epidemiologico' ? 'active' : ''}" onclick="SstModule.setTab('epidemiologico', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Perfil Epidemiológico y EMO
          </button>
          <button class="tab-btn ${state.tab === 'epp' ? 'active' : ''}" onclick="SstModule.setTab('epp', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Entrega de EPP
          </button>
          <button class="tab-btn ${state.tab === 'sociodemografico' ? 'active' : ''}" onclick="SstModule.setTab('sociodemografico', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Perfil Sociodemográfico
          </button>
        </div>

        <!-- Filtros Dinámicos -->
        <div class="filters-card" id="sst-filters-container">
          ${renderFiltersHtml()}
        </div>

        <!-- Tabla Principal -->
        <div class="table-card">
          <div class="table-header table-header--horarios">
            <span class="table-title" id="sst-table-title">${escHtml(tabCfg.title)}</span>
            <button type="button" id="sst-btn-vencimientos" class="btn-check-vencimientos" style="${state.tab === 'epidemiologico' ? '' : 'display:none'}" onclick="SstModule.checkEmoVencimientos()" title="Verificar Exámenes Médicos Ocupacionales próximos a vencer o vencidos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Verificar Vencimientos EMO</span>
            </button>
            <span class="table-count" id="sst-count">
              <span class="skeleton" style="width:110px;height:14px;border-radius:4px;" aria-hidden="true"></span>
            </span>
          </div>
          <div class="table-wrap">
            <table aria-label="Registros de Seguridad y Salud en el Trabajo">
              <thead id="sst-thead">${renderTheadHtml()}</thead>
              <tbody id="sst-tbody" aria-busy="true" role="progressbar" aria-label="Cargando registros de SST...">
                ${renderSkeletonRows(state.tab)}
              </tbody>
            </table>
          </div>
          <div class="pagination" id="sst-pagination"></div>
        </div>
      </div>
    `;

    bindDropdownOutsideClick();
    // Cargar catálogos y estadísticas en paralelo
    API.getSstCatalogs().then(c => { state.catalogs = c; }).catch(() => {});
    loadStats();
    await load();
  }

  function renderFiltersHtml() {
    const cats = getCats();
    if (state.tab === 'epidemiologico') {
      return `
        <div class="filters-row">
          <div class="filter-group" style="flex:2">
            <label class="filter-label">Buscar Servidor / PVE / Restricción</label>
            <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, dependencia, PVE..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">Tipo de EMO</label>
            <select id="sst-filter-1" class="filter-select">
              <option value="Todos">Todos los tipos</option>
              ${cats.tiposEmo.map(t => `<option value="${escHtml(t)}" ${state.filters.subFilter1 === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Estado del Caso</label>
            <select id="sst-filter-2" class="filter-select">
              <option value="Todos">Todos los estados</option>
              ${cats.estadosCaso.map(e => `<option value="${escHtml(e)}" ${state.filters.subFilter2 === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
          <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
        </div>`;
    }
    if (state.tab === 'epp') {
      return `
        <div class="filters-row">
          <div class="filter-group" style="flex:2">
            <label class="filter-label">Buscar Servidor / Elemento EPP</label>
            <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, dependencia o elemento..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">Elemento EPP (Catálogo A-AB)</label>
            <select id="sst-filter-1" class="filter-select">
              <option value="Todos">Todos los elementos</option>
              ${cats.eppCatalogo.map(e => `<option value="${escHtml(e.codigo)}" ${state.filters.subFilter1 === e.codigo ? 'selected' : ''}>${escHtml(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Estado de Entrega</label>
            <select id="sst-filter-2" class="filter-select">
              <option value="Todos">Todos</option>
              ${['Entregado', 'Reposición Programada', 'Pendiente Firma', 'Devuelto'].map(s => `<option value="${s}" ${state.filters.subFilter2 === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
          <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
        </div>`;
    }
    return `
      <div class="filters-row">
        <div class="filter-group" style="flex:2">
          <label class="filter-label">Buscar Servidor / Profesión / Dependencia</label>
          <input id="sst-q" class="filter-input" placeholder="Nombre, cédula, profesión, dependencia..." value="${escHtml(state.filters.q || '')}" onkeypress="if(event.key==='Enter')SstModule.applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label">Escolaridad</label>
          <select id="sst-filter-1" class="filter-select">
            <option value="Todas">Todas</option>
            ${cats.escolaridades.map(e => `<option value="${escHtml(e)}" ${state.filters.subFilter1 === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Tipo de Vinculación</label>
          <select id="sst-filter-2" class="filter-select">
            <option value="Todos">Todos</option>
            ${cats.tiposVinculacion.map(v => `<option value="${escHtml(v)}" ${state.filters.subFilter2 === v ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="SstModule.applyFilters()">Filtrar</button>
        <button class="btn btn-secondary" onclick="SstModule.clearFilters()">Limpiar</button>
      </div>`;
  }

  function renderTheadHtml() {
    if (state.tab === 'epidemiologico') {
      return `<tr>
        <th>Código</th>
        <th>Servidor Público</th>
        <th>Dependencia & Sede</th>
        <th>Tipo & Fecha EMO</th>
        <th>PVE / Restricciones</th>
        <th>Próximo EMO</th>
        <th>Estado Caso</th>
        <th style="text-align:right">Acciones</th>
      </tr>`;
    }
    if (state.tab === 'epp') {
      return `<tr>
        <th>Radicado</th>
        <th>Servidor Público</th>
        <th>Dependencia & Cargo</th>
        <th>Elemento EPP Entregado</th>
        <th>Talla & Cantidad</th>
        <th>Fecha Entrega</th>
        <th>Estado</th>
        <th style="text-align:right">Acciones</th>
      </tr>`;
    }
    return `<tr>
      <th>Código</th>
      <th>Servidor Público</th>
      <th>Sexo & Edad</th>
      <th>Escolaridad & Profesión</th>
      <th>Dependencia & Sede</th>
      <th>Vinculación & Ingresos</th>
      <th>Estado Civil / Estrato</th>
      <th style="text-align:right">Acciones</th>
    </tr>`;
  }

  async function setTab(tabKey, activeBtn) {
    if (!TABS[tabKey]) return;
    state.tab = tabKey;
    state.page = 1;
    state.filters = { q: '', subFilter1: 'Todos', subFilter2: 'Todos' };

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    // Sincronizar submenú lateral SST
    const sideMap = {
      epidemiologico: 'nav-sst-epidemiologico',
      epp: 'nav-sst-epp',
      sociodemografico: 'nav-sst-sociodemografico'
    };
    document.querySelectorAll('#sst-submenu .nav-subitem').forEach(b => b.classList.remove('active'));
    const sideBtn = document.getElementById(sideMap[tabKey]);
    if (sideBtn) sideBtn.classList.add('active');

    const tabCfg = TABS[tabKey];
    const heading = document.getElementById('sst-heading');
    if (heading) heading.textContent = tabCfg.title;
    const codeBadge = document.getElementById('sst-format-code');
    if (codeBadge) codeBadge.style.display = 'none';
    const desc = document.getElementById('sst-desc');
    if (desc) desc.textContent = tabCfg.desc;
    const tableTitle = document.getElementById('sst-table-title');
    if (tableTitle) tableTitle.textContent = tabCfg.title;
    const createBtnTxt = document.getElementById('sst-create-btn-text');
    if (createBtnTxt) createBtnTxt.textContent = tabCfg.btnCreate;
    const btnVenc = document.getElementById('sst-btn-vencimientos');
    if (btnVenc) btnVenc.style.display = tabKey === 'epidemiologico' ? '' : 'none';

    const filtersContainer = document.getElementById('sst-filters-container');
    if (filtersContainer) filtersContainer.innerHTML = renderFiltersHtml();
    const thead = document.getElementById('sst-thead');
    if (thead) thead.innerHTML = renderTheadHtml();

    renderSkeletonTable();
    loadStats();
    await load();
  }

  function renderStatsSkeletons() {
    return Array(5).fill(0).map(() => `
      <div class="stat-card" aria-busy="true" role="progressbar">
        <div class="stat-icon skeleton" style="width:48px;height:48px;border-radius:12px;"></div>
        <div class="stat-info" style="display:flex;flex-direction:column;gap:6px;flex:1;">
          <span class="skeleton skeleton-line" style="width:50px;height:24px;border-radius:4px;margin-bottom:0;"></span>
          <span class="skeleton skeleton-line" style="width:110px;height:12px;border-radius:4px;margin-bottom:0;"></span>
        </div>
      </div>
    `).join('');
  }

  function renderSkeletonRows(tabKey = 'epidemiologico', count = 7) {
    if (tabKey === 'epp') {
      return Array.from({ length: count }).map((_, i) => `
        <tr class="skeleton-row" style="animation-delay: ${i * 0.07}s" aria-hidden="true">
          <td><div class="skeleton skeleton-badge" style="width: 85px; height: 20px;"></div></td>
          <td>
            <div class="skeleton-user-cell">
              <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
              <div class="skeleton-text-group">
                <div class="skeleton skeleton-line skeleton-line--title" style="width:${i % 2 === 0 ? '80%' : '70%'}; height:14px;"></div>
                <div class="skeleton skeleton-line" style="width:50%; height:11px;"></div>
              </div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width:${i % 3 === 0 ? '85%' : '75%'}; height:13px;"></div>
              <div class="skeleton skeleton-line" style="width:45%; height:11px;"></div>
            </div>
          </td>
          <td><div class="skeleton skeleton-line" style="width: 140px; height: 13px;"></div></td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-badge" style="width: 65px; height: 18px;"></div>
              <div class="skeleton skeleton-line" style="width: 45px; height: 10px;"></div>
            </div>
          </td>
          <td><div class="skeleton skeleton-line" style="width: 80px; height: 13px;"></div></td>
          <td><div class="skeleton skeleton-badge" style="width: 85px; height: 22px;"></div></td>
          <td>
            <div class="skeleton-actions-wrap">
              <div class="skeleton skeleton-btn"></div>
              <div class="skeleton skeleton-btn"></div>
            </div>
          </td>
        </tr>
      `).join('');
    }

    if (tabKey === 'sociodemografico') {
      return Array.from({ length: count }).map((_, i) => `
        <tr class="skeleton-row" style="animation-delay: ${i * 0.07}s" aria-hidden="true">
          <td><div class="skeleton skeleton-badge" style="width: 85px; height: 20px;"></div></td>
          <td>
            <div class="skeleton-user-cell">
              <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
              <div class="skeleton-text-group">
                <div class="skeleton skeleton-line skeleton-line--title" style="width:${i % 2 === 0 ? '80%' : '70%'}; height:14px;"></div>
                <div class="skeleton skeleton-line" style="width:50%; height:11px;"></div>
              </div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width: 70px; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 45px; height: 11px;"></div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width: 100px; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 80px; height: 11px;"></div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width:${i % 3 === 0 ? '90%' : '80%'}; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 60px; height: 11px;"></div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width: 85px; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 70px; height: 11px;"></div>
            </div>
          </td>
          <td>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line" style="width: 75px; height: 13px;"></div>
              <div class="skeleton skeleton-line" style="width: 55px; height: 11px;"></div>
            </div>
          </td>
          <td>
            <div class="skeleton-actions-wrap">
              <div class="skeleton skeleton-btn"></div>
              <div class="skeleton skeleton-btn"></div>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // epidemiologico (default)
    return Array.from({ length: count }).map((_, i) => `
      <tr class="skeleton-row" style="animation-delay: ${i * 0.07}s" aria-hidden="true">
        <td><div class="skeleton skeleton-badge" style="width: 85px; height: 20px;"></div></td>
        <td>
          <div class="skeleton-user-cell">
            <div class="skeleton skeleton-avatar" aria-hidden="true"></div>
            <div class="skeleton-text-group">
              <div class="skeleton skeleton-line skeleton-line--title" style="width:${i % 2 === 0 ? '80%' : '70%'}; height:14px;"></div>
              <div class="skeleton skeleton-line" style="width:50%; height:11px;"></div>
            </div>
          </div>
        </td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton skeleton-line" style="width:${i % 3 === 0 ? '85%' : '75%'}; height:13px;"></div>
            <div class="skeleton skeleton-line" style="width:45%; height:11px;"></div>
          </div>
        </td>
        <td>
          <div class="skeleton-text-group">
            <div class="skeleton skeleton-badge" style="width: 75px; height: 18px;"></div>
            <div class="skeleton skeleton-line" style="width: 65px; height: 11px;"></div>
          </div>
        </td>
        <td><div class="skeleton skeleton-line" style="width: 110px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-line" style="width: 75px; height: 13px;"></div></td>
        <td><div class="skeleton skeleton-badge" style="width: 80px; height: 22px;"></div></td>
        <td>
          <div class="skeleton-actions-wrap">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn"></div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSkeletonTable() {
    const countEl = document.getElementById('sst-count');
    if (countEl) {
      countEl.innerHTML = `<span class="skeleton" style="width:110px;height:14px;border-radius:4px;" aria-hidden="true"></span>`;
    }
    const tbody = document.getElementById('sst-tbody');
    if (!tbody) return;
    tbody.setAttribute('aria-busy', 'true');
    tbody.setAttribute('role', 'progressbar');
    tbody.setAttribute('aria-label', `Cargando registros de ${TABS[state.tab]?.title || 'SST'}...`);
    tbody.innerHTML = renderSkeletonRows(state.tab);
  }

  async function load() {
    renderSkeletonTable();
    try {
      let res;
      if (state.tab === 'epidemiologico') {
        res = await API.getSstEpidemiologico({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          tipoEmo: state.filters.subFilter1 || 'Todos',
          estadoCaso: state.filters.subFilter2 || 'Todos'
        });
      } else if (state.tab === 'epp') {
        res = await API.getSstEpp({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          elemento: state.filters.subFilter1 || 'Todos',
          estado: state.filters.subFilter2 || 'Todos'
        });
      } else {
        res = await API.getSstSociodemografico({
          page: state.page,
          limit: 20,
          q: state.filters.q || '',
          escolaridad: state.filters.subFilter1 || 'Todas',
          tipoVinculacion: state.filters.subFilter2 || 'Todos'
        });
      }

      state.data = res.data || [];
      state.total = res.total || 0;
      state.totalPages = res.totalPages || 1;
      renderTable();
      renderPagination();

      const countEl = document.getElementById('sst-count');
      if (countEl) countEl.textContent = `${state.total.toLocaleString('es-CO')} registros`;
    } catch (err) {
      App.showToast('Error al cargar registros SST: ' + err.message, 'error');
    }
  }

  function renderTable() {
    const tbody = document.getElementById('sst-tbody');
    if (!tbody) return;
    tbody.removeAttribute('role');
    tbody.setAttribute('aria-busy', 'false');

    if (!state.data.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span class="empty-state-title">No hay registros en ${escHtml(TABS[state.tab].title)}</span>
        <span class="empty-state-desc">Crea un nuevo registro o realiza una carga masiva desde Excel.</span>
      </div></td></tr>`;
      return;
    }

    if (state.tab === 'epidemiologico') {
      tbody.innerHTML = state.data.map(r => `
        <tr>
          <td class="td-radicado">${escHtml(r.radicado)}</td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)} ${r.edad ? `· ${r.edad} años` : ''}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 26))}</span>
              <span class="user-table-cc">${escHtml(truncate(r.sedeTrabajo || 'CASA DE LA TORRE', 24))}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span class="badge badge--permiso">${escHtml(r.tipoEmo)}</span>
              <span class="user-table-cc">${formatDate(r.fechaEmo)}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.direccionadoPve)}">${escHtml(truncate(r.direccionadoPve || 'No aplica', 24))}</span>
              <span class="user-table-cc" title="${escHtml(r.restricciones)}">${escHtml(truncate(r.restricciones || 'Sin restricciones', 26))}</span>
            </div>
          </td>
          <td>${formatDate(r.fechaProximoEmo)}</td>
          <td>
            <span class="badge ${badgeClass(r.estadoFinalCaso)}">${escHtml(r.estadoFinalCaso)}</span>
            ${(r.accidenteTrabajo === 'SI' || r.enfermedadLaboral === 'SI') ? '<span class="badge badge--incapacidad" style="margin-left:4px;font-size:10px;" title="Caso con Accidente de Trabajo o Enfermedad Laboral">AT/EL</span>' : ''}
          </td>
          <td class="td-actions">
            <div class="td-actions-wrap">
              <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Ficha Epidemiológica">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="SstModule.exportSingleProfileExcel(${r.id})" title="Descargar Perfil en Plantilla Oficial Excel (.xlsx)" style="color:#16a34a;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9h1"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="SstModule.exportSinglePdf(${r.id})" title="Descargar Ficha Médica EMO (PDF)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              ${Auth.canEdit() ? `
              <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Registro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Registro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`).join('');
      return;
    }

    if (state.tab === 'epp') {
      tbody.innerHTML = state.data.map(r => `
        <tr>
          <td class="td-radicado">${escHtml(r.radicado)}</td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
              <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)}</span>
            </div>
          </td>
          <td>
            <div class="user-table-cell">
              <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 26))}</span>
              <span class="user-table-cc">${escHtml(truncate(r.cargo || '', 24))}</span>
            </div>
          </td>
          <td><span class="badge badge--licencia">${escHtml(r.elementoEpp)}</span></td>
          <td>
            <div class="user-table-cell">
              <span class="td-primary">${escHtml(r.cantidad)}</span>
              <span class="user-table-cc">Talla: ${escHtml(r.talla || 'N/A')}</span>
            </div>
          </td>
          <td>${formatDate(r.fechaEntrega)}</td>
          <td>
            <span class="badge ${badgeClass(r.estadoEntrega)}">${escHtml(r.estadoEntrega)}</span>
            ${r.firmaDigital ? `
              <div style="margin-top:4px;">
                <span class="badge badge--aprobada" style="font-size:10px;padding:1px 6px;gap:3px;display:inline-flex;align-items:center;" title="Entrega verificada y firmada digitalmente en tablet">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px;"><polyline points="20 6 9 17 4 12"/></svg>
                  Firmado
                </span>
              </div>
            ` : ''}
          </td>
          <td class="td-actions">
            <div class="td-actions-wrap">
              <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Detalle de Entrega EPP">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-action-soporte" onclick="SstModule.exportSinglePdf(${r.id})" title="Descargar Acta de Entrega EPP (PDF)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              ${Auth.canEdit() ? `
              <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Entrega">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Entrega">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`).join('');
      return;
    }

    // Sociodemográfico
    tbody.innerHTML = state.data.map(r => `
      <tr>
        <td class="td-radicado">${escHtml(r.radicado)}</td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary" title="${escHtml(r.nombreCompleto)}">${escHtml(truncate(r.nombreCompleto, 26))}</span>
            <span class="user-table-cc font-mono">C.C. ${escHtml(r.documento)}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span>${escHtml(r.sexo || '—')}</span>
            <span class="user-table-cc">${r.edad ? `${r.edad} años (${r.anioNacimiento || ''})` : '—'}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span class="badge badge--permiso">${escHtml(r.escolaridad || 'Profesional')}</span>
            <span class="user-table-cc">${escHtml(truncate(r.ocupacionProfesion || r.denominacionCargo || '', 22))}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span title="${escHtml(r.dependencia)}">${escHtml(truncate(r.dependencia, 24))}</span>
            <span class="user-table-cc">${escHtml(truncate(r.sedeTrabajo || '', 22))}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span class="td-primary">${escHtml(r.tipoVinculacion || '—')}</span>
            <span class="user-table-cc">${escHtml(r.rangoIngresos || '—')}</span>
          </div>
        </td>
        <td>
          <div class="user-table-cell">
            <span>${escHtml(r.estadoCivil || '—')}</span>
            <span class="user-table-cc">Estrato ${escHtml(r.estrato || '—')} · ${escHtml(r.tipoVivienda || '')}</span>
          </div>
        </td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="btn-action-view" onclick="SstModule.openView(${r.id})" title="Ver Ficha Sociodemográfica">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${Auth.canEdit() ? `
            <button class="btn-action-edit" onclick="SstModule.openEdit(${r.id})" title="Editar Perfil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-action-delete" onclick="SstModule.confirmDelete(${r.id}, '${escHtml(r.nombreCompleto)}')" title="Eliminar Perfil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  }

  function renderPagination() {
    const el = document.getElementById('sst-pagination');
    if (!el) return;
    el.innerHTML = `
      <span class="pagination-info">Mostrando ${state.data.length} de ${state.total.toLocaleString('es-CO')}</span>
      <div class="pagination-btns">
        <button class="page-btn" onclick="SstModule.goPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="page-btn active">${state.page}</span>
        <span style="color:var(--text-muted);font-size:var(--text-sm)">/ ${state.totalPages}</span>
        <button class="page-btn" onclick="SstModule.goPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
  }

  // ─── Formularios por Submódulo ─────────────────────────────────────────────
  function buildForm(r = {}) {
    const cats = getCats();
    currentUploadedFile = r.soporte || null;

    if (state.tab === 'epidemiologico') {
      const apellidos = r.apellidos || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(0, 2).join(' ') : '');
      const nombres = r.nombres || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(2).join(' ') : '');
      const isAt = (r.accidenteTrabajo === 'SI');
      const isEl = (r.enfermedadLaboral === 'SI');

      return `
        <div class="form-grid">
          <!-- SECCIÓN 1: DATOS DEL SERVIDOR PÚBLICO -->
          <div class="form-group span-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--color-primary-400); display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              1. Información del Servidor Público
            </h4>
          </div>

          <div class="form-group span-2 autocomplete-wrapper">
            <label class="form-label">Servidor Público <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escriba nombre o cédula para autocompletar desde planta)</span></label>
            <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario por nombre o documento..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" />
            <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Tipo de Identificación *</label>
            <select id="sst-tipo-id" class="filter-select">
              ${cats.tiposIdentificacion.map(t => `<option ${r.tipoIdentificacion === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Número de Documento *</label>
            <input id="sst-doc" class="form-input" placeholder="Cédula de ciudadanía o extranjería" value="${escHtml(r.documento || '')}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Apellidos *</label>
            <input id="sst-apellidos" class="form-input" placeholder="Primer y segundo apellido" value="${escHtml(apellidos)}" oninput="SstModule.onApellidosNombresChange()" required />
          </div>

          <div class="form-group">
            <label class="form-label">Nombres *</label>
            <input id="sst-nombres" class="form-input" placeholder="Nombres completos" value="${escHtml(nombres)}" oninput="SstModule.onApellidosNombresChange()" required />
          </div>

          <div class="form-group">
            <label class="form-label">Teléfono / Celular</label>
            <input id="sst-tel" class="form-input" placeholder="Número de contacto (Ej: 3101234567)" value="${escHtml(r.telefono || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">Edad (años)</label>
            <input id="sst-edad" type="number" min="18" max="99" class="form-input" placeholder="Edad" value="${escHtml(r.edad || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">Fecha de Ingreso a la Entidad</label>
            <input id="sst-ingreso" type="date" class="form-input" value="${escHtml(r.fechaIngreso || '')}" />
          </div>

          <div class="form-group span-2">
            <label class="form-label">Dependencia donde Trabaja *</label>
            <input id="sst-dep" list="sst-deps-list" class="form-input" placeholder="Haga clic para desplegar lista o escriba para filtrar..." value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" required />
            <datalist id="sst-deps-list">
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label class="form-label">Sede de Trabajo</label>
            <select id="sst-sede" class="filter-select">
              ${cats.sedes.map(s => `<option ${r.sedeTrabajo === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Cargo</label>
            <input id="sst-cargo" class="form-input" placeholder="Denominación del cargo" value="${escHtml(r.cargo || 'PROFESIONAL UNIVERSITARIO')}" />
          </div>

          <!-- SECCIÓN 2: EXAMEN MÉDICO OCUPACIONAL (EMO) Y PVE -->
          <div class="form-group span-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; margin-top: 10px; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--color-primary-400); display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              2. Examen Médico Ocupacional (EMO) y Vigilancia Epidemiológica
            </h4>
          </div>

          <div class="form-group">
            <label class="form-label">Tipo de EMO *</label>
            <select id="sst-tipo-emo" class="filter-select" onchange="SstModule.onTipoEmoChange(this.value)">
              ${cats.tiposEmo.map(t => `<option ${r.tipoEmo === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Fecha Realización EMO *</label>
            <input id="sst-fecha-emo" type="date" class="form-input" value="${escHtml(r.fechaEmo || new Date().toISOString().split('T')[0])}" onchange="SstModule.onFechaEmoChange(this.value)" required />
          </div>

          <div class="form-group">
            <label class="form-label">Fecha Próximo EMO</label>
            <input id="sst-prox-emo" type="date" class="form-input" value="${escHtml(r.fechaProximoEmo || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">Direccionado a PVE</label>
            <select id="sst-pve" class="filter-select">
              ${cats.programasPve.map(p => `<option ${r.direccionadoPve === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group span-2">
            <label class="form-label">Direccionado a EPS / IPS</label>
            <input id="sst-eps" list="sst-eps-list" class="form-input" placeholder="Seleccione o escriba entidad de salud (Ej: Nueva EPS / No aplica)" value="${escHtml(r.direccionadoEps || 'No aplica')}" />
            <datalist id="sst-eps-list">
              ${(cats.epsSugerencias || []).map(eps => `<option value="${escHtml(eps)}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group span-2">
            <label class="form-label">Restricciones Médicas Laborales</label>
            <input id="sst-restricciones" list="sst-restricciones-list" class="form-input" placeholder="Haga clic para opciones frecuentes o escriba la restricción médica..." value="${escHtml(r.restricciones || 'NINGUNA')}" />
            <datalist id="sst-restricciones-list">
              ${(cats.restriccionesFrecuentes || []).map(rf => `<option value="${escHtml(rf)}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group span-2">
            <label class="form-label">Recomendaciones Médicas Ocupacionales</label>
            <input id="sst-recomendaciones" list="sst-recomendaciones-list" class="form-input" placeholder="Haga clic para recomendaciones frecuentes o escriba..." value="${escHtml(r.recomendaciones || 'Pausas activas e higiene postural')}" />
            <datalist id="sst-recomendaciones-list">
              ${(cats.recomendacionesFrecuentes || []).map(rc => `<option value="${escHtml(rc)}"></option>`).join('')}
            </datalist>
          </div>

          <!-- SECCIÓN 3: ACCIDENTE DE TRABAJO Y ENFERMEDAD LABORAL -->
          <div class="form-group span-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; margin-top: 10px; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--color-primary-400); display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              3. Accidente de Trabajo (AT) y Enfermedad Laboral (EL)
            </h4>
          </div>

          <div class="form-group">
            <label class="form-label">¿Accidente de Trabajo (AT)?</label>
            <select id="sst-at" class="filter-select" onchange="SstModule.onAtToggle(this.value)">
              <option value="NO" ${!isAt ? 'selected' : ''}>NO</option>
              <option value="SI" ${isAt ? 'selected' : ''}>SI</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Fecha del Accidente (AT)</label>
            <input id="sst-fecha-at" type="date" class="form-input" value="${escHtml(r.fechaAccidente || '')}" ${isAt ? '' : 'disabled'} />
          </div>

          <div class="form-group span-2">
            <label class="form-label">Estado Actual del Accidente</label>
            <input id="sst-estado-at" list="sst-estado-at-list" class="form-input" placeholder="Seleccione o escriba estado actual del accidente..." value="${escHtml(r.estadoActualAccidente || 'No aplica')}" ${isAt ? '' : 'disabled'} />
            <datalist id="sst-estado-at-list">
              ${(cats.estadosAccidente || []).map(ea => `<option value="${escHtml(ea)}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label class="form-label">¿Enfermedad Laboral (EL)?</label>
            <select id="sst-el" class="filter-select" onchange="SstModule.onElToggle(this.value)">
              <option value="NO" ${!isEl ? 'selected' : ''}>NO</option>
              <option value="SI" ${isEl ? 'selected' : ''}>SI</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Fecha Diagnóstico Enfermedad (EL)</label>
            <input id="sst-fecha-el" type="date" class="form-input" value="${escHtml(r.fechaEnfermedad || '')}" ${isEl ? '' : 'disabled'} />
          </div>

          <div class="form-group span-2">
            <label class="form-label">Estado Actual de la Enfermedad</label>
            <input id="sst-estado-el" list="sst-estado-el-list" class="form-input" placeholder="Seleccione o escriba estado actual de la enfermedad..." value="${escHtml(r.estadoActualEnfermedad || 'No aplica')}" ${isEl ? '' : 'disabled'} />
            <datalist id="sst-estado-el-list">
              ${(cats.estadosEnfermedad || []).map(ee => `<option value="${escHtml(ee)}"></option>`).join('')}
            </datalist>
          </div>

          <div class="form-group">
            <label class="form-label">¿Cumplió Proceso de Rehabilitación?</label>
            <select id="sst-rehab" class="filter-select">
              <option value="N/A" ${(!r.cumplioRehabilitacion || r.cumplioRehabilitacion === 'N/A') ? 'selected' : ''}>N/A</option>
              <option value="SI" ${r.cumplioRehabilitacion === 'SI' ? 'selected' : ''}>SI</option>
              <option value="NO" ${r.cumplioRehabilitacion === 'NO' ? 'selected' : ''}>NO</option>
            </select>
          </div>

          <!-- SECCIÓN 4: ESTADO FINAL Y ACTIVIDADES PENDIENTES -->
          <div class="form-group span-2" style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; margin-top: 10px; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--color-primary-400); display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              4. Estado Final del Caso y Seguimiento SST
            </h4>
          </div>

          <div class="form-group">
            <label class="form-label">Estado Final del Caso *</label>
            <select id="sst-estado-caso" class="filter-select">
              ${cats.estadosCaso.map(e => `<option ${r.estadoFinalCaso === e ? 'selected' : ''}>${escHtml(e)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group span-2">
            <label class="form-label">Actividades Pendientes SST</label>
            <input id="sst-pendientes" list="sst-pendientes-list" class="form-input" placeholder="Haga clic para actividades frecuentes o escriba pendientes..." value="${escHtml(r.actividadesPendientes || '')}" />
            <datalist id="sst-pendientes-list">
              ${(cats.actividadesPendientesFrecuentes || []).map(ap => `<option value="${escHtml(ap)}"></option>`).join('')}
            </datalist>
          </div>
        </div>`;
    }

    if (state.tab === 'epp') {
      return `
        <div class="form-grid">
          <div class="form-group span-2 autocomplete-wrapper">
            <label class="form-label">Servidor Público * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe para autocompletar desde planta)</span></label>
            <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" required />
            <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Documento de Identidad (C.C.) *</label>
            <input id="sst-doc" class="form-input" placeholder="Número de documento" value="${escHtml(r.documento || '')}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input id="sst-tel" class="form-input" placeholder="Celular de contacto" value="${escHtml(r.telefono || '')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Dependencia / Subdirección *</label>
            <input id="sst-dep" list="sst-deps-list" class="form-input" value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" />
            <datalist id="sst-deps-list">
              ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Cargo</label>
            <input id="sst-cargo" class="form-input" value="${escHtml(r.cargo || 'PROFESIONAL UNIVERSITARIO')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Vinculación</label>
            <select id="sst-vinculacion" class="filter-select">
              ${cats.tiposVinculacion.map(v => `<option ${(r.tipoVinculacion || '').toUpperCase() === v.toUpperCase() ? 'selected' : ''}>${escHtml(v)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Elemento de Protección Personal *</label>
            <select id="sst-elemento-epp" class="filter-select">
              ${cats.eppCatalogo.map(e => `<option value="${escHtml(e.nombre)}" ${(r.elementoEpp === e.nombre || r.codigoElemento === e.codigo) ? 'selected' : ''}>${escHtml(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Talla</label>
            <input id="sst-talla" class="form-input" placeholder="N/A, S, M, L, XL, 38, 40..." value="${escHtml(r.talla || 'N/A')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Cantidad Entregada *</label>
            <input id="sst-cantidad" class="form-input" placeholder="1 UNIDAD, 1 PAR, 1 CAJA..." value="${escHtml(r.cantidad || '1 UNIDAD')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha de Entrega *</label>
            <input id="sst-fecha-entrega" type="date" class="form-input" value="${escHtml(r.fechaEntrega || new Date().toISOString().split('T')[0])}" />
          </div>
          <div class="form-group">
            <label class="form-label">Estado de Entrega</label>
            <select id="sst-estado-entrega" class="filter-select">
              ${['Entregado', 'Reposición Programada', 'Pendiente Firma', 'Devuelto'].map(s => `<option ${r.estadoEntrega === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Restricciones y/o Recomendaciones Asociadas</label>
            <input id="sst-restricciones" class="form-input" value="${escHtml(r.restriccionesRecomendaciones || 'NINGUNA')}" />
          </div>
          <div class="form-group span-2">
            <label class="form-label">Observaciones de Dotación</label>
            <input id="sst-obs" class="form-input" placeholder="Observaciones adicionales..." value="${escHtml(r.observaciones || '')}" />
          </div>

          <!-- Apartado de Firma Digital (Tablet / Pantalla Táctil) -->
          <div class="form-group span-2 sst-signature-box" style="margin-top:6px;background:var(--bg-subtle, #f8fafc);border:1px solid var(--border-color, #e2e8f0);border-radius:10px;padding:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--color-primary-400, #16a34a);"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                <label class="form-label" style="margin:0;font-weight:600;font-size:13px;color:var(--text-primary);">Firma Digital de Recepción y Verificación</label>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span id="sst-firma-status" class="badge ${r.firmaDigital ? 'badge--aprobada' : 'badge--pendiente'}" style="font-size:11px;">
                  ${r.firmaDigital ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Firmado' : 'Pendiente de Firma'}
                </span>
                <button type="button" class="btn btn-secondary" onclick="SstModule.clearSignature()" style="padding:4px 10px;font-size:12px;height:28px;" title="Borrar y volver a firmar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Limpiar
                </button>
              </div>
            </div>
            <div style="position:relative;background:#ffffff;border:2px dashed var(--border-color, #cbd5e1);border-radius:8px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">
              <canvas id="sst-signature-canvas" style="width:100%;height:150px;display:block;cursor:crosshair;touch-action:none;"></canvas>
              <div id="sst-signature-line" style="position:absolute;bottom:20px;left:24px;right:24px;border-bottom:1px solid #94a3b8;pointer-events:none;display:flex;justify-content:space-between;padding-bottom:2px;${r.firmaDigital ? 'opacity:0.2;' : ''}">
                <span style="font-size:11px;color:#64748b;font-weight:500;">Firma del Funcionario / Receptor</span>
                <span style="font-size:11px;color:#94a3b8;font-style:italic;">Firme con su dedo, lápiz o puntero táctil</span>
              </div>
            </div>
            <input type="hidden" id="sst-firma-digital" value="${escHtml(r.firmaDigital || '')}" />
            <small style="color:var(--text-muted);font-size:11px;display:block;margin-top:6px;">
              El personal certifica mediante esta firma digital la recepción conforme del Elemento de Protección Personal (EPP) y la verificación del estado de entrega.
            </small>
          </div>
        </div>`;
    }

    // Sociodemográfico
    return `
      <div class="form-grid">
        <div class="form-group span-2 autocomplete-wrapper">
          <label class="form-label">Servidor Público * <span style="font-size:11px;color:var(--color-primary-400);font-weight:400;">(Escribe para autocompletar desde planta)</span></label>
          <input id="sst-nombre" class="form-input" placeholder="Buscar funcionario..." value="${escHtml(r.nombreCompleto || '')}" oninput="SstModule.onEmployeeInput(this.value)" autocomplete="off" required />
          <div id="sst-autocomplete-list" class="autocomplete-dropdown" style="display:none;"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Documento</label>
          <select id="sst-tipo-id" class="filter-select">
            ${cats.tiposIdentificacion.map(t => `<option ${r.tipoIdentificacion === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Número de Identificación *</label>
          <input id="sst-doc" class="form-input" value="${escHtml(r.documento || '')}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Sexo</label>
          <select id="sst-sexo" class="filter-select">
            <option ${r.sexo === 'Masculino' ? 'selected' : ''}>Masculino</option>
            <option ${r.sexo === 'Femenino' ? 'selected' : ''}>Femenino</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Año Nacimiento / Edad</label>
          <div style="display:flex;gap:8px;">
            <input id="sst-anio-nac" type="number" class="form-input" placeholder="Año (Ej: 1990)" value="${escHtml(r.anioNacimiento || '')}" />
            <input id="sst-edad" type="number" class="form-input" placeholder="Edad" value="${escHtml(r.edad || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Raza / Etnia</label>
          <select id="sst-raza" class="filter-select">
            ${cats.razas.map(rz => `<option ${r.razaEtnia === rz ? 'selected' : ''}>${escHtml(rz)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado Civil</label>
          <select id="sst-estado-civil" class="filter-select">
            ${cats.estadosCiviles.map(ec => `<option ${r.estadoCivil === ec ? 'selected' : ''}>${escHtml(ec)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Composición Familiar (Personas con las que comparte vivienda)</label>
          <select id="sst-familia" class="filter-select">
            ${cats.composicionesFamiliares.map(cf => `<option ${r.composicionFamiliar === cf ? 'selected' : ''}>${escHtml(cf)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Vivienda</label>
          <select id="sst-vivienda" class="filter-select">
            ${cats.tiposVivienda.map(tv => `<option ${r.tipoVivienda === tv ? 'selected' : ''}>${escHtml(tv)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estrato Servicios Públicos</label>
          <select id="sst-estrato" class="filter-select">
            ${cats.estratos.map(es => `<option ${String(r.estrato || '3') === es ? 'selected' : ''}>${es}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Municipio de Residencia</label>
          <input id="sst-mpio-res" class="form-input" value="${escHtml(r.municipioResidencia || 'Tunja')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Municipio donde Trabaja</label>
          <input id="sst-mpio-trab" class="form-input" value="${escHtml(r.municipioTrabajo || 'Tunja')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Escolaridad (Último nivel)</label>
          <select id="sst-escolaridad" class="filter-select">
            ${cats.escolaridades.map(sc => `<option ${r.escolaridad === sc ? 'selected' : ''}>${escHtml(sc)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ocupación o Profesión</label>
          <input id="sst-profesion" class="form-input" placeholder="Ej: Ingeniero Industrial, Abogado..." value="${escHtml(r.ocupacionProfesion || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Rango de Ingresos</label>
          <select id="sst-ingresos" class="filter-select">
            ${cats.rangosIngresos.map(ri => `<option ${r.rangoIngresos === ri ? 'selected' : ''}>${escHtml(ri)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Denominación del Cargo</label>
          <input id="sst-cargo" class="form-input" value="${escHtml(r.denominacionCargo || 'Profesional Universitario')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Cargo</label>
          <select id="sst-tipo-cargo" class="filter-select">
            ${cats.tiposCargo.map(tc => `<option ${r.tipoCargo === tc ? 'selected' : ''}>${escHtml(tc)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Vinculación</label>
          <select id="sst-vinculacion" class="filter-select">
            ${cats.tiposVinculacion.map(tv => `<option ${r.tipoVinculacion === tv ? 'selected' : ''}>${escHtml(tv)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Antigüedad en el Cargo Actual</label>
          <select id="sst-ant-cargo" class="filter-select">
            ${cats.rangosAntiguedad.map(ra => `<option ${r.antiguedadCargo === ra ? 'selected' : ''}>${escHtml(ra)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Antigüedad en la Entidad</label>
          <select id="sst-ant-entidad" class="filter-select">
            ${cats.rangosAntiguedad.map(ra => `<option ${r.antiguedadEntidad === ra ? 'selected' : ''}>${escHtml(ra)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Dependencia donde Trabaja *</label>
          <input id="sst-dep" list="sst-deps-list" class="form-input" value="${escHtml(r.dependencia || 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo')}" />
          <datalist id="sst-deps-list">
            ${cats.dependencias.map(d => `<option value="${escHtml(d)}"></option>`).join('')}
          </datalist>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Sede de Trabajo</label>
          <select id="sst-sede" class="filter-select">
            ${cats.sedes.map(s => `<option ${r.sedeTrabajo === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
        </div>
      </div>`;
  }

  function readForm() {
    const nombreCompleto = document.getElementById('sst-nombre')?.value.trim();
    const documento = document.getElementById('sst-doc')?.value.trim();
    if (!nombreCompleto || !documento) {
      App.showToast('El nombre del servidor y su documento son requeridos.', 'warning');
      return null;
    }

    if (state.tab === 'epidemiologico') {
      const apellidos = document.getElementById('sst-apellidos')?.value.trim() || '';
      const nombres = document.getElementById('sst-nombres')?.value.trim() || '';
      let nomComp = nombreCompleto;
      if (!nomComp && (apellidos || nombres)) {
        nomComp = `${apellidos} ${nombres}`.trim();
      }

      return {
        nombreCompleto: nomComp,
        apellidos: apellidos || (nomComp ? nomComp.split(' ').slice(0, 2).join(' ') : ''),
        nombres: nombres || (nomComp ? nomComp.split(' ').slice(2).join(' ') : ''),
        documento,
        tipoIdentificacion: document.getElementById('sst-tipo-id')?.value || 'Cédula de Ciudadanía',
        telefono: document.getElementById('sst-tel')?.value.trim() || '',
        edad: document.getElementById('sst-edad')?.value || null,
        fechaIngreso: document.getElementById('sst-ingreso')?.value || '',
        dependencia: document.getElementById('sst-dep')?.value.trim() || 'SGEN - SECRETARIA GENERAL (Despacho)',
        sedeTrabajo: document.getElementById('sst-sede')?.value || 'CASA DE LA TORRE',
        cargo: document.getElementById('sst-cargo')?.value.trim() || 'PROFESIONAL UNIVERSITARIO',
        tipoEmo: document.getElementById('sst-tipo-emo')?.value || 'Periódico',
        fechaEmo: document.getElementById('sst-fecha-emo')?.value || new Date().toISOString().split('T')[0],
        fechaProximoEmo: document.getElementById('sst-prox-emo')?.value || '',
        estadoFinalCaso: document.getElementById('sst-estado-caso')?.value || 'Vigente',
        direccionadoPve: document.getElementById('sst-pve')?.value || 'No aplica',
        direccionadoEps: document.getElementById('sst-eps')?.value.trim() || 'No aplica',
        restricciones: document.getElementById('sst-restricciones')?.value.trim() || 'NINGUNA',
        recomendaciones: document.getElementById('sst-recomendaciones')?.value.trim() || 'Pausas activas e higiene postural',
        accidenteTrabajo: document.getElementById('sst-at')?.value || 'NO',
        fechaAccidente: document.getElementById('sst-fecha-at')?.value || '',
        estadoActualAccidente: document.getElementById('sst-estado-at')?.value.trim() || 'No aplica',
        enfermedadLaboral: document.getElementById('sst-el')?.value || 'NO',
        fechaEnfermedad: document.getElementById('sst-fecha-el')?.value || '',
        estadoActualEnfermedad: document.getElementById('sst-estado-el')?.value.trim() || 'No aplica',
        cumplioRehabilitacion: document.getElementById('sst-rehab')?.value || 'N/A',
        actividadesPendientes: document.getElementById('sst-pendientes')?.value.trim() || ''
      };
    }

    if (state.tab === 'epp') {
      return {
        nombreCompleto,
        documento,
        telefono: document.getElementById('sst-tel')?.value.trim(),
        dependencia: document.getElementById('sst-dep')?.value.trim(),
        cargo: document.getElementById('sst-cargo')?.value.trim(),
        tipoVinculacion: document.getElementById('sst-vinculacion')?.value,
        elementoEpp: document.getElementById('sst-elemento-epp')?.value,
        talla: document.getElementById('sst-talla')?.value.trim(),
        cantidad: document.getElementById('sst-cantidad')?.value.trim(),
        fechaEntrega: document.getElementById('sst-fecha-entrega')?.value,
        estadoEntrega: document.getElementById('sst-estado-entrega')?.value,
        restriccionesRecomendaciones: document.getElementById('sst-restricciones')?.value.trim(),
        observaciones: document.getElementById('sst-obs')?.value.trim(),
        firmaDigital: document.getElementById('sst-firma-digital')?.value || null
      };
    }

    return {
      nombreCompleto,
      documento,
      tipoIdentificacion: document.getElementById('sst-tipo-id')?.value,
      sexo: document.getElementById('sst-sexo')?.value,
      anioNacimiento: document.getElementById('sst-anio-nac')?.value,
      edad: document.getElementById('sst-edad')?.value,
      razaEtnia: document.getElementById('sst-raza')?.value,
      estadoCivil: document.getElementById('sst-estado-civil')?.value,
      composicionFamiliar: document.getElementById('sst-familia')?.value,
      tipoVivienda: document.getElementById('sst-vivienda')?.value,
      estrato: document.getElementById('sst-estrato')?.value,
      municipioResidencia: document.getElementById('sst-mpio-res')?.value.trim(),
      municipioTrabajo: document.getElementById('sst-mpio-trab')?.value.trim(),
      escolaridad: document.getElementById('sst-escolaridad')?.value,
      ocupacionProfesion: document.getElementById('sst-profesion')?.value.trim(),
      rangoIngresos: document.getElementById('sst-ingresos')?.value,
      denominacionCargo: document.getElementById('sst-cargo')?.value.trim(),
      tipoCargo: document.getElementById('sst-tipo-cargo')?.value,
      tipoVinculacion: document.getElementById('sst-vinculacion')?.value,
      antiguedadCargo: document.getElementById('sst-ant-cargo')?.value,
      antiguedadEntidad: document.getElementById('sst-ant-entidad')?.value,
      dependencia: document.getElementById('sst-dep')?.value.trim(),
      sedeTrabajo: document.getElementById('sst-sede')?.value
    };
  }

  function openCreate() {
    try {
      const tabCfg = TABS[state.tab];
      App.openModal(tabCfg.btnCreate, buildForm(), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Guardar Registro', cls: 'btn-primary', id: 'sst-save-btn', action: saveCreate }
      ], 'modal-box--wide');
      if (state.tab === 'epp') {
        setTimeout(() => initSignaturePad(), 60);
      }
    } catch (err) {
      console.error('[SstModule.openCreate error]', err);
      App.showToast('Error al abrir formulario: ' + err.message, 'error');
    }
  }

  function openEdit(id) {
    try {
      const r = state.data.find(x => x.id === id);
      if (!r) return;
      const tabCfg = TABS[state.tab];
      App.openModal(`Editar — ${tabCfg.title} (${r.radicado})`, buildForm(r), [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        { text: 'Actualizar Cambios', cls: 'btn-gold', id: 'sst-save-btn', action: () => saveEdit(id) }
      ], 'modal-box--wide');
      if (state.tab === 'epp') {
        setTimeout(() => initSignaturePad(r), 60);
      }
    } catch (err) {
      console.error('[SstModule.openEdit error]', err);
      App.showToast('Error al abrir edición: ' + err.message, 'error');
    }
  }

  async function saveCreate() {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('sst-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      let res;
      if (state.tab === 'epidemiologico') res = await API.createSstEpidemiologico(body);
      else if (state.tab === 'epp') res = await API.createSstEpp(body);
      else res = await API.createSstSociodemografico(body);

      App.closeModal();
      App.showToast(`${res.message || 'Registro creado.'} (${res.radicado || ''})`, 'success');
      loadStats();
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar Registro'; }
    }
  }

  async function saveEdit(id) {
    const body = readForm();
    if (!body) return;
    const btn = document.getElementById('sst-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
    try {
      if (state.tab === 'epidemiologico') await API.updateSstEpidemiologico(id, body);
      else if (state.tab === 'epp') await API.updateSstEpp(id, body);
      else await API.updateSstSociodemografico(id, body);

      App.closeModal();
      App.showToast('Registro actualizado exitosamente.', 'success');
      loadStats();
      await load();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Cambios'; }
    }
  }


  // ─── Pad de Firma Digital (Tablet / Pantalla Táctil EPP) ───────────────────
  function initSignaturePad(existingRecord = null) {
    const canvas = document.getElementById('sst-signature-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = rect.width || 560;
    const cssHeight = 150;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const hiddenInput = document.getElementById('sst-firma-digital');
    const existingSig = (existingRecord && existingRecord.firmaDigital) || (hiddenInput && hiddenInput.value);

    if (existingSig && existingSig.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
        updateFirmaStatus(true);
      };
      img.src = existingSig;
    }

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function getCoords(e) {
      const b = canvas.getBoundingClientRect();
      return {
        x: e.clientX - b.left,
        y: e.clientY - b.top
      };
    }

    function onPointerDown(e) {
      isDrawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const coords = getCoords(e);
      lastX = coords.x;
      lastY = coords.y;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!isDrawing) return;
      const coords = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      lastX = coords.x;
      lastY = coords.y;
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (!isDrawing) return;
      isDrawing = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      const dataUrl = canvas.toDataURL('image/png');
      if (hiddenInput) hiddenInput.value = dataUrl;
      updateFirmaStatus(true);
      e.preventDefault();
    }

    canvas.onpointerdown = onPointerDown;
    canvas.onpointermove = onPointerMove;
    canvas.onpointerup = onPointerUp;
    canvas.onpointercancel = onPointerUp;
  }

  function clearSignature() {
    const canvas = document.getElementById('sst-signature-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const hidden = document.getElementById('sst-firma-digital');
    if (hidden) hidden.value = '';
    updateFirmaStatus(false);
  }

  function updateFirmaStatus(isSigned) {
    const badge = document.getElementById('sst-firma-status');
    const line = document.getElementById('sst-signature-line');
    if (badge) {
      if (isSigned) {
        badge.className = 'badge badge--aprobada';
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Firmado';
      } else {
        badge.className = 'badge badge--pendiente';
        badge.textContent = 'Pendiente de Firma';
      }
    }
    if (line) {
      line.style.opacity = isSigned ? '0.2' : '1';
    }
  }

  function openView(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) return;

    let html = '';
    if (state.tab === 'epidemiologico') {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Radicado / Folio EMO</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Estado del Caso</span><div class="detail-badge-wrap"><span class="badge ${badgeClass(r.estadoFinalCaso)}">${escHtml(r.estadoFinalCaso)}</span></div></div>
            
            <div class="detail-item detail-grid--full" style="border-top:1px solid var(--border-color);padding-top:8px;margin-top:4px;">
              <strong style="color:var(--color-primary-400);font-size:12px;">INFORMACIÓN DEL SERVIDOR PÚBLICO</strong>
            </div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (${escHtml(r.tipoIdentificacion)}: ${escHtml(r.documento)})</span></div>
            <div class="detail-item"><span class="detail-label">Apellidos & Nombres</span><span class="detail-value">${escHtml(r.apellidos || '—')}, ${escHtml(r.nombres || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Teléfono & Edad</span><span class="detail-value">${escHtml(r.telefono || '—')} · ${r.edad ? `${r.edad} años` : '—'}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha Ingreso Entidad</span><span class="detail-value">${formatDate(r.fechaIngreso)}</span></div>
            <div class="detail-item"><span class="detail-label">Cargo</span><span class="detail-value">${escHtml(r.cargo || 'PROFESIONAL UNIVERSITARIO')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Sede</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.sedeTrabajo || 'CASA DE LA TORRE')}</span></div>

            <div class="detail-item detail-grid--full" style="border-top:1px solid var(--border-color);padding-top:8px;margin-top:4px;">
              <strong style="color:var(--color-primary-400);font-size:12px;">VALORACIÓN MÉDICA OCUPACIONAL (EMO)</strong>
            </div>
            <div class="detail-item"><span class="detail-label">Tipo de EMO</span><span class="detail-value">${escHtml(r.tipoEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha Realización EMO</span><span class="detail-value">${formatDate(r.fechaEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Próximo EMO Programado</span><span class="detail-value">${formatDate(r.fechaProximoEmo)}</span></div>
            <div class="detail-item"><span class="detail-label">Direccionado a PVE</span><span class="detail-value">${escHtml(r.direccionadoPve || 'No aplica')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Direccionado a EPS / IPS</span><span class="detail-value">${escHtml(r.direccionadoEps || 'No aplica')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Restricciones Médicas Laborales</span><span class="detail-value">${escHtml(r.restricciones || 'NINGUNA')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Recomendaciones Médicas Ocupacionales</span><span class="detail-value">${escHtml(r.recomendaciones || '—')}</span></div>

            <div class="detail-item detail-grid--full" style="border-top:1px solid var(--border-color);padding-top:8px;margin-top:4px;">
              <strong style="color:var(--color-primary-400);font-size:12px;">ACCIDENTES DE TRABAJO (AT) & ENFERMEDAD LABORAL (EL)</strong>
            </div>
            <div class="detail-item"><span class="detail-label">Accidente de Trabajo (AT)</span><span class="detail-value">${escHtml(r.accidenteTrabajo)} ${r.fechaAccidente ? `(${formatDate(r.fechaAccidente)})` : ''}</span></div>
            <div class="detail-item"><span class="detail-label">Estado Actual AT</span><span class="detail-value">${escHtml(r.estadoActualAccidente || 'No aplica')}</span></div>
            <div class="detail-item"><span class="detail-label">Enfermedad Laboral (EL)</span><span class="detail-value">${escHtml(r.enfermedadLaboral)} ${r.fechaEnfermedad ? `(${formatDate(r.fechaEnfermedad)})` : ''}</span></div>
            <div class="detail-item"><span class="detail-label">Estado Actual EL</span><span class="detail-value">${escHtml(r.estadoActualEnfermedad || 'No aplica')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Cumplió Proceso de Rehabilitación</span><span class="detail-value">${escHtml(r.cumplioRehabilitacion || 'N/A')}</span></div>

            ${r.actividadesPendientes ? `
            <div class="detail-item detail-grid--full" style="border-top:1px solid var(--border-color);padding-top:8px;margin-top:4px;">
              <span class="detail-label">Actividades Pendientes SST</span>
              <span class="detail-value">${escHtml(r.actividadesPendientes)}</span>
            </div>` : ''}
          </div>
        </div>`;
    } else if (state.tab === 'epp') {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Radicado / Folio EPP</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Estado Entrega</span><div class="detail-badge-wrap"><span class="badge ${badgeClass(r.estadoEntrega)}">${escHtml(r.estadoEntrega)}</span></div></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (C.C. ${escHtml(r.documento)})</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Cargo</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.cargo || '')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Elemento de Protección Personal Entregado</span><span class="detail-value">${escHtml(r.elementoEpp)}</span></div>
            <div class="detail-item"><span class="detail-label">Talla</span><span class="detail-value">${escHtml(r.talla || 'N/A')}</span></div>
            <div class="detail-item"><span class="detail-label">Cantidad</span><span class="detail-value">${escHtml(r.cantidad)}</span></div>
            <div class="detail-item"><span class="detail-label">Fecha de Entrega</span><span class="detail-value">${formatDate(r.fechaEntrega)}</span></div>
            <div class="detail-item"><span class="detail-label">Tipo de Vinculación</span><span class="detail-value">${escHtml(r.tipoVinculacion || '—')}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Restricciones y/o Recomendaciones</span><span class="detail-value">${escHtml(r.restriccionesRecomendaciones || 'NINGUNA')}</span></div>
            ${r.observaciones ? `<div class="detail-item detail-grid--full"><span class="detail-label">Observaciones</span><span class="detail-value">${escHtml(r.observaciones)}</span></div>` : ''}
            <div class="detail-item detail-grid--full" style="background:var(--bg-subtle, rgba(255,255,255,0.03));border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-top:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span class="detail-label" style="font-weight:600;display:flex;align-items:center;gap:6px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--color-primary-400, #16a34a);"><polyline points="20 6 9 17 4 12"/></svg>
                  Firma Digital de Recepción y Verificación
                </span>
                ${r.firmaDigital ? '<span class="badge badge--aprobada">Verificado y Firmado</span>' : '<span class="badge badge--pendiente">Sin Firma Digital</span>'}
              </div>
              ${r.firmaDigital ? `
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center;">
                  <img src="${escHtml(r.firmaDigital)}" alt="Firma de entrega" style="max-height:120px;max-width:100%;object-fit:contain;display:inline-block;" />
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;">
                  <span>Receptor: ${escHtml(r.nombreCompleto)}</span>
                  <span>C.C. ${escHtml(r.documento)}</span>
                </div>
              ` : `
                <div style="color:var(--text-muted);font-size:12px;font-style:italic;">No se registró firma digital en el momento de la entrega.</div>
              `}
            </div>
          </div>
        </div>`;
    } else {
      html = `
        <div class="detail-modal-card">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Radicado / Folio</span><span class="detail-value">${escHtml(r.radicado)}</span></div>
            <div class="detail-item"><span class="detail-label">Sexo & Edad</span><span class="detail-value">${escHtml(r.sexo)} · ${r.edad ? `${r.edad} años` : '—'}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Servidor Público</span><span class="detail-value">${escHtml(r.nombreCompleto)} (C.C. ${escHtml(r.documento)})</span></div>
            <div class="detail-item"><span class="detail-label">Estado Civil & Etnia</span><span class="detail-value">${escHtml(r.estadoCivil)} · ${escHtml(r.razaEtnia)}</span></div>
            <div class="detail-item"><span class="detail-label">Vivienda & Estrato</span><span class="detail-value">${escHtml(r.tipoVivienda)} (Estrato ${escHtml(r.estrato)})</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Composición Familiar</span><span class="detail-value">${escHtml(r.composicionFamiliar || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Escolaridad</span><span class="detail-value">${escHtml(r.escolaridad)}</span></div>
            <div class="detail-item"><span class="detail-label">Profesión / Ocupación</span><span class="detail-value">${escHtml(r.ocupacionProfesion || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Vinculación & Cargo</span><span class="detail-value">${escHtml(r.tipoVinculacion)} (${escHtml(r.tipoCargo)})</span></div>
            <div class="detail-item"><span class="detail-label">Rango Salarial</span><span class="detail-value">${escHtml(r.rangoIngresos)}</span></div>
            <div class="detail-item detail-grid--full"><span class="detail-label">Dependencia & Sede</span><span class="detail-value">${escHtml(r.dependencia)} · ${escHtml(r.sedeTrabajo)}</span></div>
          </div>
        </div>`;
    }

    const actions = [
      { text: 'Cerrar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Exportar Ficha Excel',
        cls: 'btn-secondary',
        action: () => {
          if (state.tab === 'epidemiologico') exportSingleProfileExcel(id);
          else exportExcel();
        }
      }
    ];
    if (Auth.canEdit()) {
      actions.push({
        text: 'Editar Registro',
        cls: 'btn-gold',
        action: () => { App.closeModal(); openEdit(id); }
      });
    }
    App.openModal(`Detalle SST · ${r.radicado}`, html, actions);
  }

  function confirmDelete(id, nombre) {
    App.openModal('Confirmar Eliminación SST', `<p style="color:var(--text-secondary)">¿Deseas eliminar el registro de <strong style="color:var(--text-primary)">${escHtml(nombre)}</strong>?</p>`, [
      { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
      {
        text: 'Eliminar',
        cls: 'btn-danger',
        action: async () => {
          try {
            if (state.tab === 'epidemiologico') await API.deleteSstEpidemiologico(id);
            else if (state.tab === 'epp') await API.deleteSstEpp(id);
            else await API.deleteSstSociodemografico(id);
            App.closeModal();
            App.showToast('Registro SST eliminado.', 'success');
            loadStats();
            await load();
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        }
      }
    ]);
  }

  async function checkEmoVencimientos() {
    try {
      const res = await API.checkSstEmoVencimientos();
      App.showToast(res.message || 'Vencimientos de EMO verificados.', 'info');
      loadStats();
      await load();
    } catch (err) {
      App.showToast('Error al verificar vencimientos: ' + err.message, 'error');
    }
  }

  function applyFilters() {
    state.page = 1;
    state.filters = {
      q: document.getElementById('sst-q')?.value.trim() || '',
      subFilter1: document.getElementById('sst-filter-1')?.value || 'Todos',
      subFilter2: document.getElementById('sst-filter-2')?.value || 'Todos'
    };
    load();
  }

  function clearFilters() {
    const qEl = document.getElementById('sst-q');
    if (qEl) qEl.value = '';
    state.filters = { q: '', subFilter1: state.tab === 'sociodemografico' ? 'Todas' : 'Todos', subFilter2: 'Todos' };
    const f1 = document.getElementById('sst-filter-1');
    const f2 = document.getElementById('sst-filter-2');
    if (f1) f1.selectedIndex = 0;
    if (f2) f2.selectedIndex = 0;
    state.page = 1;
    load();
  }

  function goPage(p) {
    if (p < 1 || p > state.totalPages) return;
    state.page = p;
    load();
  }

  // ─── Generación de Formato Oficial PDF (jsPDF) ──────────────────────────────
  function exportSinglePdf(id) {
    const r = state.data.find(x => x.id === id);
    if (!r || !window.jspdf) {
      App.showToast('Motor PDF no disponible.', 'warning');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const tabCfg = TABS[state.tab];

    doc.setFillColor(40, 117, 34);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text('GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL', 14, 11);
    doc.setFontSize(10);
    doc.text(`SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO · ${tabCfg.title.toUpperCase()}`, 14, 19);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.text(`${tabCfg.title.toUpperCase()} (${r.radicado})`, 14, 36);

    const rows = state.tab === 'epp'
      ? [
          ['Servidor Público', r.nombreCompleto],
          ['Documento de Identidad', r.documento],
          ['Dependencia', r.dependencia],
          ['Cargo / Vinculación', `${r.cargo || ''} — ${r.tipoVinculacion || ''}`],
          ['Elemento EPP Entregado', r.elementoEpp],
          ['Talla y Cantidad', `Talla: ${r.talla || 'N/A'} | Cantidad: ${r.cantidad}`],
          ['Fecha de Entrega', formatDate(r.fechaEntrega)],
          ['Restricciones / Recomendaciones', r.restriccionesRecomendaciones || 'NINGUNA'],
          ['Estado / Verificación', `${r.estadoEntrega}${r.firmaDigital ? ' (Con Firma Digital Verificada)' : ''}`],
          ['Observaciones', r.observaciones || 'Entrega y verificación de EPP']
        ]
      : [
          ['Servidor Público', r.nombreCompleto],
          ['Identificación', `${r.tipoIdentificacion}: ${r.documento}`],
          ['Dependencia y Sede', `${r.dependencia} (${r.sedeTrabajo || ''})`],
          ['Tipo y Fecha de EMO', `${r.tipoEmo} — ${formatDate(r.fechaEmo)}`],
          ['Próximo EMO Programado', formatDate(r.fechaProximoEmo)],
          ['Restricciones Médicas', r.restricciones || 'NINGUNA'],
          ['Recomendaciones Ocupacionales', r.recomendaciones || '—'],
          ['Programa de Vigilancia (PVE)', r.direccionadoPve || 'No aplica'],
          ['Accidente / Enfermedad Laboral', `AT: ${r.accidenteTrabajo} | EL: ${r.enfermedadLaboral}`],
          ['Estado Final del Caso', r.estadoFinalCaso]
        ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 42,
        head: [['Campo Oficial SST', 'Información Registrada']],
        body: rows,
        headStyles: { fillColor: [40, 117, 34] },
        styles: { fontSize: 9.5, cellPadding: 3.5 }
      });
    }

    doc.save(`${r.radicado}_${r.documento}.pdf`);
    App.showToast('Documento oficial SST descargado en PDF.', 'success');
  }

  // ─── Exportación e Importación Masiva Excel por Submódulo ───────────────────
  function getExcelColumns() {
    if (state.tab === 'epidemiologico') {
      return [
        { header: 'Código', key: 'radicado', width: 16 },
        { header: 'Tipo Identificación', key: 'tipoIdentificacion', width: 22 },
        { header: 'Documento', key: 'documento', width: 16 },
        { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Edad', key: 'edad', width: 10 },
        { header: 'Dependencia', key: 'dependencia', width: 36 },
        { header: 'Sede de Trabajo', key: 'sedeTrabajo', width: 28 },
        { header: 'Fecha EMO', key: 'fechaEmo', width: 15 },
        { header: 'Tipo de EMO', key: 'tipoEmo', width: 18 },
        { header: 'Restricciones', key: 'restricciones', width: 30 },
        { header: 'Recomendaciones', key: 'recomendaciones', width: 30 },
        { header: 'Direccionado PVE', key: 'direccionadoPve', width: 26 },
        { header: 'Próximo EMO', key: 'fechaProximoEmo', width: 15 },
        { header: 'Accidente Trabajo', key: 'accidenteTrabajo', width: 16 },
        { header: 'Enfermedad Laboral', key: 'enfermedadLaboral', width: 16 },
        { header: 'Estado Final Caso', key: 'estadoFinalCaso', width: 18 }
      ];
    }
    if (state.tab === 'epp') {
      return [
        { header: 'Radicado', key: 'radicado', width: 16 },
        { header: 'Documento', key: 'documento', width: 16 },
        { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Dependencia', key: 'dependencia', width: 35 },
        { header: 'Cargo', key: 'cargo', width: 25 },
        { header: 'Tipo Vinculación', key: 'tipoVinculacion', width: 22 },
        { header: 'Elemento EPP', key: 'elementoEpp', width: 30 },
        { header: 'Talla', key: 'talla', width: 10 },
        { header: 'Cantidad', key: 'cantidad', width: 14 },
        { header: 'Fecha Entrega', key: 'fechaEntrega', width: 16 },
        { header: 'Estado Entrega', key: 'estadoEntrega', width: 18 },
        { header: 'Observaciones', key: 'observaciones', width: 30 }
      ];
    }
    return [
      { header: 'Código', key: 'radicado', width: 16 },
      { header: 'Tipo Identificación', key: 'tipoIdentificacion', width: 20 },
      { header: 'Documento', key: 'documento', width: 16 },
      { header: 'Servidor Público', key: 'nombreCompleto', width: 32 },
      { header: 'Sexo', key: 'sexo', width: 12 },
      { header: 'Año Nacimiento', key: 'anioNacimiento', width: 15 },
      { header: 'Edad', key: 'edad', width: 10 },
      { header: 'Raza / Etnia', key: 'razaEtnia', width: 18 },
      { header: 'Estado Civil', key: 'estadoCivil', width: 16 },
      { header: 'Tipo Vivienda', key: 'tipoVivienda', width: 15 },
      { header: 'Estrato', key: 'estrato', width: 10 },
      { header: 'Escolaridad', key: 'escolaridad', width: 18 },
      { header: 'Ocupación / Profesión', key: 'ocupacionProfesion', width: 25 },
      { header: 'Rango Ingresos', key: 'rangoIngresos', width: 20 },
      { header: 'Tipo Vinculación', key: 'tipoVinculacion', width: 22 },
      { header: 'Dependencia', key: 'dependencia', width: 35 },
      { header: 'Sede de Trabajo', key: 'sedeTrabajo', width: 28 }
    ];
  }

  async function exportExcel() {
    try {
      const tabCfg = TABS[state.tab];
      ExcelService.exportToExcel({
        filename: `Talento360_SST_${state.tab}_${tabCfg.code.replace(/\s+/g, '_')}`,
        sheetName: tabCfg.title.substring(0, 30),
        columns: getExcelColumns(),
        data: state.data
      });
      App.showToast(`Exportados ${state.data.length} registros de ${tabCfg.title}.`, 'success');
    } catch (err) {
      App.showToast('Error al exportar Excel: ' + err.message, 'error');
    }
  }


  // ─── 1. Exportar Perfil Individual a la Plantilla Oficial Excel ──────────────
  async function exportSingleProfileExcel(id) {
    const r = state.data.find(x => x.id === id);
    if (!r) {
      App.showToast('No se encontró el registro a exportar.', 'warning');
      return;
    }
    if (typeof XLSX === 'undefined') {
      App.showToast('La biblioteca de Excel (SheetJS) no está disponible.', 'error');
      return;
    }

    try {
      App.showToast('Generando plantilla oficial de Excel...', 'info');

      // Intentar cargar la plantilla oficial pre-almacenada para máxima fidelidad
      let wb = null;
      try {
        const resp = await fetch('plantillas/PERFILEPIDEMIOLOGICO_Plantilla_Oficial.xlsx');
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellStyles: true });
        }
      } catch (_) {}

      // Si no se pudo obtener el archivo estático, generarlo programáticamente con la estructura exacta
      if (!wb) {
        wb = buildOfficialTemplateWorkbook();
      }

      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];

      const apellidos = r.apellidos || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(0, 2).join(' ') : '');
      const nombres = r.nombres || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(2).join(' ') : '');

      // Escribir fila 7 (fila de datos oficiales A7:X7)
      const dataRow = [
        1,
        r.tipoIdentificacion || 'Cédula de Ciudadanía',
        r.documento || '',
        apellidos,
        nombres,
        r.telefono || '',
        r.edad ? parseInt(r.edad) : '',
        formatDate(r.fechaIngreso) || '',
        r.dependencia || '',
        formatDate(r.fechaEmo) || '',
        r.tipoEmo || 'Periódico',
        r.restricciones || 'NINGUNA',
        r.recomendaciones || 'Pausas activas e higiene postural',
        r.direccionadoPve || 'No aplica',
        r.direccionadoEps || 'No aplica',
        formatDate(r.fechaProximoEmo) || '',
        r.accidenteTrabajo || 'NO',
        formatDate(r.fechaAccidente) || '',
        r.estadoActualAccidente || 'No aplica',
        r.enfermedadLaboral || 'NO',
        formatDate(r.fechaEnfermedad) || '',
        r.estadoActualEnfermedad || 'No aplica',
        r.estadoFinalCaso || 'Vigente',
        r.actividadesPendientes || ''
      ];

      // Escribir celdas A7 a X7
      dataRow.forEach((val, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 6, c: idx });
        ws[cellRef] = { t: typeof val === 'number' ? 'n' : 's', v: val };
      });

      // Asegurar rango adecuado
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:X7');
      if (range.e.r < 6) range.e.r = 6;
      if (range.e.c < 23) range.e.c = 23;
      ws['!ref'] = XLSX.utils.encode_range(range);

      const cleanDoc = String(r.documento || 'perfil').replace(/[^a-zA-Z0-9]/g, '');
      const cleanNom = String(r.nombreCompleto || 'servidor').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `PERFIL_EPIDEMIOLOGICO_${cleanDoc}_${cleanNom}.xlsx`;

      XLSX.writeFile(wb, filename);
      App.showToast(`Perfil de ${r.nombreCompleto} exportado exitosamente a la plantilla oficial Excel.`, 'success');
    } catch (err) {
      console.error('[SstModule] exportSingleProfileExcel error:', err);
      App.showToast('Error al exportar plantilla Excel: ' + err.message, 'error');
    }
  }

  // ─── 2. Descargar la Plantilla Oficial en Blanco ────────────────────────────
  async function downloadOfficialTemplate() {
    if (state.tab === 'epidemiologico') {
      try {
        // Enlace directo si el archivo existe en el servidor
        const a = document.createElement('a');
        a.href = 'plantillas/PERFILEPIDEMIOLOGICO_Plantilla_Oficial.xlsx';
        a.download = 'PERFILEPIDEMIOLOGICO_Plantilla_Oficial_V3.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        App.showToast('Plantilla oficial de Perfil Epidemiológico descargada.', 'success');
        return;
      } catch (_) {}

      // Fallback programático con SheetJS
      try {
        const wb = buildOfficialTemplateWorkbook();
        XLSX.writeFile(wb, 'PERFILEPIDEMIOLOGICO_Plantilla_Oficial_V3.xlsx');
        App.showToast('Plantilla oficial generada y descargada.', 'success');
      } catch (err) {
        App.showToast('Error al descargar plantilla: ' + err.message, 'error');
      }
    } else {
      // Para otros submódulos (EPP, Sociodemográfico)
      const tabCfg = TABS[state.tab];
      ExcelService.downloadTemplate({
        filename: `Plantilla_${state.tab}`,
        sheetName: tabCfg.title.substring(0, 30),
        columns: getExcelColumns().filter(c => c.key !== 'radicado')
      });
    }
  }

  // Constructor interno de la plantilla oficial SheetJS con todas las columnas y hojas
  function buildOfficialTemplateWorkbook() {
    const cats = getCats();
    const wb = XLSX.utils.book_new();

    // 1. Hoja principal: PERFIL EPIDEMIOLÓGICO
    const ws1Data = [
      ['', '', '', '', 'FORMATO', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'VERSIÓN: 3'],
      [],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'CÓDIGO: E-DO-ST-F-024'],
      ['PERFIL  EPIDEMIOLÓGICO', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'FECHA: 30/Abr/2025'],
      [],
      [
        'N°',
        'TIPO DE IDENTIFICACIÓN',
        'NÚMERO DOCUMENTO DE IDENTIFICACIÓN',
        'APELLIDOS',
        'NOMBRES',
        'TELEFONO',
        'EDAD\n(años)',
        'FECHA DE INGRESO A LA ENTIDAD',
        'DEPENDENCIA DE LA ENTIDAD DONDE TRABAJA',
        'FECHA EMO',
        'TIPO DE EMO',
        'RESTRICCIONES',
        'RECOMENDACIONES ',
        'DIRECCIONADO \nA PVE',
        'DIRECCIONADO A EPS',
        'FECHA PRÓXIMO EMO',
        'ACCIDENTE DE TRABAJO',
        'FECHA',
        'ESTADO ACTUAL',
        'ENFERMEDAD LABORAL',
        'FECHA',
        'ESTADO ACTUAL',
        'ESTADO FINAL DEL CASO',
        'ACTIVIDADES PENDIENTES'
      ]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = [
      { wch: 7 },   // A: N°
      { wch: 28 },  // B: TIPO DE IDENTIFICACIÓN
      { wch: 16 },  // C: NÚMERO DOCUMENTO
      { wch: 24 },  // D: APELLIDOS
      { wch: 23 },  // E: NOMBRES
      { wch: 18 },  // F: TELEFONO
      { wch: 13 },  // G: EDAD
      { wch: 20 },  // H: FECHA INGRESO
      { wch: 48 },  // I: DEPENDENCIA
      { wch: 20 },  // J: FECHA EMO
      { wch: 16 },  // K: TIPO EMO
      { wch: 35 },  // L: RESTRICCIONES
      { wch: 40 },  // M: RECOMENDACIONES
      { wch: 30 },  // N: DIRECCIONADO A PVE
      { wch: 32 },  // O: DIRECCIONADO A EPS
      { wch: 25 },  // P: FECHA PROXIMO EMO
      { wch: 25 },  // Q: ACCIDENTE DE TRABAJO
      { wch: 15 },  // R: FECHA
      { wch: 30 },  // S: ESTADO ACTUAL
      { wch: 25 },  // T: ENFERMEDAD LABORAL
      { wch: 15 },  // U: FECHA
      { wch: 25 },  // V: ESTADO ACTUAL
      { wch: 25 },  // W: ESTADO FINAL
      { wch: 33 }   // X: ACTIVIDADES PENDIENTES
    ];

    // 2. Hoja 2: Hoja1 (Catálogos y listas oficiales de validación)
    const maxLen = Math.max(
      cats.tiposIdentificacion.length,
      cats.dependencias.length,
      cats.tiposEmo.length,
      cats.sedes.length,
      2
    );

    const ws2Data = [
      [],
      ['TIPO DE IDENTIFICACIÓN', 'DEPENDENCIA DE LA ENTIDAD DONDE TRABAJA', 'TIPO DE EMO', 'SEDE DE TRABAJO', 'CUMPLIÓ PROCESO DE REHABILITACIÓN']
    ];

    for (let i = 0; i < maxLen; i++) {
      ws2Data.push([
        cats.tiposIdentificacion[i] || '',
        cats.dependencias[i] || '',
        cats.tiposEmo[i] || '',
        cats.sedes[i] || '',
        i === 0 ? 'SI' : (i === 1 ? 'NO' : '')
      ]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [
      { wch: 26 },
      { wch: 50 },
      { wch: 18 },
      { wch: 42 },
      { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'PERFIL EPIDEMIOLÓGICO');
    XLSX.utils.book_append_sheet(wb, ws2, 'Hoja1');
    return wb;
  }

  // ─── 3. Modal de Exportar a Excel con Selección de Perfil ────────────────────
  function openExportProfileModal() {
    if (state.tab === 'epidemiologico') {
      const records = state.data || [];
      if (!records.length) {
        App.showToast('No hay registros en la vista actual para exportar.', 'warning');
        return;
      }

      const html = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <p style="color:var(--text-secondary);font-size:13px;margin:0;">
            Seleccione el servidor público cuyo perfil epidemiológico desea exportar a la <strong>Plantilla Oficial Excel</strong>:
          </p>
          <div class="form-group">
            <label class="form-label" style="font-weight:600;">Seleccionar Servidor Público:</label>
            <select id="sst-export-profile-select" class="filter-select" style="width:100%;font-size:13px;padding:9px 12px;">
              ${records.map(r => `
                <option value="${r.id}">
                  ${escHtml(r.nombreCompleto)} (C.C. ${escHtml(r.documento)}) — ${escHtml(r.radicado)} [${escHtml(r.tipoEmo)} ${formatDate(r.fechaEmo)}]
                </option>
              `).join('')}
            </select>
          </div>
          <div style="background:var(--bg-subtle, #f8fafc);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);">
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">Características de la exportación:</div>
            <ul style="margin:0 0 0 16px;padding:0;line-height:1.5;">
              <li>Estructura idéntica a la plantilla suministrada (Código E-DO-ST-F-024 Versión 3).</li>
              <li>Poblado de los 24 campos oficiales clínicos y ocupacionales en la fila de datos.</li>
              <li>Incluye hoja de catálogos y listas oficiales de la Gobernación de Boyacá.</li>
            </ul>
          </div>
        </div>
      `;

      App.openModal('Exportar a Plantilla Oficial Excel', html, [
        { text: 'Cancelar', cls: 'btn-secondary', action: () => App.closeModal() },
        {
          text: 'Exportar Tabla Completa (.xlsx)',
          cls: 'btn-secondary',
          action: () => {
            App.closeModal();
            exportExcelAllCurrent();
          }
        },
        {
          text: 'Descargar Perfil Seleccionado (.xlsx)',
          cls: 'btn-primary',
          action: () => {
            const selId = parseInt(document.getElementById('sst-export-profile-select')?.value);
            App.closeModal();
            if (selId) exportSingleProfileExcel(selId);
          }
        }
      ]);
    } else {
      exportExcel();
    }
  }

  function exportExcelAllCurrent() {
    exportExcel();
  }

  // ─── 4. Generación y Descarga de Reporte Anual Consolidado ───────────────────
  async function generateAnnualReport() {
    if (typeof XLSX === 'undefined') {
      App.showToast('La biblioteca SheetJS aún no está cargada.', 'error');
      return;
    }

    try {
      App.showToast('Generando Reporte Anual Consolidado SST...', 'info');

      // Obtener todos los registros disponibles
      const res = await API.getSstEpidemiologico({ limit: 5000 });
      const records = res.data || state.data || [];

      if (!records.length) {
        App.showToast('No hay registros de Perfil Epidemiológico para generar el reporte anual.', 'warning');
        return;
      }

      const anioActual = new Date().getFullYear();
      const fechaHoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

      // Estadísticas e indicadores anuales
      const total = records.length;
      let countVigentes = 0;
      let countSeguimiento = 0;
      let countRehab = 0;
      let countAlertas = 0;
      let countCerrados = 0;
      let countAt = 0;
      let countEl = 0;
      let countRestricciones = 0;
      let countPve = 0;

      const porTipoEmo = {};
      const porPve = {};
      const porDependencia = {};

      records.forEach(r => {
        const est = (r.estadoFinalCaso || 'Vigente').toLowerCase();
        if (est.includes('vigente')) countVigentes++;
        else if (est.includes('seguimiento')) countSeguimiento++;
        else if (est.includes('rehabilit')) countRehab++;
        else if (est.includes('venc') || est.includes('próx')) countAlertas++;
        else if (est.includes('cerrad')) countCerrados++;

        if (r.accidenteTrabajo === 'SI') countAt++;
        if (r.enfermedadLaboral === 'SI') countEl++;
        if (r.restricciones && r.restricciones.toUpperCase() !== 'NINGUNA') countRestricciones++;
        if (r.direccionadoPve && r.direccionadoPve !== 'No aplica') countPve++;

        const tEmo = r.tipoEmo || 'Periódico';
        porTipoEmo[tEmo] = (porTipoEmo[tEmo] || 0) + 1;

        const pveProg = r.direccionadoPve || 'No aplica';
        porPve[pveProg] = (porPve[pveProg] || 0) + 1;

        const dep = r.dependencia || 'SGEN - SECRETARIA GENERAL';
        porDependencia[dep] = (porDependencia[dep] || 0) + 1;
      });

      // Crear Libro Excel con SheetJS
      const wb = XLSX.utils.book_new();

      // ───────────────────────────────────────────────────────────────────────
      // HOJA 1: RESUMEN EJECUTIVO E INDICADORES ANUALES
      // ───────────────────────────────────────────────────────────────────────
      const summaryRows = [
        ['GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL'],
        ['SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO'],
        [`REPORTE ANUAL CONSOLIDADO — PERFIL EPIDEMIOLÓGICO Y EMO (VIGENCIA ${anioActual})`],
        [`Fecha de Emisión: ${fechaHoy} | Total Servidores Evaluados: ${total}`],
        [],
        ['1. INDICADORES GLOBALES DE VIGILANCIA EPIDEMIOLÓGICA', 'CANTIDAD', 'PORCENTAJE (%)'],
        ['Total Exámenes Médicos Ocupacionales (EMO) Realizados', total, '100%'],
        ['Casos Vigentes con Aptitud Laboral', countVigentes, `${((countVigentes / total) * 100).toFixed(1)}%`],
        ['Casos en Seguimiento Médico Activo', countSeguimiento, `${((countSeguimiento / total) * 100).toFixed(1)}%`],
        ['Casos en Proceso de Rehabilitación Ocupacional', countRehab, `${((countRehab / total) * 100).toFixed(1)}%`],
        ['Casos Vencidos o Próximos a Vencer (Alertas SST)', countAlertas, `${((countAlertas / total) * 100).toFixed(1)}%`],
        ['Casos Cerrados en la Vigencia', countCerrados, `${((countCerrados / total) * 100).toFixed(1)}%`],
        ['Servidores con Restricciones Médicas Laborales', countRestricciones, `${((countRestricciones / total) * 100).toFixed(1)}%`],
        ['Servidores Ingresados a Programas PVE', countPve, `${((countPve / total) * 100).toFixed(1)}%`],
        ['Casos con Accidente de Trabajo (AT) Registrado', countAt, `${((countAt / total) * 100).toFixed(1)}%`],
        ['Casos con Enfermedad Laboral (EL) Registrada', countEl, `${((countEl / total) * 100).toFixed(1)}%`],
        [],
        ['2. CLASIFICACIÓN POR TIPO DE EXAMEN MÉDICO OCUPACIONAL', 'CANTIDAD', 'PORCENTAJE (%)']
      ];

      Object.entries(porTipoEmo).forEach(([tipo, cant]) => {
        summaryRows.push([tipo, cant, `${((cant / total) * 100).toFixed(1)}%`]);
      });

      summaryRows.push([]);
      summaryRows.push(['3. PROGRAMAS DE VIGILANCIA EPIDEMIOLÓGICA (PVE)', 'CANTIDAD', 'PORCENTAJE (%)']);
      Object.entries(porPve).forEach(([prog, cant]) => {
        summaryRows.push([prog, cant, `${((cant / total) * 100).toFixed(1)}%`]);
      });

      summaryRows.push([]);
      summaryRows.push(['4. COBERTURA POR DEPENDENCIAS (TOP)', 'CANTIDAD DE SERVIDORES', 'PORCENTAJE (%)']);
      Object.entries(porDependencia)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([dep, cant]) => {
          summaryRows.push([dep, cant, `${((cant / total) * 100).toFixed(1)}%`]);
        });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 55 }, { wch: 24 }, { wch: 20 }];

      // ───────────────────────────────────────────────────────────────────────
      // HOJA 2: BASE CONSOLIDADA DE PERFILES EPIDEMIOLÓGICOS (24 COLUMNAS OFICIALES)
      // ───────────────────────────────────────────────────────────────────────
      const baseRows = [
        [
          'N°',
          'TIPO DE IDENTIFICACIÓN',
          'NÚMERO DOCUMENTO DE IDENTIFICACIÓN',
          'APELLIDOS',
          'NOMBRES',
          'TELEFONO',
          'EDAD (años)',
          'FECHA DE INGRESO A LA ENTIDAD',
          'DEPENDENCIA DE LA ENTIDAD DONDE TRABAJA',
          'SEDE DE TRABAJO',
          'CARGO',
          'FECHA EMO',
          'TIPO DE EMO',
          'RESTRICCIONES',
          'RECOMENDACIONES',
          'DIRECCIONADO A PVE',
          'DIRECCIONADO A EPS',
          'FECHA PRÓXIMO EMO',
          'ACCIDENTE DE TRABAJO',
          'FECHA ACCIDENTE',
          'ESTADO ACTUAL ACCIDENTE',
          'ENFERMEDAD LABORAL',
          'FECHA ENFERMEDAD',
          'ESTADO ACTUAL ENFERMEDAD',
          'CUMPLIÓ REHABILITACIÓN',
          'ESTADO FINAL DEL CASO',
          'ACTIVIDADES PENDIENTES'
        ]
      ];

      records.forEach((r, idx) => {
        const apellidos = r.apellidos || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(0, 2).join(' ') : '');
        const nombres = r.nombres || (r.nombreCompleto ? r.nombreCompleto.split(' ').slice(2).join(' ') : '');
        baseRows.push([
          idx + 1,
          r.tipoIdentificacion || 'Cédula de Ciudadanía',
          r.documento || '',
          apellidos,
          nombres,
          r.telefono || '',
          r.edad || '',
          formatDate(r.fechaIngreso) || '',
          r.dependencia || '',
          r.sedeTrabajo || 'CASA DE LA TORRE',
          r.cargo || '',
          formatDate(r.fechaEmo) || '',
          r.tipoEmo || 'Periódico',
          r.restricciones || 'NINGUNA',
          r.recomendaciones || '',
          r.direccionadoPve || 'No aplica',
          r.direccionadoEps || 'No aplica',
          formatDate(r.fechaProximoEmo) || '',
          r.accidenteTrabajo || 'NO',
          formatDate(r.fechaAccidente) || '',
          r.estadoActualAccidente || 'No aplica',
          r.enfermedadLaboral || 'NO',
          formatDate(r.fechaEnfermedad) || '',
          r.estadoActualEnfermedad || 'No aplica',
          r.cumplioRehabilitacion || 'N/A',
          r.estadoFinalCaso || 'Vigente',
          r.actividadesPendientes || ''
        ]);
      });

      const wsBase = XLSX.utils.aoa_to_sheet(baseRows);
      wsBase['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 16 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 45 },
        { wch: 28 },
        { wch: 26 },
        { wch: 16 },
        { wch: 16 },
        { wch: 32 },
        { wch: 35 },
        { wch: 28 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 26 },
        { wch: 16 },
        { wch: 16 },
        { wch: 26 },
        { wch: 16 },
        { wch: 20 },
        { wch: 32 }
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Indicadores Anuales SST');
      XLSX.utils.book_append_sheet(wb, wsBase, 'Base Consolidada');

      const filename = `Reporte_Anual_Perfil_Epidemiologico_${anioActual}.xlsx`;
      XLSX.writeFile(wb, filename);

      App.showToast(`Reporte anual de ${total} perfiles epidemiológicos generado exitosamente.`, 'success');
    } catch (err) {
      console.error('[SstModule] generateAnnualReport error:', err);
      App.showToast('Error al generar reporte anual: ' + err.message, 'error');
    }
  }

  function openImportModal() {
    const tabCfg = TABS[state.tab];
    const cols = getExcelColumns().filter(c => c.key !== 'radicado');

    ExcelService.openImportModal({
      title: `Carga Masiva SST — ${tabCfg.title}`,
      subtitle: 'Importe registros desde archivo Excel o respuestas de Microsoft Forms',
      moduleName: tabCfg.title.toLowerCase(),
      columns: cols,
      sampleRows: [
        {
          'Documento': '1003481573',
          'Servidor Público': 'ROMERO MARIN IVAN DARIO',
          'Dependencia': 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo'
        }
      ],
      validateRow: (row) => {
        const documento = String(row['Documento'] || row['NÚMERO DOCUMENTO DE IDENTIFICACIÓN'] || row['Cédula'] || row.documento || '').trim();
        const nombreCompleto = String(
          row['Servidor Público'] ||
          row['Nombres y apellidos'] ||
          row.nombreCompleto ||
          `${row['APELLIDOS'] || ''} ${row['NOMBRES'] || ''}`.trim()
        ).trim();

        if (!documento || !nombreCompleto) {
          return { valid: false, error: 'Documento y nombre del servidor son obligatorios.' };
        }
        return {
          valid: true,
          cleanRow: {
            ...row,
            documento,
            nombreCompleto,
            dependencia: String(row['Dependencia'] || row['DEPENDENCIA DE LA ENTIDAD DONDE TRABAJA'] || 'SGEN - SECRETARIA GENERAL (Despacho)').trim(),
            sedeTrabajo: String(row['Sede de Trabajo'] || row['SEDE DE TRABAJO'] || 'CASA DE LA TORRE').trim(),
            tipoEmo: String(row['Tipo de EMO'] || row['TIPO DE EMO'] || 'Periódico').trim(),
            elementoEpp: String(row['Elemento EPP'] || row['Elemento '] || 'A. Casco de seguridad').trim(),
            escolaridad: String(row['Escolaridad'] || row['ESCOLARIDAD'] || 'Profesional').trim()
          }
        };
      },
      onImport: async (rows) => {
        let res;
        if (state.tab === 'epidemiologico') res = await API.bulkCreateSstEpidemiologico(rows);
        else if (state.tab === 'epp') res = await API.bulkCreateSstEpp(rows);
        else res = await API.bulkCreateSstSociodemografico(rows);

        App.showToast(res.message || 'Carga masiva SST completada.', 'success');
        loadStats();
        await load();
      }
    });
  }

  return {
    render,
    setTab,
    openCreate,
    openEdit,
    openView,
    confirmDelete,
    clearSignature,
    checkEmoVencimientos,
    applyFilters,
    clearFilters,
    goPage,
    onEmployeeInput,
    selectEmployee,
    exportSinglePdf,
    exportSingleProfileExcel,
    downloadOfficialTemplate,
    openExportProfileModal,
    generateAnnualReport,
    exportExcel,
    openImportModal,
    onFechaEmoChange,
    onTipoEmoChange,
    onAtToggle,
    onElToggle,
    onApellidosNombresChange,
    toggleActionsDropdown,
    closeActionsDropdown,
    handleDropdownKeydown
  };
})();

if (typeof window !== 'undefined') {
  window.SstModule = SstModule;
}
