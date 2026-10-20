/* ═══════════════════════════════════════════════════════════════════════════
   catalogs/permisos.js — Catálogos y reglas del formulario de Permisos Laborales
   Fuente: «CamposFormulario.xlsx» (formulario de Microsoft Forms de la Gobernación
   de Boyacá). Los textos de sectoriales, dependencias, niveles y cargos se
   conservan tal cual aparecen en el formulario oficial.
   ═══════════════════════════════════════════════════════════════════════════ */

// Dominio institucional permitido para los correos (configurable por entorno).
// Si ALLOWED_EMAIL_DOMAIN se define vacío, se desactiva la restricción.
const EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN !== undefined
  ? process.env.ALLOWED_EMAIL_DOMAIN.trim().toLowerCase()
  : 'boyaca.gov.co';

// ─── Sectoriales → Dependencias ───────────────────────────────────────────────
// Las sectoriales que en el formulario no listan dependencias (Educación, Cultura,
// Minas y Energía, Turismo) exponen la propia sectorial como única dependencia.
const SECTORIALES = [
  {
    "nombre": "DESPACHO DEL GOBERNADOR",
    "dependencias": [
      "DESPACHO DEL GOBERNADOR",
      "OFICINA DE CONTROL INTERNO",
      "OFICINA CONTROL INTERNO DISCIPLINARIO (INSTRUCCIÓN)",
      "UNIDAD ADMINISTRATIVA ESPECIAL DE ASESORIA Y DEFENSA JURIDICA DEL DEPARTAMENTO",
      "UNIDAD ADMINISTRATIVA ESPECIAL PARA LA GESTION DEL RIESGO DE DESASTRES",
      "UNIDAD ADMINISTRATIVA DE RELACIONES NACIONALES E INTERNACIONALES",
      "UNIDAD ADMINISTRATIVA DE COMUNICACIONES Y PROTOCOLO",
      "SUBDIRECCION DE RADIO Y TELEVISION"
    ]
  },
  {
    "nombre": "SECRETARIA DE PLANEACIÓN",
    "dependencias": [
      "SECRETARIA DE PLANEACION",
      "OFICINA ASESORA DE PLANEACION Y METODOS DE GESTION",
      "DIRECCION DE SEGUIMIENTO Y PLANEACION TERRITORIAL",
      "DIRECCION GEOGRAFICA Y DE GESTION TERRITORIAL",
      "DIRECCION DE INVERSION PUBLICA DEL DEPARTAMENTO"
    ]
  },
  {
    "nombre": "SECRETARIA DE HACIENDA",
    "dependencias": [
      "SECRETARIA DE HACIENDA",
      "DIRECCION FINANCIERA Y FISCAL",
      "SUBDIRECCION DE PRESUPUESTO",
      "SUBDIRECCION DE CENTRAL DE CUENTAS",
      "SUBDIRECCION DE CONTABILIDAD",
      "SUBDIRECCION DE COBRO COACTIVO",
      "TESORERIA GENERAL",
      "DIRECCION DE RECAUDO Y FISCALIZACION",
      "DIRECCION DEPARTAMENTAL DE PASIVOS PENSIONALES",
      "SUBDIRECCION ADMINISTRATIVA DE PASIVOS PENSIONALES",
      "SUBDIRECCION JURIDICA DE PASIVOS PENSIONALES"
    ]
  },
  {
    "nombre": "SECRETARIA DE CONTRATACIÓN",
    "dependencias": [
      "SECRETARIA DE CONTRATACION",
      "DIRECCION DE PROCESOS DE SELECCIÓN",
      "DIRECCION ADMINISTRATIVA CONTRACTUAL"
    ]
  },
  {
    "nombre": "SECRETARIA GENERAL",
    "dependencias": [
      "SECRETARIA GENERAL",
      "DIRECCION GENERAL DE TALENTO HUMANO",
      "SUBDIRECCION DE SEGURIDAD Y SALUD EN EL TRABAJO",
      "DIRECCION SERVICIOS ADMINISTRATIVOS Y LOGISTICOS",
      "SUBDIRECCION DE ATENCION AL CIUDADANO",
      "SUBDIRECCION DE GESTION DOCUMENTAL"
    ]
  },
  {
    "nombre": "SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL",
    "dependencias": [
      "SECRETARIA DE GOBIERNO Y ACCION COMUNAL",
      "DIRECCION DE DIALOGO SOCIAL Y CONVIVENCIA",
      "DIRECCION DE PARTICIPACION Y ACCION COMUNAL",
      "DIRECCION DE JUVENTUD"
    ]
  },
  {
    "nombre": "SECRETARIA DE INTEGRACIÓN SOCIAL",
    "dependencias": [
      "SECRETARIA DE INTEGRACION SOCIAL",
      "DIRECCION DE FAMILIA, INFANCIA, ADOLESCENCIA Y ADULTO MAYOR",
      "DIRECCION DE LA MUJER E INCLUSION SOCIAL"
    ]
  },
  {
    "nombre": "SECRETARIA DE EDUCACIÓN",
    "dependencias": [
      "SECRETARIA DE EDUCACIÓN"
    ]
  },
  {
    "nombre": "SECRETARIA DE CULTURA Y PATRIMONIO",
    "dependencias": [
      "SECRETARIA DE CULTURA Y PATRIMONIO"
    ]
  },
  {
    "nombre": "SECRETARIA DE SALUD",
    "dependencias": [
      "SECRETARIA DE SALUD",
      "OFICINA ASESORA Y DEFENSA JURIDICA DEL SECTOR SALUD",
      "OFICINA ASESORA PARA LA GESTION ESTRATEGICA DEL SECTOR SALUD",
      "DIRECCION DE PROMOCION Y PREVENCION EN SALUD",
      "SUBDIRECCION DE PROMOCION EN SALUD",
      "DIRECCION DE ASEGURAMIENTO EN SALUD",
      "DIRECCION DE PRESTACION DE SERVICIOS DE SALUD"
    ]
  },
  {
    "nombre": "SECRETARIA DE INFRAESTRUCTURA PUBLICA",
    "dependencias": [
      "SECRETARIA DE INFRAESTRUCTURA PUBLICA",
      "DIRECCION TECNICA DE ESTUDIOS Y DISEÑO",
      "DIRECCION DE DESARROLLO DE LA INFRAESTRUCTURA VIAL",
      "DIRECCION DE VIVIENDA, EDIFICACIONES Y OBRA PUBLICA"
    ]
  },
  {
    "nombre": "SECRETARIA DE MINAS Y ENERGÍA",
    "dependencias": [
      "SECRETARIA DE MINAS Y ENERGÍA"
    ]
  },
  {
    "nombre": "SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE",
    "dependencias": [
      "SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE",
      "DIRECCION DE GESTION DEL RECURSO HIDRICO Y SANEAMIENTO BASICO"
    ]
  },
  {
    "nombre": "SECRETARIA DE AGRICULTURA",
    "dependencias": [
      "SECRETARIA DE AGRICULTURA",
      "DIRECCION DE DESARROLLO RURAL INTEGRAL",
      "DIRECCION DE BIENESTAR CAMPESINO",
      "DIRECCION DE PRODUCTIVIDAD AGROPECUARIA"
    ]
  },
  {
    "nombre": "SECRETARIA DE DESARROLLO EMPRESARIAL",
    "dependencias": [
      "SECRETARIA DE DESARROLLO EMPRESARIAL",
      "DIRECCION DE DESARROLLO EMPRESARIAL",
      "DIRECCION DE INVERSION Y COMERCIO"
    ]
  },
  {
    "nombre": "SECRETARIA DE TURISMO",
    "dependencias": [
      "SECRETARIA DE TURISMO"
    ]
  },
  {
    "nombre": "SECRETARIA DE TIC Y GOBIERNO ABIERTO",
    "dependencias": [
      "SECRETARIA DE TIC Y GOBIERNO ABIERTO",
      "DIRECCION DE APROPIACION DE TIC",
      "DIRECCION DE SISTEMAS"
    ]
  }
];

