// Catálogo de informes: describe solo datos que existen en la base de datos.
// Para agregar un informe o un filtro basta con editar este archivo.
// Las expresiones SQL son fijas: lo que envía el usuario solo viaja como parámetro.

const fechaTexto = (expr) => `COALESCE(to_char(reporte_fecha(${expr}), 'YYYY-MM-DD'), ${expr})`;
const fechaColumna = (expr) => `to_char(${expr}, 'YYYY-MM-DD')`;

const col = (key, label, expr, porDefecto = true) => ({ key, label, expr, porDefecto });
const texto = (key, label, expr) => ({ key, label, expr, tipo: 'texto' });
const documento = (expr) => ({ key: 'documento', label: 'Cédula', expr, tipo: 'documento' });
const lista = (key, label, expr, opciones) => ({ key, label, expr, tipo: 'lista', opciones });
const fechas = (key, label, expr) => ({ key, label, expr, tipo: 'fechas' });
const numero = (key, label, expr) => ({ key, label, expr, tipo: 'numero' });

const ES_VACANTE = `(COALESCE(p.es_vacante, FALSE) OR COALESCE(p.primer_apellido, '') = 'VACANTE' OR COALESCE(p.nombre_completo, '') LIKE 'PLAZA VACANTE%')`;
const ESTADO_APROBADO = `UPPER(estado) IN ('APROBADA', 'APROBADO', 'FINALIZADA', 'FINALIZADO')`;

