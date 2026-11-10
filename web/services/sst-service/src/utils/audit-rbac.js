/* ═══════════════════════════════════════════════════════════════════════════
   audit-rbac.js — Sistema Unificado de Control de Acceso por Módulo (RBAC),
   Gestión de Responsables, Historial/Trazabilidad Inmutable y Documentos
   Institucionales con Control de Versiones.
   Gobernación de Boyacá · Talento Humano 360
   ═══════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const VALID_MODULOS = [
  'permisos',
  'licencias',
  'incapacidades',
  'epidemiologico',
  'sociodemografico',
  'epp',
];

const SCHEMA_AUDIT_RBAC_SQL = `
  -- 1. Tabla administrable de Responsables por Submódulo (Sección 7)
  CREATE TABLE IF NOT EXISTS modulo_responsables (
    id_asignacion         SERIAL PRIMARY KEY,
    modulo                VARCHAR(60)  NOT NULL,
    username              VARCHAR(120) NOT NULL,
    nombre_responsable    VARCHAR(200) NOT NULL,
    cargo_responsable     VARCHAR(200) DEFAULT 'Profesional / Responsable de Módulo',
    correo_notificacion   VARCHAR(200),
    documento_responsable VARCHAR(60),
    activo                BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_aprobar         BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_importar        BOOLEAN      NOT NULL DEFAULT TRUE,
    puede_exportar        BOOLEAN      NOT NULL DEFAULT TRUE,
    asignado_por          VARCHAR(120) DEFAULT 'Sistema',
    actualizado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (modulo, username)
  );
  CREATE INDEX IF NOT EXISTS idx_mod_resp_modulo ON modulo_responsables(modulo);
  CREATE INDEX IF NOT EXISTS idx_mod_resp_user   ON modulo_responsables(LOWER(username));

  -- 2. Tabla Inmutable de Historial y Trazabilidad (Sección 8)
  -- Sin ON DELETE CASCADE para conservar la trazabilidad incluso tras eliminaciones
  CREATE TABLE IF NOT EXISTS auditoria_modulos (
    id_auditoria         SERIAL PRIMARY KEY,
    modulo               VARCHAR(60)  NOT NULL,
    id_registro          VARCHAR(80)  NOT NULL,
    radicado             VARCHAR(100),
    usuario_responsable  VARCHAR(160) NOT NULL,
    nombre_usuario       VARCHAR(200),
    rol_usuario          VARCHAR(80),
    tipo_operacion       VARCHAR(60)  NOT NULL,
    valores_anteriores   JSONB,
    valores_nuevos       JSONB,
    observaciones        TEXT,
    fecha_hora           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_aud_mod_modulo ON auditoria_modulos(modulo);
  CREATE INDEX IF NOT EXISTS idx_aud_mod_reg    ON auditoria_modulos(modulo, id_registro);
  CREATE INDEX IF NOT EXISTS idx_aud_mod_fecha  ON auditoria_modulos(fecha_hora DESC);
  CREATE INDEX IF NOT EXISTS idx_aud_mod_op     ON auditoria_modulos(tipo_operacion);

  -- 3. Gestión de Formatos y Documentos Institucionales (Sección 11)
  CREATE TABLE IF NOT EXISTS documentos_institucionales (
    id_documento         SERIAL PRIMARY KEY,
    modulo               VARCHAR(60)  NOT NULL,
    codigo_formato       VARCHAR(80),
    nombre               VARCHAR(255) NOT NULL,
    descripcion          TEXT,
    categoria            VARCHAR(100) DEFAULT 'Formato Institucional',
    version_actual       VARCHAR(30)  NOT NULL DEFAULT '1.0',
    nombre_archivo       VARCHAR(255) NOT NULL,
    tipo_mime            VARCHAR(120) NOT NULL,
    tamano_bytes         INTEGER      NOT NULL DEFAULT 0,
    contenido            BYTEA        NOT NULL,
    subido_por           VARCHAR(160) DEFAULT 'Sistema',
    fecha_carga          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo               BOOLEAN      NOT NULL DEFAULT TRUE
  );
  CREATE INDEX IF NOT EXISTS idx_doc_inst_modulo ON documentos_institucionales(modulo);

  CREATE TABLE IF NOT EXISTS documentos_institucionales_versiones (
    id_version           SERIAL PRIMARY KEY,
    id_documento         INTEGER      NOT NULL REFERENCES documentos_institucionales(id_documento) ON DELETE CASCADE,
    version              VARCHAR(30)  NOT NULL,
    nombre_archivo       VARCHAR(255) NOT NULL,
    tipo_mime            VARCHAR(120) NOT NULL,
    tamano_bytes         INTEGER      NOT NULL DEFAULT 0,
    contenido            BYTEA        NOT NULL,
    observacion_cambio   TEXT,
    subido_por           VARCHAR(160) DEFAULT 'Sistema',
    fecha_version        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_doc_ver_doc ON documentos_institucionales_versiones(id_documento);

  -- 4. Tabla de Inventario / Existencias de EPP (Sección 6.6)
  CREATE TABLE IF NOT EXISTS sst_inventario_epp (
    id_inventario        SERIAL PRIMARY KEY,
    codigo_elemento      VARCHAR(20)  UNIQUE NOT NULL,
    elemento_epp         VARCHAR(200) NOT NULL,
    categoria_epp        VARCHAR(120) DEFAULT 'Protección Personal',
    unidad_medida        VARCHAR(40)  DEFAULT 'UNIDAD',
    stock_total          INTEGER      NOT NULL DEFAULT 40,
    stock_minimo         INTEGER      NOT NULL DEFAULT 8,
    ubicacion_bodega     VARCHAR(160) DEFAULT 'Almacén SST - Casa de la Torre',
    observaciones        TEXT,
    actualizado_por      VARCHAR(120) DEFAULT 'Sistema',
    actualizado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const INITIAL_USERS = [
  {
    username: 'sandra.roa@boyaca.gov.co',
    password: 'Sandra@123',
    nombre: 'Sandra Roa',
    rol: 'SST',
    cargo_laboral: 'Responsable de Seguridad y Salud en el Trabajo (SST)',
  },
  {
    username: 'luis.sanches@boyaca.gov.co',
    password: 'Luis@456',
    nombre: 'Luis Sanchez',
    rol: 'Incapacidades',
    cargo_laboral: 'Responsable de Incapacidades y Ausentismo Laboral',
  },
  {
    username: 'luis.sanchez@boyaca.gov.co',
    password: 'Luis@456',
    nombre: 'Luis Sanchez',
    rol: 'Incapacidades',
    cargo_laboral: 'Responsable de Incapacidades y Ausentismo Laboral',
  },
  {
    username: 'alejandro.leon@boyaca.edu.co',
    password: 'Alejandro#123',
    nombre: 'Alejandro Leon',
    rol: 'Permisos',
    cargo_laboral: 'Responsable de Permisos Laborales',
  },
  {
    username: 'alejandro.leon@boyaca.gov.co',
    password: 'Alejandro#123',
    nombre: 'Alejandro Leon',
    rol: 'Permisos',
    cargo_laboral: 'Responsable de Permisos Laborales',
  },
  {
    username: 'sebastian.rincon@boyaca.gov.co',
    password: 'Sebastian#456',
    nombre: 'Sebastian Rincon',
    rol: 'Permisos y Licencias',
    cargo_laboral: 'Responsable de Permisos y Licencias Laborales',
  },
  {
    username: 'funcionario@boyaca.gov.co',
    password: 'funcionario123',
    nombre: 'Iván Darío Romero Marín',
    rol: 'Funcionario',
    cargo_laboral: 'Profesional Universitario',
  },
];

const INITIAL_RESPONSABLES = [
  // Sandra Roa -> Perfil Epidemiológico, Perfil Sociodemográfico y Entrega de EPP
  {
    modulo: 'epidemiologico',
    username: 'sandra.roa@boyaca.gov.co',
    nombre: 'Sandra Roa',
    cargo: 'Responsable de Seguridad y Salud en el Trabajo (SST)',
    correo: 'sandra.roa@boyaca.gov.co',
  },
  {
    modulo: 'sociodemografico',
    username: 'sandra.roa@boyaca.gov.co',
    nombre: 'Sandra Roa',
    cargo: 'Responsable de Seguridad y Salud en el Trabajo (SST)',
    correo: 'sandra.roa@boyaca.gov.co',
  },
  {
    modulo: 'epp',
    username: 'sandra.roa@boyaca.gov.co',
    nombre: 'Sandra Roa',
    cargo: 'Responsable de Seguridad y Salud en el Trabajo (SST)',
    correo: 'sandra.roa@boyaca.gov.co',
  },
  // Luis Sanchez -> Incapacidades
  {
    modulo: 'incapacidades',
    username: 'luis.sanches@boyaca.gov.co',
    nombre: 'Luis Sanchez',
    cargo: 'Responsable de Incapacidades y Ausentismo Laboral',
    correo: 'luis.sanches@boyaca.gov.co',
  },
  {
    modulo: 'incapacidades',
    username: 'luis.sanchez@boyaca.gov.co',
    nombre: 'Luis Sanchez',
    cargo: 'Responsable de Incapacidades y Ausentismo Laboral',
    correo: 'luis.sanchez@boyaca.gov.co',
  },
  // Sebastian Rincon -> Permisos y Licencias
  {
    modulo: 'permisos',
    username: 'sebastian.rincon@boyaca.gov.co',
    nombre: 'Sebastian Rincon',
    cargo: 'Responsable de Permisos y Licencias Laborales',
    correo: 'sebastian.rincon@boyaca.gov.co',
  },
  {
    modulo: 'licencias',
    username: 'sebastian.rincon@boyaca.gov.co',
    nombre: 'Sebastian Rincon',
    cargo: 'Responsable de Permisos y Licencias Laborales',
    correo: 'sebastian.rincon@boyaca.gov.co',
  },
  // Alejandro Leon -> Permisos
  {
    modulo: 'permisos',
    username: 'alejandro.leon@boyaca.edu.co',
    nombre: 'Alejandro Leon',
    cargo: 'Responsable de Permisos Laborales',
    correo: 'alejandro.leon@boyaca.edu.co',
  },
  {
    modulo: 'permisos',
    username: 'alejandro.leon@boyaca.gov.co',
    nombre: 'Alejandro Leon',
    cargo: 'Responsable de Permisos Laborales',
    correo: 'alejandro.leon@boyaca.gov.co',
  },
];

const EPP_INITIAL_STOCK = [
  { codigo: 'A',  nombre: 'A. Casco de seguridad', cat: 'Protección Cabeza', stock: 45, min: 10 },
  { codigo: 'B',  nombre: 'B. Gorro o Cofias', cat: 'Protección Cabeza', stock: 120, min: 20 },
  { codigo: 'C',  nombre: 'C. Gorro Zafari', cat: 'Protección Cabeza', stock: 30, min: 8 },
  { codigo: 'D',  nombre: 'D. Tapones externos', cat: 'Protección Auditiva', stock: 80, min: 15 },
  { codigo: 'E',  nombre: 'E. Tapones de copa (orejeras)', cat: 'Protección Auditiva', stock: 25, min: 6 },
  { codigo: 'F',  nombre: 'F. Careta (guadañar)', cat: 'Protección Facial', stock: 18, min: 5 },
  { codigo: 'G',  nombre: 'G. Monogafas', cat: 'Protección Visual', stock: 40, min: 10 },
  { codigo: 'H',  nombre: 'H. Gafas de seguridad', cat: 'Protección Visual', stock: 50, min: 10 },
  { codigo: 'I',  nombre: 'I. Gafas de seguridad / UV', cat: 'Protección Visual', stock: 35, min: 8 },
  { codigo: 'J',  nombre: 'J. Respirador con filtros', cat: 'Protección Respiratoria', stock: 20, min: 5 },
  { codigo: 'K',  nombre: 'K. Filtros para respiradores', cat: 'Protección Respiratoria', stock: 40, min: 10 },
  { codigo: 'L',  nombre: 'L. Respirador ffp2 o n95', cat: 'Protección Respiratoria', stock: 150, min: 30 },
  { codigo: 'M',  nombre: 'M. Mascarilla desechable', cat: 'Protección Respiratoria', stock: 200, min: 40 },
  { codigo: 'N',  nombre: 'N. Guantes de poliuretano', cat: 'Protección Manos', stock: 60, min: 12 },
  { codigo: 'O',  nombre: 'O. Guantes de vaqueta', cat: 'Protección Manos', stock: 45, min: 10 },
  { codigo: 'P',  nombre: 'P. Guantes de Nitrilo', cat: 'Protección Manos', stock: 100, min: 20 },
  { codigo: 'Q',  nombre: 'Q. Guantes de látex', cat: 'Protección Manos', stock: 90, min: 20 },
  { codigo: 'R',  nombre: 'R. Guantes de caucho', cat: 'Protección Manos', stock: 50, min: 10 },
  { codigo: 'S',  nombre: 'S. Guantes sustancias químicas', cat: 'Protección Manos', stock: 25, min: 6 },
  { codigo: 'T',  nombre: 'T. Chaleco Trabajo en campo', cat: 'Ropa de Trabajo', stock: 55, min: 10 },
  { codigo: 'U',  nombre: 'U. Overol de dos piezas cinta reflectiva', cat: 'Ropa de Trabajo', stock: 30, min: 8 },
  { codigo: 'V',  nombre: 'V. Overol antifluidos', cat: 'Ropa de Trabajo', stock: 35, min: 8 },
  { codigo: 'W',  nombre: 'W. Bata manga larga antifluido', cat: 'Ropa de Trabajo', stock: 40, min: 10 },
  { codigo: 'X',  nombre: 'X. Delantal Carnaza', cat: 'Ropa de Trabajo', stock: 15, min: 5 },
  { codigo: 'Y',  nombre: 'Y. Zapato cerrado', cat: 'Calzado de Seguridad', stock: 30, min: 8 },
  { codigo: 'Z',  nombre: 'Z. Botas de Seguridad', cat: 'Calzado de Seguridad', stock: 40, min: 10 },
  { codigo: 'AA', nombre: 'AA. Botas pantaneras con puntera', cat: 'Calzado de Seguridad', stock: 25, min: 6 },
  { codigo: 'AB', nombre: 'AB. Otros', cat: 'Otros Elementos', stock: 20, min: 5 },
];

const INITIAL_DOCS = [
  {
    modulo: 'permisos',
    codigo: 'E-DO-TH-F-001',
    nombre: 'Formato e Instructivo Institucional de Solicitud de Permisos Laborales',
    descripcion: 'Guía oficial y formato institucional para la solicitud, justificación, visto bueno del jefe inmediato y soportes de permisos remunerados por horas o días en la Gobernación de Boyacá.',
    categoria: 'Formato Institucional',
    version: '2.0',
    archivo: 'Instructivo_Oficial_Permisos_Laborales_Boyaca.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL',
      'DIRECCIÓN GENERAL DE TALENTO HUMANO',
      'DOCUMENTO INSTITUCIONAL: SOLICITUD Y GESTIÓN DE PERMISOS LABORALES (E-DO-TH-F-001 V2.0)',
      '====================================================================================',
      '',
      '1. OBJETIVO:',
      'Establecer los lineamientos oficiales para la radicación, validación de soportes y aprobación de permisos laborales remunerados hasta por tres (3) días hábiles conforme al Decreto 1083 de 2015.',
      '',
      '2. MODALIDADES DE PERMISO:',
      '- Permiso por Horas: Dentro de la jornada laboral (mañana o tarde), indicando hora exacta de salida y retorno.',
      '- Permiso por 1 Día: Jornada completa o medio día.',
      '- Permiso por Varios Días: Hasta máximo 3 días hábiles remunerados cuando medie justa causa.',
      '',
      '3. REQUISITOS Y SOPORTES:',
      '- Cita o atención médica: Adjuntar citación o constancia de asistencia de la EPS.',
      '- Calamidad doméstica: Adjuntar soporte sumario del hecho sobreviniente.',
      '- Estímulos e incentivos (Cumpleaños, Día de la Familia, Jurado de Votación, Sufragante): Adjuntar certificado electoral o soporte aplicable.',
      '',
      '4. VISTO BUENO Y APROBACIÓN:',
      'Toda solicitud notifica automáticamente al jefe inmediato registrado y es verificada por los responsables asignados del módulo de Permisos Laborales.'
    ].join('\r\n')
  },
  {
    modulo: 'licencias',
    codigo: 'E-DO-TH-G-002',
    nombre: 'Guía Normativa y Requisitos de Licencias Laborales (Remuneradas y No Remuneradas)',
    descripcion: 'Compendio normativo y lista de chequeo de soportes obligatorios para Licencias de Luto, Maternidad, Paternidad, Ley Camila, Ordinaria, Deportiva y Docencia Universitaria.',
    categoria: 'Normativa / Reglamento',
    version: '1.0',
    archivo: 'Guia_Normativa_Licencias_Laborales_Boyaca.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SECRETARÍA GENERAL',
      'DIRECCIÓN GENERAL DE TALENTO HUMANO',
      'GUÍA NORMATIVA DE LICENCIAS LABORALES (E-DO-TH-G-002 V1.0)',
      '====================================================================================',
      '',
      '1. LICENCIA POR LUTO (Ley 1280 de 2009 / Decreto 1083 de 2015):',
      '- Duración: Cinco (5) días hábiles remunerados.',
      '- Soportes: Registro civil de defunción + documento que acredite parentesco hasta 2° grado de consanguinidad, 1° de afinidad o 1° civil.',
      '',
      '2. LICENCIA DE MATERNIDAD (Ley 1822 de 2017 / Ley 2114 de 2021):',
      '- Duración: Dieciocho (18) semanas (126 días calendario).',
      '- Soportes: Certificado de nacido vivo, registro civil de nacimiento y certificado médico de la EPS.',
      '',
      '3. LICENCIA DE PATERNIDAD (Ley 2114 de 2021):',
      '- Duración: Dos (2) semanas (14 días calendario).',
      '- Soportes: Registro civil de nacimiento presentado dentro de los 30 días siguientes al nacimiento.',
      '',
      '4. LICENCIA ORDINARIA NO REMUNERADA (Decreto 1083 de 2015, Art. 2.2.5.5.5):',
      '- Duración: Hasta 60 días hábiles al año, prorrogables por 30 días más.',
      '- Soportes: Solicitud formal motivada dirigida al nominador / Dirección de Talento Humano.'
    ].join('\r\n')
  },
  {
    modulo: 'incapacidades',
    codigo: 'E-DO-ST-F-002',
    nombre: 'Protocolo Institucional de Radicación y Transcripción de Incapacidades Médicas',
    descripcion: 'Lineamientos de la Subdirección de Seguridad y Salud en el Trabajo para el reporte, validación CIE-10, prórrogas y liquidación de auxilio por incapacidad médica.',
    categoria: 'Protocolo SST',
    version: '2.0',
    archivo: 'Protocolo_Radicacion_Incapacidades_E_DO_ST_F_002.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO',
      'PROTOCOLO DE RADICACIÓN Y GESTIÓN DE INCAPACIDADES MÉDICAS (E-DO-ST-F-002 V2.0)',
      '====================================================================================',
      '',
      '1. REQUISITOS DEL CERTIFICADO DE INCAPACIDAD:',
      '- Certificado original expedido o transcrito por la EPS o ARL tratante.',
      '- Fecha de inicio, fecha de finalización, número de días, código diagnóstico CIE-10 y origen de la contingencia.',
      '',
      '2. DISTRIBUCIÓN LEGAL DEL RECONOCIMIENTO:',
      '- Enfermedad General (Días 1 y 2): Reconocimiento a cargo de la Entidad.',
      '- Enfermedad General (Día 3 al 90): Auxilio económico del 66.67% a cargo de la EPS.',
      '- Accidente de Trabajo / Enfermedad Laboral / Maternidad / Paternidad: Reconocimiento del 100% según normativa vigente.',
      '',
      '3. CONFIDENCIALIDAD (LEY 1581 DE 2012):',
      'La historia clínica y el diagnóstico CIE-10 son datos sensibles sujetos a reserva legal.'
    ].join('\r\n')
  },
  {
    modulo: 'epidemiologico',
    codigo: 'E-DO-ST-F-024',
    nombre: 'Lineamientos de Exámenes Médicos Ocupacionales (EMO) y Programas PVE',
    descripcion: 'Documento técnico del Sistema de Gestión SST para evaluaciones médicas de ingreso, periódicas, egreso, post-incapacidad y seguimiento en Programas de Vigilancia Epidemiológica.',
    categoria: 'Protocolo SST',
    version: '3.0',
    archivo: 'Lineamientos_EMO_y_Vigilancia_Epidemiologica_E_DO_ST_F_024.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO',
      'LINEAMIENTOS DE VIGILANCIA EPIDEMIOLÓGICA Y EMO (CÓDIGO E-DO-ST-F-024 V3.0)',
      '====================================================================================',
      '',
      '1. TIPOS DE EVALUACIÓN MÉDICA OCUPACIONAL (Resolución 2346 de 2007):',
      '- Examen de Ingreso, Examen Periódico Anual, Examen de Egreso, Post-Incapacidad y Trabajo en Alturas.',
      '',
      '2. PROGRAMAS DE VIGILANCIA EPIDEMIOLÓGICA (PVE):',
      '- PVE Biomecánico / Osteomuscular, Psicosocial, Visual, Auditivo, Cardiovascular y Metabólico, Respiratorio y Voz.',
      '',
      '3. PROTECCIÓN DE DATOS MÉDICOS SENSIBLES (Ley 1581 de 2012):',
      'El acceso a perfiles individuales está restringido exclusivamente al responsable de SST y administración autorizada. Los tableros generales presentan información agregada y anonimizada.'
    ].join('\r\n')
  },
  {
    modulo: 'sociodemografico',
    codigo: 'E-DO-ST-F-011',
    nombre: 'Instructivo de Caracterización del Perfil Sociodemográfico de la Población Trabajadora',
    descripcion: 'Guía institucional para la actualización anual de variables demográficas, educativas, familiares y laborales conforme al Decreto 1072 de 2015 (SG-SST).',
    categoria: 'Instructivo / Guía',
    version: '5.0',
    archivo: 'Instructivo_Perfil_Sociodemografico_E_DO_ST_F_011_V5.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO',
      'INSTRUCTIVO DE PERFIL SOCIODEMOGRÁFICO (CÓDIGO E-DO-ST-F-011 VERSIÓN 5.0)',
      '====================================================================================',
      '',
      '1. PROPÓSITO:',
      'Consolidar la descripción sociodemográfica de los servidores públicos y contratistas de la Gobernación de Boyacá como insumo obligatorio del SG-SST (Decreto 1072 de 2015, Art. 2.2.4.6.12).',
      '',
      '2. VARIABLES CARACTERIZADAS (24 CAMPOS OFICIALES):',
      '- Identificación, apellidos y nombres, sexo, año de nacimiento, edad, pertenencia étnica, estado civil, composición familiar, vivienda, estrato, municipio de residencia y trabajo, escolaridad, profesión, ingresos, cargo, vinculación, antigüedad, dependencia y sede.'
    ].join('\r\n')
  },
  {
    modulo: 'epp',
    codigo: 'E-DO-ST-F-028',
    nombre: 'Instructivo para Suministro, Uso, Reposición y Entrega de EPP (E-DO-ST-I-007)',
    descripcion: 'Matriz técnica y formato oficial E-DO-ST-F-028 V4 para la entrega, registro de firma y control de existencias de los 28 Elementos de Protección Personal (A–AB).',
    categoria: 'Instructivo / Guía',
    version: '4.0',
    archivo: 'Instructivo_Entrega_EPP_E_DO_ST_F_028_V4.txt',
    mime: 'text/plain; charset=utf-8',
    texto: [
      'GOBERNACIÓN DE BOYACÁ — SUBDIRECCIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO',
      'INSTRUCTIVO Y FORMATO DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL (E-DO-ST-F-028 V4.0)',
      '====================================================================================',
      '',
      '1. CATÁLOGO OFICIAL DE ELEMENTOS (CÓDIGOS A - AB):',
      'A. Casco de seguridad | B. Gorro o Cofias | C. Gorro Zafari | D. Tapones externos | E. Tapones de copa | F. Careta | G. Monogafas | H. Gafas de seguridad | I. Gafas UV | J. Respirador con filtros | K. Filtros | L. Respirador N95 | M. Mascarilla | N-S. Guantes | T. Chaleco | U-V. Overoles | W. Bata | X. Delantal | Y-AA. Calzado y Botas | AB. Otros.',
      '',
      '2. VERIFICACIÓN Y TRAZABILIDAD:',
      'Toda entrega registra elemento, talla, cantidad, fecha de entrega, restricciones asociadas y firma del servidor público.'
    ].join('\r\n')
  }
];

let initPromise = null;

async function ensureAuditAndRbacSchema(pool) {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(SCHEMA_AUDIT_RBAC_SQL);

      // 1. Sembrar y sincronizar usuarios iniciales de responsables por módulo
      for (const u of INITIAL_USERS) {
        try {
          await pool.query(
            `INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVO')
             ON CONFLICT (username) DO UPDATE SET
               password = EXCLUDED.password,
               nombre = EXCLUDED.nombre,
               rol = EXCLUDED.rol,
               cargo_laboral = EXCLUDED.cargo_laboral,
               estado = 'ACTIVO'`,
            [u.username, u.password, u.nombre, u.rol, u.cargo_laboral]
          );
        } catch (_) {
          // Ignorar si la tabla usuarios aún se está creando en otro contenedor
        }
      }

      // 2. Sembrar asignaciones iniciales de responsables por módulo
      for (const r of INITIAL_RESPONSABLES) {
        await pool.query(
          `INSERT INTO modulo_responsables (modulo, username, nombre_responsable, cargo_responsable, correo_notificacion, activo)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (modulo, username) DO UPDATE SET
             nombre_responsable = EXCLUDED.nombre_responsable,
             cargo_responsable = EXCLUDED.cargo_responsable,
             correo_notificacion = EXCLUDED.correo_notificacion,
             activo = TRUE`,
          [r.modulo, r.username, r.nombre, r.cargo, r.correo]
        );
      }

      // 3. Sembrar inventario inicial de los 28 elementos EPP si no existen
      for (const item of EPP_INITIAL_STOCK) {
        await pool.query(
          `INSERT INTO sst_inventario_epp (codigo_elemento, elemento_epp, categoria_epp, unidad_medida, stock_total, stock_minimo)
           VALUES ($1, $2, $3, 'UNIDAD', $4, $5)
           ON CONFLICT (codigo_elemento) DO NOTHING`,
          [item.codigo, item.nombre, item.cat, item.stock, item.min]
        );
      }

      // 4. Sembrar documentos institucionales iniciales si la tabla está vacía
      const docCount = await pool.query('SELECT COUNT(*)::int AS n FROM documentos_institucionales');
      if ((docCount.rows[0]?.n || 0) === 0) {
        for (const doc of INITIAL_DOCS) {
          const buf = Buffer.from(doc.texto, 'utf8');
          const ins = await pool.query(
            `INSERT INTO documentos_institucionales
               (modulo, codigo_formato, nombre, descripcion, categoria, version_actual, nombre_archivo, tipo_mime, tamano_bytes, contenido, subido_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Subdirección SST / Talento Humano')
             RETURNING id_documento`,
            [doc.modulo, doc.codigo, doc.nombre, doc.descripcion, doc.categoria, doc.version, doc.archivo, doc.mime, buf.length, buf]
          );
          const idDoc = ins.rows[0].id_documento;
          await pool.query(
            `INSERT INTO documentos_institucionales_versiones
               (id_documento, version, nombre_archivo, tipo_mime, tamano_bytes, contenido, observacion_cambio, subido_por)
             VALUES ($1,$2,$3,$4,$5,$6,'Versión inicial institucional publicada','Subdirección SST / Talento Humano')`,
            [idDoc, doc.version, doc.archivo, doc.mime, buf.length, buf]
          );
        }
      }
    })().catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

// ─── Verificación de Permisos por Rol y Módulo (RBAC - Sección 7) ────────────

function isAdminUser(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const uname = String(user.username || '').toLowerCase();
  return role.includes('administrador') || uname === 'admin@boyaca.gov.co' || uname === 'angela.ussa@boyaca.gov.co';
}

async function getModulePermission(pool, user, modulo) {
  if (!user) {
    return { isAdmin: false, isResponsable: false, canManage: false, canApprove: false, canImport: false, canExport: false, roleType: 'Invitado' };
  }

  if (isAdminUser(user)) {
    return {
      isAdmin: true,
      isResponsable: true,
      canManage: true,
      canApprove: true,
      canImport: true,
      canExport: true,
      roleType: 'Administrador',
    };
  }

  const uname = String(user.username || '').trim().toLowerCase();
  const unamePrefix = uname.split('@')[0];
  const fullName = String(user.name || '').trim().toLowerCase();

  const { rows } = await pool.query(
    `SELECT * FROM modulo_responsables
      WHERE modulo = $1
        AND activo = TRUE
        AND (
          LOWER(username) = $2
          OR LOWER(SPLIT_PART(username, '@', 1)) = $3
          OR LOWER(nombre_responsable) = $4
        )
      LIMIT 1`,
    [modulo, uname, unamePrefix, fullName]
  );

  if (rows.length > 0) {
    const r = rows[0];
    return {
      isAdmin: false,
      isResponsable: true,
      canManage: true,
      canApprove: Boolean(r.puede_aprobar),
      canImport: Boolean(r.puede_importar),
      canExport: Boolean(r.puede_exportar),
      roleType: 'Responsable del módulo',
      asignacion: r,
    };
  }

  // Compatibilidad por rol directo y cuenta Coordinador general
  const role = String(user.role || '').trim().toLowerCase();
  const isRoleMatch =
    (modulo === 'epidemiologico' && (role === 'sst' || role.includes('sst') || uname.startsWith('sandra.roa'))) ||
    (modulo === 'sociodemografico' && (role === 'sst' || role.includes('sst') || uname.startsWith('sandra.roa'))) ||
    (modulo === 'epp' && (role === 'sst' || role.includes('sst') || uname.startsWith('sandra.roa'))) ||
    (modulo === 'incapacidades' && (role === 'incapacidades' || role.includes('incapacidad') || uname.startsWith('luis.sanch'))) ||
    (modulo === 'permisos' && (role === 'permisos' || role === 'permisos y licencias' || role.includes('permiso') || uname.startsWith('alejandro.leon') || uname.startsWith('sebastian.rincon'))) ||
    (modulo === 'licencias' && (role === 'permisos y licencias' || role.includes('licencia') || uname.startsWith('sebastian.rincon'))) ||
    (role.includes('coordinador') && uname === 'carlos@boyaca.gov.co');

  if (isRoleMatch) {
    return {
      isAdmin: false,
      isResponsable: true,
      canManage: true,
      canApprove: true,
      canImport: true,
      canExport: true,
      roleType: 'Responsable del módulo',
    };
  }

  return {
    isAdmin: false,
    isResponsable: false,
    canManage: false,
    canApprove: false,
    canImport: false,
    canExport: false,
    roleType: 'Funcionario',
  };
}

/**
 * Impide que un usuario apruebe o rechace su propia solicitud cuando no sea otro responsable/admin.
 */