// ─── Niveles → Cargos ─────────────────────────────────────────────────────────
const NIVELES = [
  {
    "nombre": "DIRECTIVO",
    "cargos": [
      "GOBERNADOR",
      "SECRETARIO DE DESPACHO",
      "ASESOR",
      "DIRECTOR ADMINISTRATIVO",
      "DIRECTOR TÉCNICO",
      "SUBDIRECTOR TÉCNICO"
    ]
  },
  {
    "nombre": "ASESOR",
    "cargos": [
      "ASESOR",
      "JEFE DE OFICINA ASESORA"
    ]
  },
  {
    "nombre": "PROFESIONAL",
    "cargos": [
      "TESORERO GENERAL",
      "ALMACENISTA GENERAL",
      "PROFESIONAL ESPECIALIZADO",
      "PROFESIONAL UNIVERSITARIO"
    ]
  },
  {
    "nombre": "TÉCNICO",
    "cargos": [
      "TÉCNICO OPERATIVO",
      "TÉCNICO ADMINISTRATIVO"
    ]
  },
  {
    "nombre": "ASISTENCIAL",
    "cargos": [
      "SECRETARIO EJECUTIVO DEL DESPACHO",
      "SECRETARIO (A) EJECUTIVO",
      "SECRETARIO (A)",
      "AUXILIAR ADMINISTRATIVO",
      "CONDUCTOR",
      "CONDUCTOR MECÁNICO",
      "CELADOR",
      "AUXILIAR DE SERVICIOS GENERALES",
      "OPERARIO"
    ]
  }
];