const SOURCES = [
  {
    id: 'servidores',
    nombre: 'Servidores públicos y vacantes',
    descripcion: 'Planta de personal: vinculación, cargo, dependencia y estado.',
    modulos: ['employees'],
    from: `rel_principal r
      JOIN personas p ON p.id_persona = r.id_persona
      LEFT JOIN dependencias d ON d.id_dependencia = r.id_dependencia
      LEFT JOIN cargos ca ON ca.id_cargo = r.id_cargo_actual
      LEFT JOIN contactos con ON con.id_contacto = r.id_contacto
      LEFT JOIN educacion edu ON edu.id_educacion = r.id_educacion
      LEFT JOIN estados e ON e.id_estado = r.id_estado`,
    orden: 'p.nombre_completo, r.id_registro',
    columnas: [
      col('cedula', 'Cédula', 'p.cedula'),
      col('nombre', 'Servidor público', 'p.nombre_completo'),
      col('dependencia', 'Dependencia', 'd.dependencia'),
      col('cargo', 'Cargo', 'ca.cargo'),
      col('codigo', 'Código', 'ca.codigo', false),
      col('grado', 'Grado', 'ca.grado', false),
      col('nivel', 'Nivel', 'ca.nivel'),
      col('vinculacion', 'Tipo de vinculación', 'e.clasificacion_empleo'),
      col('situacion', 'Situación', 'e.situacion', false),
      col('estado', 'Estado', "COALESCE(e.estado_servidor, 'Activo')"),
      col('ingreso', 'Fecha de ingreso', fechaTexto('r.fecha_ingreso')),
      col('retiro', 'Fecha de retiro', fechaTexto('r.fecha_retiro'), false),
      col('tiempo', 'Tiempo de servicio', 'r.tiempo_servicio', false),
      col('asignacion', 'Asignación', 'ca.asignacion_sueldo', false),
      col('correo', 'Correo institucional', 'con.correo_institucional', false),
      col('sexo', 'Sexo', 'p.sexo', false),
      col('estudios', 'Estudios', 'edu.estudios', false),
      col('opec', 'OPEC', 'e.opec', false),
    ],
    filtros: [
      documento('p.cedula'),
      texto('nombre', 'Nombre', 'p.nombre_completo'),
      lista('dependencia', 'Dependencia', 'd.dependencia'),
      lista('cargo', 'Cargo', 'ca.cargo'),
      lista('nivel', 'Nivel', 'ca.nivel'),
      lista('vinculacion', 'Tipo de vinculación', 'e.clasificacion_empleo'),
      lista('situacion', 'Situación', 'e.situacion'),
      lista('estado', 'Estado', "COALESCE(e.estado_servidor, 'Activo')"),
      lista('registro', 'Tipo de registro', `CASE WHEN ${ES_VACANTE} THEN 'Plaza vacante' ELSE 'Servidor' END`, ['Servidor', 'Plaza vacante']),
      lista('sexo', 'Sexo', 'p.sexo'),
      fechas('ingreso', 'Fecha de ingreso', 'reporte_fecha(r.fecha_ingreso)'),
      fechas('retiro', 'Fecha de retiro', 'reporte_fecha(r.fecha_retiro)'),
    ],
  },
  {
    id: 'vacaciones',
    nombre: 'Vacaciones',
    descripcion: 'Solicitudes de vacaciones, periodos y estados.',
    modulos: ['requests'],
    from: 'vacaciones v',
    orden: 'v.id_vacacion DESC',
    columnas: [
      col('numero', 'Número', 'v.numero', false),
      col('documento', 'Cédula', 'v.documento'),
      col('nombre', 'Servidor público', 'v.apellidos_nombres'),
      col('dependencia', 'Dependencia', 'v.dependencia'),
      col('cargo', 'Cargo', 'v.cargo'),
      col('inicio', 'Fecha de inicio', fechaTexto('v.fecha_ingreso')),
      col('solicitud', 'Fecha de solicitud', fechaTexto('v.hoy'), false),
      col('dias', 'Días', 'v.dias_totales'),
      col('periodos', 'Periodos', 'v.periodos'),
      col('vinculacion', 'Tipo', 'v.tipo_vinculacion', false),
      col('estado', 'Estado', 'v.estado'),
      col('observaciones', 'Observaciones', 'v.observaciones', false),
    ],
    filtros: [
      documento('v.documento'),
      texto('nombre', 'Nombre', 'v.apellidos_nombres'),
      lista('dependencia', 'Dependencia', 'v.dependencia'),
      lista('cargo', 'Cargo', 'v.cargo'),
      lista('estado', 'Estado', 'v.estado'),
      texto('periodos', 'Periodo', 'v.periodos'),
      fechas('inicio', 'Fecha de inicio', 'reporte_fecha(v.fecha_ingreso)'),
      fechas('solicitud', 'Fecha de solicitud', 'reporte_fecha(v.hoy)'),
    ],
  },
  {
    id: 'solicitudes',
    nombre: 'Permisos, incapacidades y licencias',
    descripcion: 'Solicitudes administrativas por tipo, fechas y estado de aprobación.',
    modulos: ['admin-requests'],
    from: 'solicitudes_admin s',
    orden: 's.id_solicitud DESC',
    columnas: [
      col('tipo', 'Tipo', 's.tipo'),
      col('documento', 'Cédula', 's.documento'),
      col('nombre', 'Servidor público', 's.apellidos_nombres'),
      col('dependencia', 'Dependencia', 's.dependencia'),
      col('cargo', 'Cargo', 's.cargo', false),
      col('inicio', 'Fecha de inicio', fechaTexto('s.fecha_inicio')),
      col('fin', 'Fecha de fin', fechaTexto('s.fecha_fin')),
      col('dias', 'Días', 's.dias_solicitados'),
      col('motivo', 'Motivo', 's.motivo', false),
      col('estado', 'Estado', 's.estado'),
      col('aprobado', 'Aprobado por', 's.aprobado_por', false),
      col('observaciones', 'Observaciones', 's.observaciones', false),
    ],
    filtros: [
      lista('tipo', 'Tipo', 's.tipo', ['Permiso Laboral', 'Incapacidad', 'Licencia']),
      documento('s.documento'),
      texto('nombre', 'Nombre', 's.apellidos_nombres'),
      lista('dependencia', 'Dependencia', 's.dependencia'),
      lista('cargo', 'Cargo', 's.cargo'),
      lista('estado', 'Estado de aprobación', 's.estado'),
      fechas('inicio', 'Fecha de inicio', 'reporte_fecha(s.fecha_inicio)'),
      fechas('fin', 'Fecha de fin', 'reporte_fecha(s.fecha_fin)'),
      numero('dias', 'Días', 's.dias_solicitados'),
    ],
  },
  {
    id: 'viaticos',
    nombre: 'Viáticos y comisiones',
    descripcion: 'Comisiones por destino, resolución, valores y estado.',
    modulos: ['viaticos'],
    from: 'viaticos vi',
    orden: 'vi.id_viatico DESC',
    columnas: [
      col('documento', 'Cédula', 'vi.documento'),
      col('nombre', 'Servidor público', 'vi.apellidos_nombres'),
      col('dependencia', 'Dependencia', 'vi.dependencia'),
      col('cargo', 'Cargo', 'vi.cargo', false),
      col('destino', 'Destino', 'vi.destino'),
      col('tipo_destino', 'Tipo de destino', 'vi.tipo_destino', false),
      col('motivo', 'Motivo', 'vi.motivo', false),
      col('inicio', 'Fecha de inicio', fechaTexto('vi.fecha_inicio')),
      col('fin', 'Fecha de fin', fechaTexto('vi.fecha_fin')),
      col('dias', 'Días', 'vi.dias'),
      col('valor', 'Valor total', 'vi.valor_total'),
      col('resolucion', 'Resolución', 'vi.numero_resolucion', false),
      col('estado', 'Estado', 'vi.estado'),
    ],
    filtros: [
      documento('vi.documento'),
      texto('nombre', 'Nombre', 'vi.apellidos_nombres'),
      lista('dependencia', 'Dependencia', 'vi.dependencia'),
      texto('destino', 'Destino', 'vi.destino'),
      lista('tipo_destino', 'Tipo de destino', 'vi.tipo_destino'),
      lista('estado', 'Estado', 'vi.estado'),
      texto('resolucion', 'Resolución', 'vi.numero_resolucion'),
      fechas('inicio', 'Fecha de inicio', 'reporte_fecha(vi.fecha_inicio)'),
      fechas('fin', 'Fecha de fin', 'reporte_fecha(vi.fecha_fin)'),
      numero('valor', 'Valor total', 'vi.valor_total'),
    ],
  },
  {
    id: 'horarios',
    nombre: 'Horarios y modalidades',
    descripcion: 'Teletrabajo, trabajo en casa y horario flexible, con su vigencia.',
    modulos: ['horarios'],
    from: 'horarios h',
    orden: 'h.fecha_inicio DESC, h.id_horario DESC',
    columnas: [
      col('documento', 'Cédula', 'h.documento'),
      col('nombre', 'Servidor público', 'h.apellidos_nombres'),
      col('dependencia', 'Dependencia', 'h.dependencia'),
      col('cargo', 'Cargo', 'h.cargo', false),
      col('modalidad', 'Modalidad', 'h.modalidad'),
      col('inicio', 'Fecha de inicio', fechaColumna('h.fecha_inicio')),
      col('fin', 'Fecha de terminación', fechaColumna('h.fecha_fin')),
      col('resolucion', 'Resolución', 'h.numero_resolucion', false),
      col('estado', 'Estado', 'h.estado'),
      col('observaciones', 'Observaciones', 'h.observaciones', false),
    ],
    filtros: [
      documento('h.documento'),
      texto('nombre', 'Nombre', 'h.apellidos_nombres'),
      lista('dependencia', 'Dependencia', 'h.dependencia'),
      lista('cargo', 'Cargo', 'h.cargo'),
      lista('modalidad', 'Modalidad', 'h.modalidad'),
      lista('estado', 'Estado', 'h.estado'),
      texto('resolucion', 'Resolución', 'h.numero_resolucion'),
      fechas('inicio', 'Fecha de inicio', 'h.fecha_inicio'),
      fechas('fin', 'Fecha de terminación', 'h.fecha_fin'),
    ],
  },
  {
    id: 'novedades',
    nombre: 'Novedades para nómina',
    descripcion: 'Vacaciones, solicitudes y viáticos aprobados o finalizados. El sistema no guarda periodos ni conceptos de pago.',
    modulos: ['requests', 'admin-requests', 'viaticos'],
    from: `(
      SELECT 'Solicitud administrativa' AS origen, tipo AS concepto, dependencia, apellidos_nombres AS nombre, documento,
             fecha_inicio, fecha_fin, dias_solicitados AS dias, 0::numeric AS valor, estado
        FROM solicitudes_admin WHERE ${ESTADO_APROBADO}
      UNION ALL
      SELECT 'Vacaciones', 'Vacaciones', dependencia, apellidos_nombres, documento,
             fecha_ingreso, fecha_corte, (regexp_match(dias_totales, '\\d+'))[1]::int, 0::numeric, estado
        FROM vacaciones WHERE ${ESTADO_APROBADO}
      UNION ALL
      SELECT 'Viáticos', 'Viático y comisión de servicios', dependencia, apellidos_nombres, documento,
             fecha_inicio, fecha_fin, dias, COALESCE(valor_total, 0), estado
        FROM viaticos WHERE ${ESTADO_APROBADO}
    ) n`,
    orden: 'reporte_fecha(n.fecha_inicio) DESC NULLS LAST, n.nombre',
    columnas: [
      col('origen', 'Origen', 'n.origen'),
      col('concepto', 'Concepto', 'n.concepto'),
      col('documento', 'Cédula', 'n.documento'),
      col('nombre', 'Servidor público', 'n.nombre'),
      col('dependencia', 'Dependencia', 'n.dependencia'),
      col('inicio', 'Fecha de inicio', fechaTexto('n.fecha_inicio')),
      col('fin', 'Fecha de fin', fechaTexto('n.fecha_fin')),
      col('dias', 'Días', 'n.dias'),
      col('valor', 'Valor', 'n.valor'),
      col('estado', 'Estado', 'n.estado'),
    ],
    filtros: [
      lista('origen', 'Origen', 'n.origen', ['Solicitud administrativa', 'Vacaciones', 'Viáticos']),
      lista('concepto', 'Concepto', 'n.concepto'),
      documento('n.documento'),
      texto('nombre', 'Nombre', 'n.nombre'),
      lista('dependencia', 'Dependencia', 'n.dependencia'),
      lista('estado', 'Estado', 'n.estado'),
      fechas('inicio', 'Fecha de inicio', 'reporte_fecha(n.fecha_inicio)'),
    ],
  },
  {
    id: 'sst_emo',
    nombre: 'SST: exámenes médicos y perfil epidemiológico',
    descripcion: 'Exámenes ocupacionales, restricciones, accidentes y enfermedades laborales.',
    modulos: ['sst'],
    from: 'sst_perfil_epidemiologico se',
    orden: 'se.fecha_emo DESC NULLS LAST, se.id_epidemiologico DESC',
    columnas: [
      col('documento', 'Cédula', 'se.documento'),
      col('nombre', 'Servidor público', 'se.nombre_completo'),
      col('dependencia', 'Dependencia', 'se.dependencia'),
      col('cargo', 'Cargo', 'se.cargo', false),
      col('tipo_emo', 'Tipo de examen', 'se.tipo_emo'),
      col('fecha_emo', 'Fecha de examen', fechaColumna('se.fecha_emo')),
      col('proximo', 'Próximo examen', fechaColumna('se.fecha_proximo_emo')),
      col('restricciones', 'Restricciones', 'se.restricciones', false),
      col('accidente', 'Accidente de trabajo', 'se.accidente_trabajo'),
      col('enfermedad', 'Enfermedad laboral', 'se.enfermedad_laboral'),
      col('estado', 'Estado del caso', 'se.estado_final_caso'),
    ],
    filtros: [
      documento('se.documento'),
      texto('nombre', 'Nombre', 'se.nombre_completo'),
      lista('dependencia', 'Dependencia', 'se.dependencia'),
      lista('tipo_emo', 'Tipo de examen', 'se.tipo_emo'),
      lista('accidente', 'Accidente de trabajo', 'se.accidente_trabajo'),
      lista('enfermedad', 'Enfermedad laboral', 'se.enfermedad_laboral'),
      lista('estado', 'Estado del caso', 'se.estado_final_caso'),
      fechas('fecha_emo', 'Fecha de examen', 'se.fecha_emo'),
      fechas('proximo', 'Próximo examen', 'se.fecha_proximo_emo'),
    ],
  },
  {
    id: 'sst_epp',
    nombre: 'SST: entrega de elementos de protección',
    descripcion: 'Elementos entregados por servidor, dependencia y fecha.',
    modulos: ['sst'],
    from: 'sst_entrega_epp ep',
    orden: 'ep.fecha_entrega DESC, ep.id_entrega_epp DESC',
    columnas: [
      col('documento', 'Cédula', 'ep.documento'),
      col('nombre', 'Servidor público', 'ep.nombre_completo'),
      col('dependencia', 'Dependencia', 'ep.dependencia'),
      col('elemento', 'Elemento', 'ep.elemento_epp'),
      col('cantidad', 'Cantidad', 'ep.cantidad'),
      col('fecha', 'Fecha de entrega', fechaColumna('ep.fecha_entrega')),
      col('estado', 'Estado', 'ep.estado_entrega'),
    ],
    filtros: [
      documento('ep.documento'),
      texto('nombre', 'Nombre', 'ep.nombre_completo'),
      lista('dependencia', 'Dependencia', 'ep.dependencia'),
      lista('elemento', 'Elemento', 'ep.elemento_epp'),
      lista('estado', 'Estado', 'ep.estado_entrega'),
      fechas('fecha', 'Fecha de entrega', 'ep.fecha_entrega'),
    ],
  },
  {
    id: 'sst_socio',
    nombre: 'SST: perfil sociodemográfico',
    descripcion: 'Caracterización de la planta por vinculación, escolaridad y residencia.',
    modulos: ['sst'],
    from: 'sst_perfil_sociodemografico ss',
    orden: 'ss.nombre_completo, ss.id_sociodemografico',
    columnas: [
      col('documento', 'Cédula', 'ss.documento'),
      col('nombre', 'Servidor público', 'ss.nombre_completo'),
      col('dependencia', 'Dependencia', 'ss.dependencia'),
      col('sexo', 'Sexo', 'ss.sexo'),
      col('edad', 'Edad', 'ss.edad'),
      col('estado_civil', 'Estado civil', 'ss.estado_civil', false),
      col('escolaridad', 'Escolaridad', 'ss.escolaridad'),
      col('vinculacion', 'Tipo de vinculación', 'ss.tipo_vinculacion'),
      col('municipio', 'Municipio de residencia', 'ss.municipio_residencia', false),
    ],
    filtros: [
      documento('ss.documento'),
      texto('nombre', 'Nombre', 'ss.nombre_completo'),
      lista('dependencia', 'Dependencia', 'ss.dependencia'),
      lista('sexo', 'Sexo', 'ss.sexo'),
      lista('escolaridad', 'Escolaridad', 'ss.escolaridad'),
      lista('vinculacion', 'Tipo de vinculación', 'ss.tipo_vinculacion'),
      lista('municipio', 'Municipio de residencia', 'ss.municipio_residencia'),
      numero('edad', 'Edad', 'ss.edad'),
    ],
  },
  {
    id: 'documentos',
    nombre: 'Documentos del repositorio',
    descripcion: 'Documentos clasificados por servidor y tipo. No incluye tipos sensibles.',
    modulos: ['documents'],
    from: `documentos doc
      JOIN tipos_documento t ON t.id_tipo = doc.id_tipo`,
    filtroBase: `doc.eliminado_en IS NULL AND doc.estado = 'Clasificado' AND t.es_sensible = FALSE`,
    orden: 'doc.creado_en DESC, doc.id_documento DESC',
    columnas: [
      col('titulo', 'Título', 'doc.titulo'),
      col('cedula', 'Cédula', 'doc.cedula'),
      col('nombre', 'Servidor público', 'doc.nombre_servidor'),
      col('tipo', 'Tipo', 't.nombre'),
      col('categoria', 'Categoría', 't.categoria'),
      col('fecha', 'Fecha del documento', fechaColumna('doc.fecha_documento')),
      col('version', 'Versión', 'doc.version_actual'),
    ],
    filtros: [
      documento('doc.cedula'),
      texto('nombre', 'Nombre', 'doc.nombre_servidor'),
      texto('titulo', 'Título', 'doc.titulo'),
      lista('tipo', 'Tipo', 't.nombre'),
      lista('categoria', 'Categoría', 't.categoria'),
      fechas('fecha', 'Fecha del documento', 'doc.fecha_documento'),
    ],
  },
];

function getSource(id) {
  return SOURCES.find(s => s.id === id) || null;
}

/** Versión para el navegador: sin expresiones SQL. */
function describeSource(source) {
  return {
    id: source.id,
    nombre: source.nombre,
    descripcion: source.descripcion,
    columnas: source.columnas.map(({ key, label, porDefecto }) => ({ key, label, porDefecto })),
    filtros: source.filtros.map(({ key, label, tipo, opciones }) => ({ key, label, tipo, ...(opciones ? { opciones } : {}) })),
  };
}

module.exports = { SOURCES, getSource, describeSource };