function isSelfRequest(user, record) {
  if (!user || !record) return false;
  const uname = String(user.username || '').trim().toLowerCase();
  const unamePrefix = uname.split('@')[0];
  const fullName = String(user.name || '').trim().toLowerCase();

  const recEmail = String(record.correo_solicitante || record.correoSolicitante || '').trim().toLowerCase();
  const recEmailPrefix = recEmail ? recEmail.split('@')[0] : '';
  const recPerson = String(record.apellidos_nombres || record.persona || record.nombre_completo || '').trim().toLowerCase();
  const recDoc = String(record.documento || '').trim();
  const userDoc = String(user.documento || '').trim();

  if (userDoc && recDoc && userDoc === recDoc) return true;
  if (recEmail && (recEmail === uname || (recEmailPrefix && recEmailPrefix === unamePrefix))) return true;
  if (fullName && recPerson && (recPerson === fullName)) return true;
  return false;
}

// ─── Registro de Auditoría y Trazabilidad Inmutable (Sección 8) ──────────────

async function logAudit(dbOrClient, {
  modulo,
  idRegistro,
  radicado = null,
  user = {},
  tipoOperacion,
  valoresAnteriores = null,
  valoresNuevos = null,
  observaciones = '',
}) {
  try {
    const usuarioResponsable = user.username || user.name || 'Sistema';
    const nombreUsuario = user.name || user.username || 'Sistema';
    const rolUsuario = user.role || 'Usuario';

    await dbOrClient.query(
      `INSERT INTO auditoria_modulos
         (modulo, id_registro, radicado, usuario_responsable, nombre_usuario, rol_usuario, tipo_operacion, valores_anteriores, valores_nuevos, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        modulo,
        String(idRegistro ?? 'N/A'),
        radicado,
        usuarioResponsable,
        nombreUsuario,
        rolUsuario,
        tipoOperacion,
        valoresAnteriores ? JSON.stringify(valoresAnteriores) : null,
        valoresNuevos ? JSON.stringify(valoresNuevos) : null,
        observaciones || '',
      ]
    );
  } catch (err) {
    console.error('[audit-rbac] Error registrando auditoría:', err.message);
  }
}

// ─── Rutas Compartidas de Auditoría, Responsables y Documentos Institucionales ─

function mountGovernanceRoutes(router, pool, authMiddleware) {
  // 1. Consultar permisos del usuario actual y lista de responsables por módulo
  router.get('/governance/permissions', authMiddleware, async (req, res) => {
    try {
      const { modulo = '' } = req.query;
      const modList = modulo ? [modulo] : VALID_MODULOS;
      const permissions = {};
      for (const m of modList) {
        permissions[m] = await getModulePermission(pool, req.user, m);
      }
      const respRows = await pool.query(
        `SELECT id_asignacion, modulo, username, nombre_responsable, cargo_responsable,
                correo_notificacion, documento_responsable, activo, puede_aprobar, puede_importar, puede_exportar,
                asignado_por, actualizado_en
           FROM modulo_responsables
          ORDER BY modulo, nombre_responsable`
      );
      res.json({
        user: req.user,
        isAdmin: isAdminUser(req.user),
        permissions,
        responsables: respRows.rows,
      });
    } catch (err) {
      console.error('[governance/permissions] error:', err.message);
      res.status(500).json({ error: 'Error al consultar permisos y responsables.' });
    }
  });

  // 2. Listar usuarios disponibles para asignar como responsables (Solo Admin)
  router.get('/governance/users', authMiddleware, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id_usuario, username, nombre, rol, cargo_laboral, estado
           FROM usuarios
          WHERE UPPER(COALESCE(estado, 'ACTIVO')) = 'ACTIVO'
          ORDER BY nombre`
      );
      res.json({ data: r.rows });
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar usuarios del sistema.' });
    }
  });

  // 3. Crear o actualizar asignación de responsable de un módulo (Solo Administrador)
  router.post('/governance/responsables', authMiddleware, async (req, res) => {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Solo el Administrador puede gestionar las asignaciones de responsables por módulo.' });
    }
    const {
      modulo,
      username,
      nombreResponsable,
      cargoResponsable,
      correoNotificacion,
      documentoResponsable,
      activo = true,
      puedeAprobar = true,
      puedeImportar = true,
      puedeExportar = true,
      crearUsuarioSiNoExiste = true,
      passwordInicial = 'Boyaca2026*',
    } = req.body;

    if (!modulo || !VALID_MODULOS.includes(modulo)) {
      return res.status(400).json({ error: `Módulo inválido. Valores permitidos: ${VALID_MODULOS.join(', ')}` });
    }
    if (!username || !nombreResponsable) {
      return res.status(400).json({ error: 'El usuario (correo/username) y el nombre del responsable son obligatorios.' });
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanName = String(nombreResponsable).trim();

    try {
      if (crearUsuarioSiNoExiste) {
        await pool.query(
          `INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado)
           VALUES ($1, $2, $3, 'Responsable Módulo', $4, 'ACTIVO')
           ON CONFLICT (username) DO NOTHING`,
          [cleanUser, passwordInicial, cleanName, cargoResponsable || 'Responsable de Módulo']
        );
      }

      const prev = await pool.query(
        'SELECT * FROM modulo_responsables WHERE modulo = $1 AND LOWER(username) = $2',
        [modulo, cleanUser]
      );

      const ins = await pool.query(
        `INSERT INTO modulo_responsables
           (modulo, username, nombre_responsable, cargo_responsable, correo_notificacion, documento_responsable,
            activo, puede_aprobar, puede_importar, puede_exportar, asignado_por, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)
         ON CONFLICT (modulo, username) DO UPDATE SET
           nombre_responsable = EXCLUDED.nombre_responsable,
           cargo_responsable = EXCLUDED.cargo_responsable,
           correo_notificacion = EXCLUDED.correo_notificacion,
           documento_responsable = EXCLUDED.documento_responsable,
           activo = EXCLUDED.activo,
           puede_aprobar = EXCLUDED.puede_aprobar,
           puede_importar = EXCLUDED.puede_importar,
           puede_exportar = EXCLUDED.puede_exportar,
           asignado_por = EXCLUDED.asignado_por,
           actualizado_en = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          modulo,
          cleanUser,
          cleanName,
          cargoResponsable || 'Responsable de Módulo',
          correoNotificacion || cleanUser,
          documentoResponsable || null,
          Boolean(activo),
          Boolean(puedeAprobar),
          Boolean(puedeImportar),
          Boolean(puedeExportar),
          req.user.username || 'admin',
        ]
      );

      await logAudit(pool, {
        modulo,
        idRegistro: ins.rows[0].id_asignacion,
        radicado: `RESP-${modulo.toUpperCase()}`,
        user: req.user,
        tipoOperacion: prev.rows.length ? 'MODIFICACION' : 'CREACION',
        valoresAnteriores: prev.rows[0] || null,
        valoresNuevos: ins.rows[0],
        observaciones: `Asignación de responsable administrativo (${cleanName}) en el módulo ${modulo}`,
      });

      res.json({ message: 'Responsable de módulo actualizado correctamente.', data: ins.rows[0] });
    } catch (err) {
      console.error('[governance/responsables] error:', err.message);
      res.status(500).json({ error: 'Error al guardar responsable del módulo.' });
    }
  });

  // 4. Eliminar / desactivar responsable de un módulo (Solo Administrador)
  router.delete('/governance/responsables/:id', authMiddleware, async (req, res) => {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Solo el Administrador puede modificar responsables de módulo.' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    try {
      const prev = await pool.query('SELECT * FROM modulo_responsables WHERE id_asignacion = $1', [id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'Asignación no encontrada.' });

      await pool.query('DELETE FROM modulo_responsables WHERE id_asignacion = $1', [id]);

      await logAudit(pool, {
        modulo: prev.rows[0].modulo,
        idRegistro: id,
        radicado: `RESP-${prev.rows[0].modulo.toUpperCase()}`,
        user: req.user,
        tipoOperacion: 'ELIMINACION',
        valoresAnteriores: prev.rows[0],
        valoresNuevos: null,
        observaciones: `Remoción de responsable (${prev.rows[0].nombre_responsable}) del módulo ${prev.rows[0].modulo}`,
      });

      res.json({ message: 'Asignación de responsable eliminada.' });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar asignación.' });
    }
  });

  // 5. Consultar Historial y Trazabilidad de Auditoría (Sección 8)
  router.get('/governance/auditoria', authMiddleware, async (req, res) => {
    try {
      const {
        modulo = '',
        idRegistro = '',
        tipoOperacion = '',
        usuario = '',
        fechaInicio = '',
        fechaFin = '',
        q = '',
        page = 1,
        limit = 50,
      } = req.query;

      // Validar permisos: Admin o Responsable del módulo ven toda la auditoría del módulo;
      // Funcionario solo ve eventos asociados a sus propios registros.
      let perm = { isAdmin: isAdminUser(req.user), isResponsable: false };
      if (modulo && VALID_MODULOS.includes(modulo)) {
        perm = await getModulePermission(pool, req.user, modulo);
      }

      const conds = ['1=1'];
      const params = [];
      let idx = 1;

      if (modulo && modulo !== 'Todos') {
        conds.push(`modulo = $${idx++}`);
        params.push(modulo);
      }
      if (idRegistro) {
        conds.push(`id_registro = $${idx++}`);
        params.push(String(idRegistro));
      }
      if (tipoOperacion && tipoOperacion !== 'Todas') {
        conds.push(`tipo_operacion = $${idx++}`);
        params.push(tipoOperacion);
      }
      if (usuario) {
        conds.push(`(LOWER(usuario_responsable) LIKE LOWER($${idx}) OR LOWER(nombre_usuario) LIKE LOWER($${idx}))`);
        params.push(`%${usuario}%`);
        idx++;
      }
      if (fechaInicio) {
        conds.push(`fecha_hora >= $${idx++}:: date`);
        params.push(fechaInicio);
      }
      if (fechaFin) {
        conds.push(`fecha_hora < ($${idx++}::date + INTERVAL '1 day')`);
        params.push(fechaFin);
      }
      if (q) {
        conds.push(`(LOWER(COALESCE(radicado,'')) LIKE LOWER($${idx}) OR LOWER(COALESCE(observaciones,'')) LIKE LOWER($${idx}) OR LOWER(usuario_responsable) LIKE LOWER($${idx}) OR id_registro LIKE $${idx})`);
        params.push(`%${q}%`);
        idx++;
      }

      if (!perm.isAdmin && !perm.isResponsable) {
        const uname = String(req.user.username || '').toLowerCase();
        const fullName = String(req.user.name || '').toLowerCase();
        conds.push(`(LOWER(usuario_responsable) = $${idx} OR LOWER(COALESCE(valores_nuevos->>'documento','')) = $${idx+1} OR LOWER(COALESCE(valores_nuevos->>'persona','')) = $${idx+2} OR LOWER(COALESCE(valores_nuevos->>'nombre_completo','')) = $${idx+2})`);
        params.push(uname, String(req.user.documento || ''), fullName);
        idx += 3;
      }

      const where = conds.join(' AND ');
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM auditoria_modulos WHERE ${where}`, params);
      const total = countRes.rows[0]?.total || 0;

      const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const off = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;
      params.push(lim, off);

      const rows = await pool.query(
        `SELECT id_auditoria, modulo, id_registro, radicado, usuario_responsable, nombre_usuario,
                rol_usuario, tipo_operacion, valores_anteriores, valores_nuevos, observaciones, fecha_hora
           FROM auditoria_modulos
          WHERE ${where}
          ORDER BY fecha_hora DESC, id_auditoria DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      );

      res.json({
        data: rows.rows,
        total,
        page: parseInt(page, 10) || 1,
        totalPages: Math.max(1, Math.ceil(total / lim)),
      });
    } catch (err) {
      console.error('[governance/auditoria] error:', err.message);
      res.status(500).json({ error: 'Error al consultar el historial de auditoría.' });
    }
  });

  // ─── 6. Gestión de Formatos y Documentos Institucionales (Sección 11) ──────

  // Listar documentos institucionales por módulo
  router.get('/governance/documentos', authMiddleware, async (req, res) => {
    try {
      const { modulo = '' } = req.query;
      const conds = ['d.activo = TRUE'];
      const params = [];
      if (modulo && modulo !== 'Todos') {
        conds.push('d.modulo = $1');
        params.push(modulo);
      }
      const r = await pool.query(
        `SELECT d.id_documento, d.modulo, d.codigo_formato, d.nombre, d.descripcion, d.categoria,
                d.version_actual, d.nombre_archivo, d.tipo_mime, d.tamano_bytes, d.subido_por,
                d.fecha_carga, d.fecha_actualizacion,
                (SELECT COUNT(*)::int FROM documentos_institucionales_versiones v WHERE v.id_documento = d.id_documento) AS total_versiones
           FROM documentos_institucionales d
          WHERE ${conds.join(' AND ')}
          ORDER BY d.modulo, d.id_documento ASC`,
        params
      );
      res.json({ data: r.rows });
    } catch (err) {
      console.error('[governance/documentos] list error:', err.message);
      res.status(500).json({ error: 'Error al listar formatos y documentos institucionales.' });
    }
  });

  // Consultar historial de versiones de un documento institucional
  router.get('/governance/documentos/:id/versiones', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    try {
      const r = await pool.query(
        `SELECT id_version, id_documento, version, nombre_archivo, tipo_mime, tamano_bytes,
                observacion_cambio, subido_por, fecha_version
           FROM documentos_institucionales_versiones
          WHERE id_documento = $1
          ORDER BY id_version DESC`,
        [id]
      );
      res.json({ data: r.rows });
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar versiones del documento.' });
    }
  });

  // Descargar documento institucional vigente (autenticado)
  router.get('/governance/documentos/:id/download', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    try {
      const r = await pool.query(
        `SELECT nombre_archivo, tipo_mime, contenido FROM documentos_institucionales WHERE id_documento = $1 AND activo = TRUE`,
        [id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Documento institucional no encontrado.' });
      const doc = r.rows[0];
      res.setHeader('Content-Type', doc.tipo_mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.nombre_archivo)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(doc.contenido);
    } catch (err) {
      res.status(500).json({ error: 'Error al descargar el documento institucional.' });
    }
  });

  // Descargar una versión específica anterior
  router.get('/governance/documentos/:id/versiones/:vid/download', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const vid = parseInt(req.params.vid, 10);
    if (!id || !vid) return res.status(400).json({ error: 'ID inválido.' });
    try {
      const r = await pool.query(
        `SELECT nombre_archivo, tipo_mime, contenido FROM documentos_institucionales_versiones
          WHERE id_documento = $1 AND id_version = $2`,
        [id, vid]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Versión no encontrada.' });
      const ver = r.rows[0];
      res.setHeader('Content-Type', ver.tipo_mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ver.nombre_archivo)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(ver.contenido);
    } catch (err) {
      res.status(500).json({ error: 'Error al descargar la versión del documento.' });
    }
  });

  // Cargar nuevo documento institucional (Solo Admin o Responsable del módulo)
  router.post('/governance/documentos', authMiddleware, async (req, res) => {
    const {
      modulo,
      codigoFormato,
      nombre,
      descripcion,
      categoria = 'Formato Institucional',
      version = '1.0',
      nombreArchivo,
      tipoMime,
      base64,
    } = req.body;

    if (!modulo || !VALID_MODULOS.includes(modulo)) {
      return res.status(400).json({ error: 'Módulo inválido.' });
    }

    const perm = await getModulePermission(pool, req.user, modulo);
    if (!perm.canManage) {
      return res.status(403).json({ error: 'Solo el responsable asignado al módulo o el Administrador pueden cargar formatos institucionales.' });
    }

    if (!nombre || !nombreArchivo || !base64) {
      return res.status(400).json({ error: 'Nombre del documento y archivo adjunto son obligatorios.' });
    }

    const cleanB64 = String(base64).replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(cleanB64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'El archivo adjunto está vacío o corrupto.' });
    if (buf.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (15 MB).' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO documentos_institucionales
           (modulo, codigo_formato, nombre, descripcion, categoria, version_actual, nombre_archivo, tipo_mime, tamano_bytes, contenido, subido_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id_documento, modulo, codigo_formato, nombre, descripcion, categoria, version_actual, nombre_archivo, tipo_mime, tamano_bytes, subido_por, fecha_carga, fecha_actualizacion`,
        [
          modulo,
          codigoFormato || null,
          nombre.trim(),
          descripcion || '',
          categoria,
          version || '1.0',
          nombreArchivo,
          tipoMime || 'application/octet-stream',
          buf.length,
          buf,
          req.user.name || req.user.username || 'Responsable',
        ]
      );
      const doc = ins.rows[0];

      await client.query(
        `INSERT INTO documentos_institucionales_versiones
           (id_documento, version, nombre_archivo, tipo_mime, tamano_bytes, contenido, observacion_cambio, subido_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          doc.id_documento,
          version || '1.0',
          nombreArchivo,
          tipoMime || 'application/octet-stream',
          buf.length,
          buf,
          'Carga inicial del formato/documento institucional',
          req.user.name || req.user.username || 'Responsable',
        ]
      );

      await logAudit(client, {
        modulo,
        idRegistro: doc.id_documento,
        radicado: doc.codigo_formato || `DOC-${doc.id_documento}`,
        user: req.user,
        tipoOperacion: 'DOCUMENTO_INSTITUCIONAL',
        valoresAnteriores: null,
        valoresNuevos: { nombre: doc.nombre, version: doc.version_actual, archivo: doc.nombre_archivo },
        observaciones: `Publicación de documento institucional "${doc.nombre}" (v${doc.version_actual})`,
      });

      await client.query('COMMIT');
      res.status(201).json({ message: 'Documento institucional publicado correctamente.', data: doc });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[governance/documentos] create error:', err.message);
      res.status(500).json({ error: 'Error al guardar el documento institucional.' });
    } finally {
      client.release();
    }
  });

  // Reemplazar / actualizar versión de un documento institucional existente
  router.put('/governance/documentos/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const prevRes = await pool.query(
      `SELECT id_documento, modulo, codigo_formato, nombre, descripcion, categoria, version_actual, nombre_archivo, tamano_bytes
         FROM documentos_institucionales WHERE id_documento = $1 AND activo = TRUE`,
      [id]
    );
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Documento no encontrado.' });
    const prev = prevRes.rows[0];

    const perm = await getModulePermission(pool, req.user, prev.modulo);
    if (!perm.canManage) {
      return res.status(403).json({ error: 'No tiene permisos para actualizar formatos en este módulo.' });
    }

    const {
      codigoFormato,
      nombre,
      descripcion,
      categoria,
      nuevaVersion,
      observacionCambio,
      nombreArchivo,
      tipoMime,
      base64,
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let versionFinal = nuevaVersion || prev.version_actual;
      if (base64 && nombreArchivo) {
        const cleanB64 = String(base64).replace(/^data:[^;]+;base64,/, '');
        const buf = Buffer.from(cleanB64, 'base64');
        if (!buf.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'El archivo de reemplazo está vacío.' });
        }
        if (!nuevaVersion || nuevaVersion === prev.version_actual) {
          const num = parseFloat(prev.version_actual);
          versionFinal = !isNaN(num) ? (num + 1).toFixed(1) : `${prev.version_actual}.1`;
        }

        await client.query(
          `UPDATE documentos_institucionales
              SET codigo_formato = COALESCE($1, codigo_formato),
                  nombre = COALESCE($2, nombre),
                  descripcion = COALESCE($3, descripcion),
                  categoria = COALESCE($4, categoria),
                  version_actual = $5,
                  nombre_archivo = $6,
                  tipo_mime = $7,
                  tamano_bytes = $8,
                  contenido = $9,
                  subido_por = $10,
                  fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_documento = $11`,
          [
            codigoFormato || prev.codigo_formato,
            nombre ? nombre.trim() : prev.nombre,
            descripcion !== undefined ? descripcion : prev.descripcion,
            categoria || prev.categoria,
            versionFinal,
            nombreArchivo,
            tipoMime || 'application/octet-stream',
            buf.length,
            buf,
            req.user.name || req.user.username || 'Responsable',
            id,
          ]
        );

        await client.query(
          `INSERT INTO documentos_institucionales_versiones
             (id_documento, version, nombre_archivo, tipo_mime, tamano_bytes, contenido, observacion_cambio, subido_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            versionFinal,
            nombreArchivo,
            tipoMime || 'application/octet-stream',
            buf.length,
            buf,
            observacionCambio || `Actualización a versión ${versionFinal}`,
            req.user.name || req.user.username || 'Responsable',
          ]
        );
      } else {
        await client.query(
          `UPDATE documentos_institucionales
              SET codigo_formato = COALESCE($1, codigo_formato),
                  nombre = COALESCE($2, nombre),
                  descripcion = COALESCE($3, descripcion),
                  categoria = COALESCE($4, categoria),
                  fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_documento = $5`,
          [
            codigoFormato || prev.codigo_formato,
            nombre ? nombre.trim() : prev.nombre,
            descripcion !== undefined ? descripcion : prev.descripcion,
            categoria || prev.categoria,
            id,
          ]
        );
      }

      await logAudit(client, {
        modulo: prev.modulo,
        idRegistro: id,
        radicado: codigoFormato || prev.codigo_formato || `DOC-${id}`,
        user: req.user,
        tipoOperacion: 'DOCUMENTO_INSTITUCIONAL',
        valoresAnteriores: prev,
        valoresNuevos: { nombre: nombre || prev.nombre, version: versionFinal, archivo: nombreArchivo || prev.nombre_archivo },
        observaciones: observacionCambio || `Reemplazo / actualización de documento institucional (v${versionFinal})`,
      });

      await client.query('COMMIT');
      res.json({ message: `Documento actualizado a la versión ${versionFinal}.` });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[governance/documentos] update error:', err.message);
      res.status(500).json({ error: 'Error al actualizar el documento institucional.' });
    } finally {
      client.release();
    }
  });

  // Desactivar documento institucional (Solo Admin o Responsable del módulo)
  router.delete('/governance/documentos/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    try {
      const prevRes = await pool.query(
        'SELECT id_documento, modulo, codigo_formato, nombre, version_actual, nombre_archivo FROM documentos_institucionales WHERE id_documento = $1',
        [id]
      );
      if (!prevRes.rows.length) return res.status(404).json({ error: 'Documento no encontrado.' });
      const prev = prevRes.rows[0];

      const perm = await getModulePermission(pool, req.user, prev.modulo);
      if (!perm.canManage) {
        return res.status(403).json({ error: 'No tiene permisos para retirar documentos en este módulo.' });
      }

      await pool.query('UPDATE documentos_institucionales SET activo = FALSE, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_documento = $1', [id]);

      await logAudit(pool, {
        modulo: prev.modulo,
        idRegistro: id,
        radicado: prev.codigo_formato || `DOC-${id}`,
        user: req.user,
        tipoOperacion: 'ELIMINACION',
        valoresAnteriores: prev,
        valoresNuevos: { activo: false },
        observaciones: `Retiro del documento institucional "${prev.nombre}"`,
      });

      res.json({ message: 'Documento institucional retirado.' });
    } catch (err) {
      res.status(500).json({ error: 'Error al retirar documento.' });
    }
  });
}

module.exports = {
  VALID_MODULOS,
  ensureAuditAndRbacSchema,
  isAdminUser,
  getModulePermission,
  isSelfRequest,
  logAudit,
  mountGovernanceRoutes,
};