// ─── Duración del permiso ─────────────────────────────────────────────────────
const MODALIDADES = [
  { id: 'horas',       label: 'Unas horas',  desc: 'Salida y regreso dentro de la mañana o de la tarde' },
  { id: 'dia',         label: 'Un día',      desc: 'Todo el día, toda la mañana o toda la tarde' },
  { id: 'varios_dias', label: 'Varios días', desc: 'Un rango de fechas en días hábiles' },
];

// ─── Jornadas (formulario: MAÑANA / TARDE con hora de entrada y salida, TODO EL
//     DÍA, TODA LA MAÑANA, TODA LA TARDE) ───────────────────────────────────────
// «ventana» = rango horario razonable para las horas de entrada/salida.
const JORNADAS = [
  { id: 'MANANA',         label: 'Mañana',         modalidad: 'horas', ventana: ['05:00', '13:00'] },
  { id: 'TARDE',          label: 'Tarde',          modalidad: 'horas', ventana: ['12:00', '20:00'] },
  { id: 'TODO_EL_DIA',    label: 'Todo el día',    modalidad: 'dia' },
  { id: 'TODA_LA_MANANA', label: 'Toda la mañana', modalidad: 'dia' },
  { id: 'TODA_LA_TARDE',  label: 'Toda la tarde',  modalidad: 'dia' },
];

// ─── Motivos ──────────────────────────────────────────────────────────────────
// Reglas de los incentivos (según el texto del formulario de la Gobernación):
//   modalidades       → tipos de duración permitidos
//   jornadas          → jornadas permitidas (modalidad «dia»)
//   diasExactos       → número exacto de días hábiles
//   soporteObligatorio→ exige adjuntar al menos un soporte
//   cumpleanos        → el permiso debe caer el día del cumpleaños o en los 30 días siguientes
//   limite            → máximo de solicitudes (no rechazadas) por periodo («semestre» | «anio»)
//   ayuda             → texto informativo mostrado al servidor público
const MOTIVOS = [
  { id: 'CITA_MEDICA',        label: 'Cita médica - examen o procedimiento' },
  { id: 'ASUNTOS_FAMILIARES', label: 'Asuntos familiares o personales' },
  {
    id: 'INCENTIVOS', label: 'Incentivos institucionales',
    opciones: [
      {
        id: 'MEJOR_SERVIDOR', label: 'Mejor servidor público por semestre (1 día)',
        reglas: {
          modalidades: ['dia'], jornadas: ['TODO_EL_DIA'], limite: { periodo: 'semestre', max: 1 },
          ayuda: 'Se otorga 1 día completo por semestre.'
        }
      },
    ]
  },
  {
    id: 'OTRAS', label: 'Otras',
    opciones: [
      {
        id: 'CELEBRA_LA_VIDA', label: 'Celebra la vida «Día de cumpleaños» (el día del cumpleaños o en los 30 días siguientes a la fecha)',
        reglas: {
          modalidades: ['dia'], jornadas: ['TODO_EL_DIA'], cumpleanos: true, limite: { periodo: 'anio', max: 1 },
          ayuda: 'Aplica 1 día completo: el día del cumpleaños o dentro de los 30 días siguientes.'
        }
      },
      {
        id: 'QUINQUENIOS', label: 'Reconocimiento por tiempo de servicio - Quinquenios (según los días autorizados establecidos en el decreto)',
        reglas: {
          ayuda: 'Los días autorizados son los establecidos en el decreto. La Dirección General de Talento Humano verificará el tiempo de servicio.'
        }
      },
      {
        id: 'PRO_BICI', label: 'Incentivo Pro Bici (debe presentar los soportes a la Dirección General de Talento Humano)',
        reglas: {
          soporteObligatorio: true,
          ayuda: 'Debe adjuntar los soportes del incentivo Pro Bici para radicar la solicitud.'
        }
      },
      {
        id: 'MATRIMONIO', label: 'Incentivo por matrimonio (3 días)',
        reglas: {
          modalidades: ['varios_dias'], diasExactos: 3,
          ayuda: 'Se otorgan 3 días hábiles. La fecha final se calcula automáticamente.'
        }
      },
      {
        id: 'DIA_FAMILIA', label: 'Día de la familia (según las directrices de la Dirección General de Talento Humano)',
        reglas: {
          ayuda: 'Se concede según las directrices de la Dirección General de Talento Humano.'
        }
      },
      {
        id: 'BRIGADISTA_SEMESTRE', label: 'Incentivo al brigadista del semestre - Decreto 813-2019 (notificado por la Subdirección de SST)',
        reglas: {
          limite: { periodo: 'semestre', max: 1 },
          ayuda: 'Requiere notificación de la Subdirección de Seguridad y Salud en el Trabajo (Decreto 813 de 2019).'
        }
      },
      {
        id: 'BRIGADA_UN_ANIO', label: 'Incentivo por un año de servicio en la brigada de emergencia - Decreto 813-2019 (certificado por SST)',
        reglas: {
          soporteObligatorio: true, limite: { periodo: 'anio', max: 1 },
          ayuda: 'Debe adjuntar el certificado expedido por la Subdirección de SST (Decreto 813 de 2019).'
        }
      },
    ]
  },
];

// ─── Soportes ─────────────────────────────────────────────────────────────────
const SOPORTES = {
  maxArchivos: 5,
  maxBytes: 5 * 1024 * 1024,
  tipos: ['application/pdf', 'image/jpeg', 'image/png'],
};

function getMotivo(catId) { return MOTIVOS.find(m => m.id === catId) || null; }
function getIncentivo(catId, optId) {
  const m = getMotivo(catId);
  return (m && m.opciones && m.opciones.find(o => o.id === optId)) || null;
}

module.exports = {
  EMAIL_DOMAIN, SECTORIALES, NIVELES, MODALIDADES, JORNADAS, MOTIVOS, SOPORTES,
  getMotivo, getIncentivo,
};
