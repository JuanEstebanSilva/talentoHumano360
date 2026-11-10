const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const {
  ensureAuditAndRbacSchema,
  isAdminUser,
  getModulePermission,
  logAudit,
  mountGovernanceRoutes,
} = require('../utils/audit-rbac');

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

// ─── Catálogos Oficiales SST — Gobernación de Boyacá ─────────────────────────
const CATALOGO_EPP = [
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
];

// 28 elementos oficiales de EPP limpios (sin prefijo de letras A., B., etc.)
const ELEMENTOS_EPP_CLEAN = [
  'Casco de seguridad',
  'Gorro o Cofias',
  'Gorro Zafari',
  'Tapones externos',
  'Tapones de copa (orejeras)',
  'Careta (guadañar)',
  'Monogafas',
  'Gafas de seguridad',
  'Gafas de seguridad / UV',
  'Respirador con filtros',
  'Filtros para respiradores',
  'Respirador ffp2 o n95',
  'Mascarilla desechable',
  'Guantes de poliuretano',
  'Guantes de vaqueta',
  'Guantes de Nitrilo',
  'Guantes de látex',
  'Guantes de caucho',
  'Guantes sustancias químicas',
  'Chaleco Trabajo en campo',
  'Overol de dos piezas cinta reflectiva',
  'Overol antifluidos',
  'Bata manga larga antifluido',
  'Delantal Carnaza',
  'Zapato cerrado',
  'Botas de Seguridad',
  'Botas pantaneras con puntera',
  'Otros'
];

// 17 Secretarías oficiales de la Gobernación de Boyacá (sin numeración)
const SECRETARIAS_EPP = [
  'DESPACHO DEL GOBERNADOR',
  'SECRETARIA DE PLANEACION',
  'SECRETARIA DE HACIENDA',
  'SECRETARIA DE CONTRATACION',
  'SECRETARIA GENERAL',
  'SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL',
  'SECRETARIA DE INTEGRACION SOCIAL',
  'SECRETARIA DE EDUCACIÓN',
  'SECRETARIA DE CULTURA Y PATRIMONIO',
  'SECRETARIA DE SALUD',
  'SECRETARIA DE INFRAESTRUCTURA PUBLICA',
  'SECRETARIA DE MINAS Y ENERGIA',
  'SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE',
  'SECRETARIA DE AGRICULTURA',
  'SECRETARIA DE DESARROLLO EMPRESARIAL',
  'SECRETARIA DE TURISMO',
  'SECRETARIA DE TIC Y GOBIERNO ABIERTO'
];

// 61 Direcciones, Subdirecciones y Unidades oficiales (sin numeración)
const DIRECCIONES_EPP = [
  'OFICINA DE CONTROL INTERNO',
  'OFICINA CONTROL INTERNO DISCIPLINARIO (INSTRUCCIÓN)',
  'UNIDAD ADMINISTRATIVA ESPECIAL DE ASESORÍA Y DEFENSA JURIDICA DEL DEPARTAMENTO',
  'UNIDAD ADMINISTRATIVA ESPECIAL PARA LA GESTION DEL RIESGO DE DESASTRES',
  'UNIDAD ADMINISTRATIVA DE RELACIONES NACIONALES E INTERNACIONALES',
  'UNIDAD ADMINISTRATIVA DE COMUNICACIONES Y PROTOCOLO',
  'SUBDIRECCION DE RADIO Y TELEVISION',
  'OFICINA ASESORA DE PLANEACION Y METODOS DE GESTION',
  'DIRECCION DE SEGUIMIENTO Y PLANEACION TERRITORIAL',
  'DIRECCION GEOGRAFICA Y DE GESTION TERRITORIAL',
  'DIRECCION DE INVERSION PUBLICA DEL DEPARTAMENTO',
  'DIRECCION FINANCIERA Y FISCAL',
  'SUBDIRECCION DE PRESUPUESTO',
  'SUBDIRECCION DE CENTRAL DE CUENTAS',
  'SUBDIRECCION DE CONTABILIDAD',
  'SUBDIRECCION DE COBRO COACTIVO',
  'TESORERIA GENERAL',
  'DIRECCION DE RECAUDO Y FISCALIZACION',
  'DIRECCION DEPARTAMENTAL DE PASIVOS PENSIONALES',
  'SUBDIRECCION ADMINISTRATIVA DE PASIVOS PENSIONALES',
  'SUBDIRECCION JURIDICA DE PASIVOS PENSIONALES',
  'DIRECCION DE PROCESOS DE SELECCIÓN',
  'DIRECCION ADMINISTRATIVA CONTRACTUAL',
  'DIRECCION GENERAL DE TALENTO HUMANO',
  'SUBDIRECCION DE SEGURIDAD Y SALUD EN EL TRABAJO',
  'DIRECCION SERVICIOS ADMINISTRATIVOS Y LOGÍSTICOS',
  'SUBDIRECCION DE ATENCIÓN  AL CIUDADANO',
  'SUBDIRECCION DE GESTION DOCUMENTAL',
  'DIRECCION DE DIALOGO SOCIAL Y CONVIVENCIA',
  'DIRECCION DE PARTICIPACION Y ACCIÓN COMUNAL',
  'DIRECCION DE JUVENTUD',
  'DIRECCION DE FAMILIA, INFANCIA, ADOLESCENCIA Y ADULTO MAYOR',
  'DIRECCION DE LA MUJER E INCLUSIÓN SOCIAL',
  'OFICINA ASESORA Y DEFENSA JURIDICA DEL SECTOR EDUCACIÓN',
  'OFICINA ASESORA PARA LA GESTIÓN ESTRATEGICA DEL SECTOR EDUCACIÓN',
  'DIRECCION ADMINISTRATIVA Y FINANCIERA',
  'SUBDIRECCION DE TALENTO HUMANO',
  'DIRECCION TECNICO PEDAGOGICA',
  'SUBDIRECCION DE NUCLEOS EDUCATIVOS',
  'SUBDIRECCION DE INSPECCION Y VIGILANCIA',
  'SUBDIRECCION DE COBERTURA Y RURALIDAD',
  'PROGRAMA DE ADULTOS Y JOVENES EN EXTRA EDAD',
  'PROGRAMA DEL PLAN ALIMENTARIO ESCOLAR',
  'SUBDIRECCION DE CALIDAD EDUCATIVA',
  'OFICINA ASESORA Y DEFENSA JURIDICA DEL SECTOR SALUD',
  'OFICINA ASESORA PARA LA GESTION ESTRATEGICA DEL SECTOR SALUD',
  'DIRECCION DE PROMOCION Y PREVENCION EN SALUD',
  'SUBDIRECCION DE PROMOCION EN SALUD',
  'DIRECCION DE ASEGURAMIENTO EN SALUD',
  'DIRECCION DE PRESTACION DE SERVICIOS DE SALUD',
  'DIRECCION TECNICA  DE ESTUDIOS Y DISEÑO',
  'DIRECCION DE DESARROLLO DE LA INFRAESTRUCTURA VIAL',
  'DIRECCION DE VIVIENDA, EDIFICACIONES Y OBRA PUBLICA',
  'DIRECCION DE GESTION DEL RECURSO HIDRICO Y SANEAMIENTO BASICO',
  'DIRECCION DE DESARROLLO RURAL INTEGRAL',
  'DIRECCION DE BIENESTAR CAMPESINO',
  'DIRECCION DE PRODUCTIVIDAD AGROPECUARIA',
  'DIRECCION DE DESARROLLO EMPRESARIAL',
  'DIRECCION DE INVERSION Y COMERCIO',
  'DIRECCION DE APROPIACION DE TIC',
  'DIRECCION DE SISTEMAS'
];

// 19 Cargos oficiales de la Gobernación de Boyacá (sin numeración)
const CARGOS_EPP = [
  'GOBERNADOR',
  'ASESOR',
  'SECRETARIO DE DESPACHO',
  'JEFE OFICINA ASESORA',
  'DIRECTOR ADMINISTRATIVO',
  'DIRECTOR TÉCNICO',
  'PROFESIONAL UNIVERSITARIO',
  'PROFESIONAL ESPECIALIZADO',
  'ALMACENISTA GENERAL',
  'TESORERO GENERAL',
  'TECNICO ADMINISTRATIVO',
  'TECNICO OPERATIVO',
  'SECRETARIO EJECUTIVO',
  'SECRETARIA EJECUTIVA',
  'AUXILIAR ADMINISTRATIVO',
  'AUXILIAR DE SERVICIOS GENERALES',
  'CONDUCTOR',
  'CONDUCTOR MECANICO',
  'OPERARIO'
];

// 5 Tipos de Vinculación oficial (sin numeración)
const VINCULACIONES_EPP = [
  'CARRERA ADMINISTRATIVA',
  'PROVISIONALIDAD',
  'LIBRE NOMBRAMIENTO',
  'JUDICANTE',
  'ESTUDIANTE / PASANTE'
];

const SEDES_TRABAJO = [
  'ARCHIVO GENERAL DEL DEPARTAMENTO - Centro.',
  'ARCHIVO GENERAL DEL DEPARTAMENTO - Topo.',
  'AUDITORIO JOSE MOSSER Y OFICINAS.',
  'BIBLIOTECA DEPARTAMENTAL "EDUARDO TORRES QUINTERO"/SECRETARÍA DE DE AMBIENTE Y DESARROLLO SOSTENIBLE/ARCHIVO COBRO COACTIVO.',
  'BIBLIOTECA PEDRO PASCACIO MARTÍNEZ. (CASA JUAN DE CASTELLANOS)',
  'BODEGA TALLERES DE OBRAS PÚBLICAS DEL DEPARTAMENTO DE BOYACÁ.',
  'BODEGA VECTORES',
  'CASA DE BOYACÁ EN BOGOTÁ.',
  'CASA DE LA TORRE',
  'CASA PRIVADA DEL SEÑOR GOBERNADOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 203 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 206 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 207 B INTERIOR.',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 208 B INTERIOR',
  'CENTRO CIVICO PLAZA REAL TUNJA - OFICINA 209 B INTERIOR',
  'EDIFICIO CENTRO EXPERIMENTAL PILOTO - CEP.',
  'EDIFICIO LOTERÍA DE BOYACÁ',
  'EDIFICIO LOTERÍA DE BOYACÁ PISO 4',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 8° OFICINA 805',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1002',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1003',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1004',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1006',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 10° OFICINA 1007',
  'EDIFICIO LOTERÍA DE BOYACÁ - PISO 11°',
  'ESCUELA DE ARTES.',
  'FONDO TERRITORIAL DE PENSIONES DE BOYACÁ.',
  'JARDÍN BOTÁNICO.',
  'LABORATORIO DEPARTAMENTAL DE SALUD PÚBLICA.',
  'MONUMENTO HISTÓRICO DEL PUENTE DE BOYACÁ.',
  'OFICINAS DEL CDGRD.',
  'PALACIO DE SERVICIOS CULTURALES',
  'PARQUEADERO DEL DEPARTAMENTO.',
  'SECRETARIA DE EDUCACION DE BOYACÁ.',
  'SECRETARÍA DE SALUD DE BOYACÁ - CRISDI',
  'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.',
  'VIVE DIGITAL Y VIVE LAB.',
  'EDIFICIO INTELIGENTE - BICENTENARIO'
];

const DEPENDENCIAS_OFICIALES = [
  'DES - Despacho del gobernador',
  'DES - Oficina Asesora de Control Interno de Gestión',
  'DES - Oficina Asesora de Control Interno Disciplinario',
  'DES - Unidad Administrativa de Comunicaciones y Protocolo',
  'DES - UCOM - Subdirección de Radio y Televisión',
  'DES - Unidad Administrativa de Relaciones Nacionales Internacionales',
  'DES - Unidad Administrativa Especial de Asesoría y Defensa Jurídica del Departamento',
  'DES - Unidad Administrativa para la Gestión del Riesgo y del Desastre',
  'SAGR - SECRETARIA DE AGRICULTURA (Despacho)',
  'SAGR - Dirección de Desarrollo Rural Integral',
  'SAGR - Dirección de Productividad Agropecuaria',
  'SAMB - SECRETARIA DE AMBIENTE Y DESARROLLO SOSTENIBLE (Despacho)',
  'SAMB - Dirección de Gestión del Recurso Hídrico y Saneamiento Básico',
  'SCON - SECRETARIA DE CONTRATACION (Despacho)',
  'SAGR - Dirección de Bienestar Campesino',
  'SCON - Dirección Administrativa Contractual',
  'SCON - Dirección de Procesos de Selección',
  'SCUP - SECRETARIA DE CULTURA Y PATRIMONIO (Despacho)',
  'SDEM - SECRETARIA DE DESARROLLO EMPRESARIAL (Despacho)',
  'SDEM - Dirección de Desarrollo Empresarial',
  'SDEM - Dirección de Inversión y Comercio',
  'SEDU - SECRETARIA DE EDUCACIÓN (Despacho)',
  '*SEDU - INSTITUCIÓN EDUCATIVA DEL DEPARTAMENTO',
  'SEDU - Oficina Asesora para la Gestión Estratégica del Sector Educación',
  'SEDU - Oficina Asesora y Defensa Jurídica del Sector Educación',
  'SEDU - Dirección Técnico Pedagógica',
  'SEDU - DTP - Programa de Adultos y Jóvenes en Extra Edad',
  'SEDU - DTP - Programa del Plan Alimentario Escolar',
  'SEDU - DTP - Subdirección de Calidad Educativa',
  'SEDU - DTP - Subdirección de Cobertura y Ruralidad',
  'SEDU - DTP - Subdirección de Inspección de Vigilancia',
  'SEDU - DTP - Subdirección de Núcleos Educativos',
  'SEDU - Dirección Administrativa Financiera',
  'SEDU - DAF - Subdirección de Talento Humano',
  'SGEN - SECRETARIA GENERAL (Despacho)',
  'SGEN - Dirección General de Talento Humano',
  'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo',
  'SGEN - Dirección de Servicios Administrativos y Logísticos',
  'SGEN - DSA - Subdirección de Atención al Ciudadano',
  'SGEN - DSA - Subdirección de Gestión Documental',
  'SGOB - SECRETARIA DE GOBIERNO Y ACCIÓN COMUNAL (Despacho)',
  'SGOB - Dirección de Dialogo Social y Convivencia',
  'SGOB - Dirección de Participación y Acción Comunal',
  'SGOB -Dirección de Juventud',
  'SHAC - SECRETARIA DE HACIENDA (Despacho)',
  'SHAC - Dirección Financiera Y Fiscal',
  'SHAC - DFF - Subdirección de Cobro Coactivo',
  'SHAC - DFF - Subdirección Central de Cuentas',
  'SHAC - DFF - Subdirección de Contabilidad',
  'SHAC - DFF - Subdirección de Presupuesto',
  'SHAC - Dirección Departamental de Pasivos Pensionales',
  'SHAC - DPP - Subdirección Administrativa de Pasivos Pensionales',
  'SHAC - DPP - Subdirección Jurídica de Pasivos Pensionales',
  'SHAC - Dirección de Recaudo y Fiscalización',
  'SHAC - Tesorería General',
  'SINF - SECRETARIA DE INFRAESTRUCTURA PUBLICA (Despacho)',
  'SINF - Dirección de Desarrollo de la Infraestructura Vial',
  'SINF - Dirección de Vivienda Edificaciones y Obra Publica',
  'SINF - Dirección Técnica de Estudios y Diseños',
  'SINS - SECRETARIA DE INTEGRACIÓN SOCIAL (Despacho)',
  'SINS - Dirección de Familia, Infancia, Adolescencia y Adulto Mayor',
  'SINS - Dirección de la Mujer e Inclusión Social',
  'SMIN - SECRETARIA DE MINAS Y ENERGIA (Despacho)',
  'SPLA - SECRETARIA DE PLANEACIÓN (Despacho)',
  'SPLA - Dirección de Inversión Publica del Departamento',
  'SPLA - Dirección de Seguimiento y Planeación Territorial',
  'SPLA - Dirección Geográfica y de Gestión Territorial',
  'SPLA - Oficina Asesora de Planeación y Métodos de Gestión',
  'SSAL - SECRETARIA DE SALUD (Despacho)',
  'SSAL - Dirección de Aseguramiento en Salud',
  'SSAL - Dirección de Prestación de Servicios de Salud',
  'SSAL - Dirección de Promoción y Prevención en Salud',
  'SSAL - DPP - Subdirección de Promoción Social en Salud',
  'SSAL - Oficina Asesora de Defensa Jurídica del Sector Salud',
  'SSAL - Oficina Asesora para la Gestión Estratégica del Sector Salud',
  'STIC - SECRETARIA DE TIC Y GOBIERNO ABIERTO (Despacho)',
  'STIC - Dirección de Apropiación de TIC',
  'STIC - Dirección de Sistemas de Información',
  'STUR - SECRETARIA DE TURISMO (Despacho)'
];

const TIPOS_EMO = ['Ingreso', 'Periódico', 'Egreso', 'Post Incapacidad', 'Trabajo en alturas'];
const ESTADOS_CASO = ['Vigente', 'En Seguimiento', 'En Rehabilitación', 'Próximo a Vencer', 'Vencido', 'Cerrado'];
const PROGRAMAS_PVE = [
  'No aplica',
  'PVE Biomecánico / Osteomuscular',
  'PVE Psicosocial',
  'PVE Visual',
  'PVE Auditivo',
  'PVE Cardiovascular y Metabólico',
  'PVE Respiratorio',
  'PVE Voz'
];

// ─── Auto-Inicialización Segura de Esquema SST ──────────────────────────────
async function ensureSstSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sst_perfil_epidemiologico (
          id_epidemiologico         SERIAL PRIMARY KEY,
          tipo_identificacion       VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
          documento                 VARCHAR(60)   NOT NULL,
          apellidos                 VARCHAR(160)  NOT NULL,
          nombres                   VARCHAR(160)  NOT NULL,
          nombre_completo           VARCHAR(320)  NOT NULL,
          telefono                  VARCHAR(60),
          edad                      INTEGER,
          fecha_ingreso             VARCHAR(60),
          dependencia               VARCHAR(300)  NOT NULL,
          sede_trabajo              VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          cargo                     VARCHAR(280),
          fecha_emo                 DATE,
          tipo_emo                  VARCHAR(80)   NOT NULL DEFAULT 'Periódico',
          restricciones             TEXT          DEFAULT 'NINGUNA',
          recomendaciones           TEXT          DEFAULT 'Pausas activas e higiene postural',
          direccionado_pve          VARCHAR(200)  DEFAULT 'No aplica',
          direccionado_eps          VARCHAR(200)  DEFAULT 'No aplica',
          fecha_proximo_emo         DATE,
          accidente_trabajo         VARCHAR(20)   NOT NULL DEFAULT 'NO',
          fecha_accidente           DATE,
          estado_actual_accidente   VARCHAR(250),
          cumplio_rehabilitacion    VARCHAR(15)   DEFAULT 'N/A',
          enfermedad_laboral        VARCHAR(20)   NOT NULL DEFAULT 'NO',
          fecha_enfermedad          DATE,
          estado_actual_enfermedad  VARCHAR(250),
          estado_final_caso         VARCHAR(100)  NOT NULL DEFAULT 'Vigente',
          actividades_pendientes    TEXT,
          soporte                   TEXT,
          creado_por                VARCHAR(120)  DEFAULT 'admin',
          creado_en                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sst_entrega_epp (
          id_entrega_epp                SERIAL PRIMARY KEY,
          documento                     VARCHAR(60)   NOT NULL,
          nombre_completo               VARCHAR(320)  NOT NULL,
          telefono                      VARCHAR(60),
          secretaria                    VARCHAR(280)  DEFAULT 'SECRETARIA GENERAL',
          dependencia                   VARCHAR(300)  NOT NULL,
          sede_trabajo                  VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          cargo                         VARCHAR(280)  DEFAULT 'PROFESIONAL UNIVERSITARIO',
          tipo_vinculacion              VARCHAR(120)  DEFAULT 'CARRERA ADMINISTRATIVA',
          restricciones_recomendaciones TEXT          DEFAULT 'NINGUNA',
          codigo_elemento               VARCHAR(20)   NOT NULL DEFAULT 'A',
          elemento_epp                  VARCHAR(200)  NOT NULL,
          talla                         VARCHAR(40)   DEFAULT 'N/A',
          cantidad                      VARCHAR(60)   NOT NULL DEFAULT '1 UNIDAD',
          fecha_entrega                 DATE          NOT NULL DEFAULT CURRENT_DATE,
          estado_entrega                VARCHAR(60)   NOT NULL DEFAULT 'Entregado',
          firmado_funcionario           BOOLEAN       DEFAULT TRUE,
          observaciones                 TEXT,
          soporte                       TEXT,
          creado_por                    VARCHAR(120)  DEFAULT 'admin',
          creado_en                     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sst_perfil_sociodemografico (
          id_sociodemografico   SERIAL PRIMARY KEY,
          tipo_identificacion   VARCHAR(60)   NOT NULL DEFAULT 'Cédula de Ciudadanía',
          documento             VARCHAR(60)   NOT NULL,
          apellidos             VARCHAR(160)  NOT NULL,
          nombres               VARCHAR(160)  NOT NULL,
          nombre_completo       VARCHAR(320)  NOT NULL,
          sexo                  VARCHAR(40)   DEFAULT 'Masculino',
          anio_nacimiento       INTEGER,
          edad                  INTEGER,
          raza_etnia            VARCHAR(80)   DEFAULT 'Blanco/Mestizo',
          estado_civil          VARCHAR(60)   DEFAULT 'Soltero (a)',
          composicion_familiar  VARCHAR(250)  DEFAULT 'Conyuge Permanente, Hijos',
          tipo_vivienda         VARCHAR(60)   DEFAULT 'Propia',
          estrato               VARCHAR(10)   DEFAULT '3',
          municipio_residencia  VARCHAR(120)  DEFAULT 'Tunja',
          municipio_trabajo     VARCHAR(120)  DEFAULT 'Tunja',
          escolaridad           VARCHAR(100)  DEFAULT 'Profesional',
          ocupacion_profesion   VARCHAR(200),
          rango_ingresos        VARCHAR(80)   DEFAULT 'Entre 3 y 6 SMMLV',
          denominacion_cargo    VARCHAR(200)  DEFAULT 'Profesional Universitario',
          tipo_cargo            VARCHAR(80)   DEFAULT 'Profesional',
          tipo_vinculacion      VARCHAR(100)  DEFAULT 'Carrera Administrativa',
          antiguedad_cargo      VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
          antiguedad_entidad    VARCHAR(80)   DEFAULT 'Entre 1 y 4 años',
          dependencia           VARCHAR(300)  NOT NULL,
          sede_trabajo          VARCHAR(300)  DEFAULT 'CASA DE LA TORRE',
          creado_por            VARCHAR(120)  DEFAULT 'admin',
          creado_en             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE sst_entrega_epp ADD COLUMN IF NOT EXISTS firma_digital TEXT;

      CREATE TABLE IF NOT EXISTS sst_historial (
          id_historial    SERIAL PRIMARY KEY,
          submodulo       VARCHAR(60)  NOT NULL,
          id_registro     INTEGER      NOT NULL,
          accion          VARCHAR(120) NOT NULL,
          detalle         VARCHAR(500),
          realizado_por   VARCHAR(120) DEFAULT 'Sistema',
          fecha           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar datos semilla de los formatos oficiales si están vacías
    const epiCount = await pool.query('SELECT COUNT(*) FROM sst_perfil_epidemiologico');
    if (parseInt(epiCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_perfil_epidemiologico (
            tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
            fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
            restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
            accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
            enfermedad_laboral, estado_final_caso, actividades_pendientes
        ) VALUES
        (
            'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', '3213938142', 31,
            '2023-02-15', 'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE', 'PROFESIONAL UNIVERSITARIO',
            '2026-01-15', 'Periódico', 'NINGUNA', 'Pausas activas visuales y ergonómicas cada 2 horas',
            'PVE Biomecánico / Osteomuscular', 'No aplica', '2027-01-15',
            'NO', NULL, NULL, 'N/A', 'NO', 'Vigente', 'Control periódico anual programado'
        ),
        (
            'Cédula de Ciudadanía', '40028155', 'SAAVEDRA RODRIGUEZ', 'YAZMIN ROCIO', 'SAAVEDRA RODRIGUEZ YAZMIN ROCIO', '3104589210', 44,
            '2018-06-01', 'SSAL - Dirección de Aseguramiento en Salud', 'SECRETARÍA DE SALUD DEL DEPARTAMENTO DE BOYACÁ.', 'AUXILIAR ADMINISTRATIVO',
            '2026-02-20', 'Post Incapacidad', 'Evitar levantamiento de cargas mayores a 5 kg y bipedestación prolongada',
            'Adecuación de puesto de trabajo y seguimiento por medicina laboral ARL Positiva',
            'PVE Biomecánico / Osteomuscular', 'Control por Ortopedia EPS / ARL Positiva', '2026-08-20',
            'SI', '2025-12-26', 'En recuperación de fractura de peroné (CIE-10 S824)', 'SI', 'NO', 'En Seguimiento',
            'Verificar cumplimiento de recomendaciones médicas en puesto de trabajo'
        );
      `);
    }

    const eppCount = await pool.query('SELECT COUNT(*) FROM sst_entrega_epp');
    if (parseInt(eppCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_entrega_epp (
            documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo, cargo,
            tipo_vinculacion, restricciones_recomendaciones, codigo_elemento, elemento_epp,
            talla, cantidad, fecha_entrega, estado_entrega, firmado_funcionario, observaciones
        ) VALUES
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'A', 'A. Casco de seguridad', 'N/A', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
            'Entrega oficial de dotación y elementos de protección personal'
        ),
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'T', 'T. Chaleco Trabajo en campo', 'L', '1 UNIDAD', '2026-01-15', 'Entregado', TRUE,
            'Dotación para visitas técnicas de inspección SST'
        ),
        (
            '1003481573', 'ROMERO MARIN IVAN DARIO', '3213938142', '5. SECRETARIA GENERAL',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE',
            'PROFESIONAL UNIVERSITARIO', 'CARRERA ADMINISTRATIVA', 'NINGUNA',
            'P', 'P. Guantes de Nitrilo', 'M', '1 CAJA', '2026-01-15', 'Entregado', TRUE,
            'Suministro de bioseguridad SST'
        );
      `);
    }

    const socCount = await pool.query('SELECT COUNT(*) FROM sst_perfil_sociodemografico');
    if (parseInt(socCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO sst_perfil_sociodemografico (
            tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
            anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
            tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
            escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
            tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
            dependencia, sede_trabajo
        ) VALUES (
            'Cédula de Ciudadanía', '1003481573', 'ROMERO MARIN', 'IVAN DARIO', 'ROMERO MARIN IVAN DARIO', 'Masculino',
            1994, 31, 'Blanco/Mestizo', 'Soltero (a)', 'OTROS (Hermanos, Sobrinos, Ahijados, Hijastros, Entre otros )',
            'Arriendo', '3', 'Tunja', 'Tunja',
            'Especialización', 'Ingeniero Industrial', 'Entre 3 y 6 SMMLV', 'Profesional Universitario',
            'Profesional', 'Carrera Administrativa', 'Entre 1 y 4 años', 'Entre 1 y 4 años',
            'SGEN - DTH - Subdirección de Seguridad y Salud en el Trabajo', 'CASA DE LA TORRE'
        );
      `);
    }
    await ensureAuditAndRbacSchema(pool);
    console.log('[sst-service] Tablas SST, Auditoría y RBAC verificadas correctamente.');
  } catch (err) {
    console.error('[sst-service] Error verificando esquema SST:', err.message);
  }
}

ensureSstSchema();

// ─── Middleware de Autenticación y Utilidades ────────────────────────────────
function auth(req, res, next) {
  let token = (req.headers.authorization || req.query.token || '').replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)talento360_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'No autorizado. Token de sesión requerido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o sesión expirada.' });
  }
}

// Montar rutas compartidas de Gobernanza (Permisos, Responsables, Auditoría y Documentos Institucionales)
mountGovernanceRoutes(router, pool, auth);

function canEdit(roleOrUser) {
  if (!roleOrUser) return false;
  const role = typeof roleOrUser === 'string' ? roleOrUser : (roleOrUser.role || roleOrUser.rol || '');
  const r = role.toLowerCase().trim();
  if (r === 'administrador' || r === 'admin' || r === 'coordinador' || r === 'coordinador sst' || r === 'sst' || r.includes('sst')) return true;
  if (typeof roleOrUser === 'object') {
    const perms = Array.isArray(roleOrUser.permissions) ? roleOrUser.permissions : [];
    if (perms.includes('*') || perms.includes('sst:write') || perms.includes('sst:*')) return true;
  }
  return false;
}

function upper(v) {
  return v == null ? '' : String(v).trim().replace(/\s+/g, ' ').toUpperCase();
}

function toIsoDateOrNull(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function addOneYear(isoDate) {
  if (!isoDate) return null;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10) + 1;
  return `${y}-${parts[1]}-${parts[2]}`;
}

function resolveEppItem(raw) {
  if (!raw) return CATALOGO_EPP[0];
  const s = String(raw).trim().toUpperCase();
  // 1. Por código directo (A, B, AA, etc.)
  const byCode = CATALOGO_EPP.find(e => e.codigo === s || s.startsWith(e.codigo + '.'));
  if (byCode) return byCode;
  // 2. Por nombre limpio de elemento
  const cleanIdx = ELEMENTOS_EPP_CLEAN.findIndex(name => name.toUpperCase() === s);
  if (cleanIdx >= 0 && CATALOGO_EPP[cleanIdx]) return CATALOGO_EPP[cleanIdx];
  // 3. Por coincidencia parcial
  const byName = CATALOGO_EPP.find(e => {
    const nomUpper = e.nombre.toUpperCase();
    const cleanUpper = nomUpper.replace(/^[A-Z]+\.\s*/, '');
    return nomUpper.includes(s) || s.includes(cleanUpper) || cleanUpper.includes(s);
  });
  return byName || { codigo: 'AB', nombre: String(raw).trim() };
}

// ─── GET /api/sst/catalogs ───────────────────────────────────────────────────
router.get('/catalogs', auth, async (_, res) => {
  try {
    const dbDeps = await pool.query(
      `SELECT DISTINCT TRIM(dependencia) AS dep FROM dependencias WHERE dependencia IS NOT NULL AND TRIM(dependencia) <> '' ORDER BY dep`
    ).catch(() => ({ rows: [] }));

    const divRes = await pool.query(
      `SELECT DISTINCT TRIM(municipio) AS mpio FROM divipola WHERE municipio IS NOT NULL AND TRIM(municipio) <> '' ORDER BY mpio`
    ).catch(() => ({ rows: [] }));

    const mergedDeps = Array.from(new Set([
      ...DEPENDENCIAS_OFICIALES,
      ...dbDeps.rows.map(r => r.dep)
    ]));

    const divipolaMpios = divRes.rows.map(r => r.mpio);

    res.json({
      eppCatalogo: CATALOGO_EPP,
      elementosEppClean: ELEMENTOS_EPP_CLEAN,
      secretariasEpp: SECRETARIAS_EPP,
      direccionesEpp: DIRECCIONES_EPP,
      cargosEpp: CARGOS_EPP,
      vinculacionesEpp: VINCULACIONES_EPP,
      sedes: SEDES_TRABAJO,
      dependencias: mergedDeps,
      tiposEmo: TIPOS_EMO,
      estadosCaso: ESTADOS_CASO,
      programasPve: PROGRAMAS_PVE,
      municipiosDivipola: divipolaMpios,
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
      cargosOficialesSocio: [
        'Profesional Universitario',
        'Profesional Especializado',
        'Técnico Administrativo',
        'Técnico Operativo',
        'Auxiliar Administrativo',
        'Aux. Servicios Generales',
        'Secretario',
        'Secretario Ejecutivo',
        'Secretaria Ejecutiva',
        'Secretario de Despacho',
        'Subdirector Administrativo',
        'Subdirector Técnico',
        'Director Administrativo',
        'Director Técnico',
        'Director de Departamento',
        'Jefe de Oficina Asesora',
        'Asesor',
        'Gobernador',
        'Tesorero General',
        'Almacenista General',
        'Celador',
        'Conductor',
        'Conductor Mecánico',
        'Operario',
        'Judicante',
        'Pasante SENA',
        'Practicante Universitario',
        'N/A (Contrato de Prestación de Servicios)',
        'OTRO'
      ],
      municipiosResidenciaSugeridos: [
        'Tunja',
        'Duitama',
        'Sogamoso',
        'Chiquinquirá',
        'Paipa',
        'Cómbita',
        'Samacá',
        'Villa de Leyva',
        'Moniquirá',
        'Nobsa',
        'Garagoa',
        'Guateque',
        'Puerto Boyacá',
        'Ventaquemada',
        'Tuta',
        'Oicatá',
        'Soracá',
        'Siachoque',
        'Chivatá',
        'Toca',
        'Pesca',
        'Tibasosa',
        'Santa Rosa de Viterbo',
        'Bogotá D.C.',
        'Otro Municipio'
      ],
      municipiosTrabajoSugeridos: [
        'Tunja',
        'Bogotá',
        'Duitama',
        'Sogamoso',
        'Chiquinquirá',
        'Paipa',
        'Puerto Boyacá',
        'OTRO'
      ],
      profesionesSugeridas: [
        'Ingeniero Industrial',
        'Abogado',
        'Contador Público',
        'Administrador de Empresas',
        'Administrador Público',
        'Economista',
        'Ingeniero de Sistemas',
        'Ingeniero Civil',
        'Ingeniero Ambiental',
        'Psicólogo',
        'Trabajador Social',
        'Comunicador Social / Periodista',
        'Médico',
        'Enfermero',
        'Arquitecto',
        'Docente / Licenciado',
        'Tecnólogo en Gestión Administrativa',
        'Técnico en Sistemas',
        'Bachiller',
        'OTRA'
      ]
    });
  } catch (err) {
    console.error('[sst-service] catalogs error:', err.message);
    res.status(500).json({ error: 'Error al obtener catálogos SST.' });
  }
});

// ─── Helpers de Mapeo de Registros SST ───────────────────────────────────────
function mapEpiRow(r) {
  return {
    id: r.id_epidemiologico,
    radicado: `EMO-2026-${String(r.id_epidemiologico).padStart(4, '0')}`,
    tipoIdentificacion: r.tipo_identificacion,
    documento: r.documento,
    apellidos: r.apellidos,
    nombres: r.nombres,
    nombreCompleto: r.nombre_completo,
    telefono: r.telefono,
    edad: r.edad,
    fechaIngreso: r.fecha_ingreso,
    dependencia: r.dependencia,
    sedeTrabajo: r.sede_trabajo,
    cargo: r.cargo,
    fechaEmo: r.fecha_emo ? (r.fecha_emo instanceof Date ? r.fecha_emo.toISOString().split('T')[0] : String(r.fecha_emo).slice(0, 10)) : '',
    tipoEmo: r.tipo_emo,
    restricciones: r.restricciones,
    recomendaciones: r.recomendaciones,
    direccionadoPve: r.direccionado_pve,
    direccionadoEps: r.direccionado_eps,
    fechaProximoEmo: r.fecha_proximo_emo ? (r.fecha_proximo_emo instanceof Date ? r.fecha_proximo_emo.toISOString().split('T')[0] : String(r.fecha_proximo_emo).slice(0, 10)) : '',
    accidenteTrabajo: r.accidente_trabajo,
    fechaAccidente: r.fecha_accidente ? (r.fecha_accidente instanceof Date ? r.fecha_accidente.toISOString().split('T')[0] : String(r.fecha_accidente).slice(0, 10)) : '',
    estadoActualAccidente: r.estado_actual_accidente,
    cumplioRehabilitacion: r.cumplio_rehabilitacion,
    enfermedadLaboral: r.enfermedad_laboral,
    fechaEnfermedad: r.fecha_enfermedad ? (r.fecha_enfermedad instanceof Date ? r.fecha_enfermedad.toISOString().split('T')[0] : String(r.fecha_enfermedad).slice(0, 10)) : '',
    estadoActualEnfermedad: r.estado_actual_enfermedad,
    estadoFinalCaso: r.estado_final_caso,
    actividadesPendientes: r.actividades_pendientes,
    soporte: r.soporte,
    creadoEn: r.creado_en
  };
}

function mapEppRow(r) {
  return {
    id: r.id_entrega_epp,
    radicado: `EPP-2026-${String(r.id_entrega_epp).padStart(4, '0')}`,
    documento: r.documento,
    nombreCompleto: r.nombre_completo,
    telefono: r.telefono,
    secretaria: r.secretaria,
    dependencia: r.dependencia,
    sedeTrabajo: r.sede_trabajo,
    cargo: r.cargo,
    tipoVinculacion: r.tipo_vinculacion,
    restriccionesRecomendaciones: r.restricciones_recomendaciones,
    codigoElemento: r.codigo_elemento,
    elementoEpp: r.elemento_epp,
    talla: r.talla,
    cantidad: r.cantidad,
    fechaEntrega: r.fecha_entrega ? (r.fecha_entrega instanceof Date ? r.fecha_entrega.toISOString().split('T')[0] : String(r.fecha_entrega).slice(0, 10)) : '',
    estadoEntrega: r.estado_entrega,
    firmadoFuncionario: r.firmado_funcionario,
    firmaDigital: r.firma_digital || null,
    observaciones: r.observaciones,
    soporte: r.soporte,
    creadoEn: r.creado_en
  };
}

function mapSocioRow(r) {
  return {
    id: r.id_sociodemografico,
    radicado: `SOC-2026-${String(r.id_sociodemografico).padStart(4, '0')}`,
    tipoIdentificacion: r.tipo_identificacion,
    documento: r.documento,
    apellidos: r.apellidos,
    nombres: r.nombres,
    nombreCompleto: r.nombre_completo,
    sexo: r.sexo,
    anioNacimiento: r.anio_nacimiento,
    edad: r.edad,
    razaEtnia: r.raza_etnia,
    estadoCivil: r.estado_civil,
    composicionFamiliar: r.composicion_familiar,
    tipoVivienda: r.tipo_vivienda,
    estrato: r.estrato,
    municipioResidencia: r.municipio_residencia,
    municipioTrabajo: r.municipio_trabajo,
    escolaridad: r.escolaridad,
    ocupacionProfesion: r.ocupacion_profesion,
    rangoIngresos: r.rango_ingresos,
    denominacionCargo: r.denominacion_cargo,
    tipoCargo: r.tipo_cargo,
    tipoVinculacion: r.tipo_vinculacion,
    antiguedadCargo: r.antiguedad_cargo,
    antiguedadEntidad: r.antiguedad_entidad,
    dependencia: r.dependencia,
    sedeTrabajo: r.sede_trabajo,
    creadoEn: r.creado_en
  };
}

// ─── GET /api/sst/stats (Dashboards 6.4 Epidemiológico, 6.5 Sociodemográfico, 6.6 EPP) ───
router.get('/stats', auth, async (req, res) => {
  try {
    // Control de Acceso RBAC (DEF-003 / Confidencialidad Ley 1581 y Res. 2346):
    // Solo Administración y Responsables SST tienen acceso a estadísticas e informes consolidados.
    const permEpi = await getModulePermission(pool, req.user, 'epidemiologico');
    const permSoc = await getModulePermission(pool, req.user, 'sociodemografico');
    const permEpp = await getModulePermission(pool, req.user, 'epp');
    const canAccess = permEpi.canManage || permSoc.canManage || permEpp.canManage || isAdminUser(req.user);
    if (!canAccess) {
      return res.status(403).json({ error: 'Acceso denegado a estadísticas gerenciales de SST. Se requiere perfil de administración o responsable SST.' });
    }

    const { anio = '', mes = '', fechaInicio = '', fechaFin = '', dependencia = '' } = req.query;

    // Filtros dinámicos para Epidemiológico (fecha_emo / dependencia)
    const epiConds = ['1=1'];
    const epiVals = [];
    let ei = 1;
    if (anio && anio !== 'Todos') { epiConds.push(`EXTRACT(YEAR FROM COALESCE(fecha_emo, creado_en::date))::text = $${ei++}`); epiVals.push(String(anio)); }
    if (mes && mes !== 'Todos')   { epiConds.push(`EXTRACT(MONTH FROM COALESCE(fecha_emo, creado_en::date))::int = $${ei++}`); epiVals.push(parseInt(mes, 10)); }
    if (fechaInicio)              { epiConds.push(`COALESCE(fecha_emo, creado_en::date) >= $${ei++}::date`); epiVals.push(fechaInicio); }
    if (fechaFin)                 { epiConds.push(`COALESCE(fecha_emo, creado_en::date) <= $${ei++}::date`); epiVals.push(fechaFin); }
    if (dependencia && dependencia !== 'Todas') { epiConds.push(`LOWER(dependencia) LIKE LOWER($${ei++})`); epiVals.push(`%${dependencia}%`); }
    const epiWhere = epiConds.join(' AND ');

    // Filtros dinámicos para EPP (fecha_entrega / dependencia)
    const eppConds = ['1=1'];
    const eppVals = [];
    let pi = 1;
    if (anio && anio !== 'Todos') { eppConds.push(`EXTRACT(YEAR FROM COALESCE(fecha_entrega, creado_en::date))::text = $${pi++}`); eppVals.push(String(anio)); }
    if (mes && mes !== 'Todos')   { eppConds.push(`EXTRACT(MONTH FROM COALESCE(fecha_entrega, creado_en::date))::int = $${pi++}`); eppVals.push(parseInt(mes, 10)); }
    if (fechaInicio)              { eppConds.push(`COALESCE(fecha_entrega, creado_en::date) >= $${pi++}::date`); eppVals.push(fechaInicio); }
    if (fechaFin)                 { eppConds.push(`COALESCE(fecha_entrega, creado_en::date) <= $${pi++}::date`); eppVals.push(fechaFin); }
    if (dependencia && dependencia !== 'Todas') { eppConds.push(`LOWER(dependencia) LIKE LOWER($${pi++})`); eppVals.push(`%${dependencia}%`); }
    const eppWhere = eppConds.join(' AND ');

    // Filtros dinámicos para Sociodemográfico (dependencia)
    const socConds = ['1=1'];
    const socVals = [];
    let si = 1;
    if (dependencia && dependencia !== 'Todas') { socConds.push(`LOWER(dependencia) LIKE LOWER($${si++})`); socVals.push(`%${dependencia}%`); }
    const socWhere = socConds.join(' AND ');

    const [
      epiStats,
      epiPorTipo,
      epiPorEstado,
      epiPorPve,
      epiPorDep,
      epiPorMes,
      eppStats,
      eppPorElem,
      eppPorDep,
      eppPorMes,
      eppInventario,
      socStats,
      socPorEdad,
      socPorSexo,
      socPorEsc,
      socPorDep,
      socPorVinculacion,
      socPorEstadoCivil
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_emo,
          COUNT(*) FILTER (WHERE estado_final_caso = 'Vigente')::int AS emo_vigentes,
          COUNT(*) FILTER (
            WHERE estado_final_caso IN ('Vencido', 'Próximo a Vencer')
               OR (fecha_proximo_emo IS NOT NULL AND fecha_proximo_emo <= CURRENT_DATE + INTERVAL '30 days')
          )::int AS emo_alertas,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(accidente_trabajo, 'NO')) = 'SI'
               OR UPPER(COALESCE(enfermedad_laboral, 'NO')) = 'SI'
               OR estado_final_caso IN ('En Seguimiento', 'En Rehabilitación')
          )::int AS casos_seguimiento,
          COUNT(*) FILTER (
            WHERE direccionado_pve IS NOT NULL
              AND LOWER(TRIM(direccionado_pve)) NOT IN ('', 'no aplica', 'ninguno', 'n/a')
          )::int AS direccionados_pve,
          COUNT(*) FILTER (
            WHERE restricciones IS NOT NULL
              AND UPPER(TRIM(restricciones)) NOT IN ('', 'NINGUNA', 'NINGUNO', 'N/A', 'NO APLICA')
          )::int AS con_condiciones_salud,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(accidente_trabajo, 'NO')) = 'SI')::int AS accidentes_trabajo,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(enfermedad_laboral, 'NO')) = 'SI')::int AS enfermedades_laborales
        FROM sst_perfil_epidemiologico
        WHERE ${epiWhere}
      `, epiVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(tipo_emo),''), 'Periódico') AS tipo, COUNT(*)::int AS cantidad
        FROM sst_perfil_epidemiologico WHERE ${epiWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, epiVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(estado_final_caso),''), 'Vigente') AS estado, COUNT(*)::int AS cantidad
        FROM sst_perfil_epidemiologico WHERE ${epiWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, epiVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(direccionado_pve),''), 'No aplica') AS programa, COUNT(*)::int AS cantidad
        FROM sst_perfil_epidemiologico WHERE ${epiWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, epiVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(dependencia),''), 'SIN DEPENDENCIA') AS dependencia, COUNT(*)::int AS cantidad
        FROM sst_perfil_epidemiologico WHERE ${epiWhere}
        GROUP BY 1 ORDER BY cantidad DESC LIMIT 10
      `, epiVals),
      pool.query(`
        SELECT TO_CHAR(COALESCE(fecha_emo, creado_en::date), 'YYYY-MM') AS mes, COUNT(*)::int AS cantidad
        FROM sst_perfil_epidemiologico WHERE ${epiWhere}
        GROUP BY 1 ORDER BY 1 ASC LIMIT 12
      `, epiVals),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_epp,
          COUNT(DISTINCT documento)::int AS servidores_dotados,
          COUNT(*) FILTER (WHERE estado_entrega = 'Entregado')::int AS entregados,
          COUNT(*) FILTER (WHERE estado_entrega <> 'Entregado')::int AS pendientes_reposicion,
          COUNT(*) FILTER (WHERE firmado_funcionario = TRUE)::int AS firmados,
          COALESCE(SUM(GREATEST(1, NULLIF(REGEXP_REPLACE(COALESCE(cantidad,'1'), '[^0-9]', '', 'g'), '')::int)), 0)::int AS unidades_entregadas
        FROM sst_entrega_epp
        WHERE ${eppWhere}
      `, eppVals),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(codigo_elemento),''), 'A') AS codigo,
          COALESCE(NULLIF(TRIM(elemento_epp),''), 'Elemento EPP') AS elemento,
          COUNT(*)::int AS entregas,
          COALESCE(SUM(GREATEST(1, NULLIF(REGEXP_REPLACE(COALESCE(cantidad,'1'), '[^0-9]', '', 'g'), '')::int)), 0)::int AS unidades
        FROM sst_entrega_epp
        WHERE ${eppWhere}
        GROUP BY 1, 2
        ORDER BY unidades DESC, entregas DESC
        LIMIT 12
      `, eppVals),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(dependencia),''), 'SIN DEPENDENCIA') AS dependencia,
          COUNT(*)::int AS entregas,
          COUNT(DISTINCT documento)::int AS servidores
        FROM sst_entrega_epp
        WHERE ${eppWhere}
        GROUP BY 1
        ORDER BY entregas DESC
        LIMIT 10
      `, eppVals),
      pool.query(`
        SELECT
          TO_CHAR(COALESCE(fecha_entrega, creado_en::date), 'YYYY-MM') AS mes,
          COUNT(*)::int AS entregas,
          COUNT(DISTINCT documento)::int AS servidores
        FROM sst_entrega_epp
        WHERE ${eppWhere}
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT 12
      `, eppVals),
      pool.query(`
        SELECT
          i.id_inventario,
          i.codigo_elemento,
          i.elemento_epp,
          i.categoria_epp,
          i.unidad_medida,
          i.stock_total,
          i.stock_minimo,
          i.ubicacion_bodega,
          COALESCE(e.unidades_entregadas, 0)::int AS entregados,
          GREATEST(0, i.stock_total - COALESCE(e.unidades_entregadas, 0))::int AS disponibles,
          (GREATEST(0, i.stock_total - COALESCE(e.unidades_entregadas, 0)) <= i.stock_minimo) AS bajo_stock
        FROM sst_inventario_epp i
        LEFT JOIN (
          SELECT
            codigo_elemento,
            SUM(GREATEST(1, NULLIF(REGEXP_REPLACE(COALESCE(cantidad,'1'), '[^0-9]', '', 'g'), '')::int))::int AS unidades_entregadas
          FROM sst_entrega_epp
          WHERE estado_entrega = 'Entregado'
          GROUP BY codigo_elemento
        ) e ON e.codigo_elemento = i.codigo_elemento
        ORDER BY i.id_inventario ASC
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_sociodemografico,
          COUNT(DISTINCT dependencia)::int AS dependencias_cubiertas,
          COUNT(DISTINCT sede_trabajo)::int AS sedes_cubiertas,
          ROUND(AVG(edad)::numeric, 1) AS edad_promedio
        FROM sst_perfil_sociodemografico
        WHERE ${socWhere}
      `, socVals),
      pool.query(`
        SELECT
          CASE
            WHEN edad IS NULL THEN 'Sin dato'
            WHEN edad < 30 THEN '18 a 29 años'
            WHEN edad BETWEEN 30 AND 39 THEN '30 a 39 años'
            WHEN edad BETWEEN 40 AND 49 THEN '40 a 49 años'
            WHEN edad BETWEEN 50 AND 59 THEN '50 a 59 años'
            ELSE '60 años o más'
          END AS rango,
          COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico
        WHERE ${socWhere}
        GROUP BY 1
        ORDER BY 1 ASC
      `, socVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(sexo),''), 'No especificado') AS sexo, COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico WHERE ${socWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, socVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(escolaridad),''), 'Profesional') AS escolaridad, COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico WHERE ${socWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, socVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(dependencia),''), 'SIN DEPENDENCIA') AS dependencia, COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico WHERE ${socWhere}
        GROUP BY 1 ORDER BY cantidad DESC LIMIT 10
      `, socVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(tipo_vinculacion),''), 'Carrera Administrativa') AS vinculacion, COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico WHERE ${socWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, socVals),
      pool.query(`
        SELECT COALESCE(NULLIF(TRIM(estado_civil),''), 'Soltero (a)') AS estado_civil, COUNT(*)::int AS cantidad
        FROM sst_perfil_sociodemografico WHERE ${socWhere}
        GROUP BY 1 ORDER BY cantidad DESC
      `, socVals),
    ]);

    const ep = epiStats.rows[0] || {};
    const pp = eppStats.rows[0] || {};
    const sc = socStats.rows[0] || {};
    const invRows = eppInventario.rows || [];

    const stockTotalRegistrado = invRows.reduce((s, r) => s + (r.stock_total || 0), 0);
    const stockDisponibleTotal = invRows.reduce((s, r) => s + (r.disponibles || 0), 0);
    const existenciasBajasCount = invRows.filter(r => r.bajo_stock).length;

    // Conteo semáforo de vigencias médicas (EPI-SEM-001)
    let semaforoVigentes = 0;
    let semaforoPorVencer = 0;
    let semaforoVencidos = 0;
    for (const r of (epiPorEstado.rows || [])) {
      const st = String(r.estado || '').toLowerCase();
      const cnt = parseInt(r.cantidad || 0, 10);
      if (st.includes('vigente')) semaforoVigentes += cnt;
      else if (st.includes('próximo') || st.includes('proximo') || st.includes('alerta')) semaforoPorVencer += cnt;
      else if (st.includes('vencid')) semaforoVencidos += cnt;
    }

    res.json({
      // Indicadores planos compatibles con llamadas existentes y semáforo EPI-SEM-001
      totalEmo: ep.total_emo || 0,
      emoVigentes: ep.emo_vigentes || semaforoVigentes || 0,
      emoAlertas: ep.emo_alertas || semaforoPorVencer || 0,
      vigentes: semaforoVigentes,
      porVencer: semaforoPorVencer,
      vencidos: semaforoVencidos,
      casosSeguimiento: ep.casos_seguimiento || 0,
      direccionadosPve: ep.direccionados_pve || 0,
      conCondicionesSalud: ep.con_condiciones_salud || 0,
      accidentesTrabajo: ep.accidentes_trabajo || 0,
      enfermedadesLaborales: ep.enfermedades_laborales || 0,

      totalEpp: pp.total_epp || 0,
      servidoresDotados: pp.servidores_dotados || 0,
      eppEntregados: pp.entregados || 0,
      eppPendientesReposicion: pp.pendientes_reposicion || 0,
      eppFirmados: pp.firmados || 0,
      unidadesEntregadasTotal: pp.unidades_entregadas || 0,
      stockTotalRegistrado,
      stockDisponibleTotal,
      existenciasBajasCount,

      totalSociodemografico: sc.total_sociodemografico || 0,
      dependenciasCubiertas: sc.dependencias_cubiertas || 0,
      sedesCubiertas: sc.sedes_cubiertas || 0,
      edadPromedio: Number(sc.edad_promedio || 0),

      // Objetos detallados para los 3 Dashboards interactivos (6.4, 6.5, 6.6)
      epidemiologico: {
        totalEmo: ep.total_emo || 0,
        emoVigentes: ep.emo_vigentes || semaforoVigentes || 0,
        emoAlertas: ep.emo_alertas || semaforoPorVencer || 0,
        vigentes: semaforoVigentes,
        porVencer: semaforoPorVencer,
        vencidos: semaforoVencidos,
        casosSeguimiento: ep.casos_seguimiento || 0,
        direccionadosPve: ep.direccionados_pve || 0,
        conCondicionesSalud: ep.con_condiciones_salud || 0,
        accidentesTrabajo: ep.accidentes_trabajo || 0,
        enfermedadesLaborales: ep.enfermedades_laborales || 0,
        porTipoEmo: epiPorTipo.rows,
        porEstadoCaso: epiPorEstado.rows,
        porPve: epiPorPve.rows,
        porDependencia: epiPorDep.rows,
        evolucionMensual: epiPorMes.rows,
      },
      epp: {
        totalEpp: pp.total_epp || 0,
        servidoresDotados: pp.servidores_dotados || 0,
        eppEntregados: pp.entregados || 0,
        eppPendientesReposicion: pp.pendientes_reposicion || 0,
        eppFirmados: pp.firmados || 0,
        unidadesEntregadasTotal: pp.unidades_entregadas || 0,
        stockTotalRegistrado,
        stockDisponibleTotal,
        existenciasBajasCount,
        inventarioDetalle: invRows,
        porElemento: eppPorElem.rows,
        porDependencia: eppPorDep.rows,
        evolucionMensual: eppPorMes.rows,
      },
      sociodemografico: {
        totalSociodemografico: sc.total_sociodemografico || 0,
        dependenciasCubiertas: sc.dependencias_cubiertas || 0,
        sedesCubiertas: sc.sedes_cubiertas || 0,
        edadPromedio: Number(sc.edad_promedio || 0),
        porRangoEdad: socPorEdad.rows,
        porSexo: socPorSexo.rows,
        porEscolaridad: socPorEsc.rows,
        porDependencia: socPorDep.rows,
        porVinculacion: socPorVinculacion.rows,
        porEstadoCivil: socPorEstadoCivil.rows,
      },
    });
  } catch (err) {
    console.error('[sst-service] stats error:', err.message);
    res.status(500).json({ error: 'Error al cargar estadísticas de SST.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 1: PERFIL EPIDEMIOLÓGICO Y EMO (Formato E-DO-ST-F-024 V3)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/epidemiologico', auth, async (req, res) => {
  const { q = '', tipoEmo = '', estadoCaso = '', dependencia = '', fechaInicio = '', fechaFin = '', page = 1, limit = 20 } = req.query;
  try {
    const perm = await getModulePermission(pool, req.user, 'epidemiologico');
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    // Protección de datos sensibles (Ley 1581 de 2012 / Sección 12 y RBAC Sección 7):
    // Sandra Roa (Responsable SST) y Administrador consultan todos los perfiles;
    // el Funcionario solo consulta su propio registro epidemiológico/EMO.
    if (!perm.canManage) {
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      const uname = String(req.user.username || '').trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(nombre_completo, '')) = $${idx}
        OR ($${idx + 1} <> '' AND documento = $${idx + 1})
        OR LOWER(COALESCE(creado_por, '')) = $${idx + 2}
      )`);
      params.push(fullName, userDoc, uname);
      idx += 3;
    }

    if (tipoEmo && tipoEmo !== 'Todos') {
      conditions.push(`LOWER(tipo_emo) = LOWER($${idx++})`);
      params.push(tipoEmo.trim());
    }
    if (estadoCaso && estadoCaso !== 'Todos') {
      conditions.push(`LOWER(estado_final_caso) = LOWER($${idx++})`);
      params.push(estadoCaso.trim());
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (fechaInicio) {
      conditions.push(`COALESCE(fecha_emo, creado_en::date) >= $${idx++}::date`);
      params.push(fechaInicio);
    }
    if (fechaFin) {
      conditions.push(`COALESCE(fecha_emo, creado_en::date) <= $${idx++}::date`);
      params.push(fechaFin);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(dependencia) LIKE LOWER($${idx})
        OR LOWER(COALESCE(direccionado_pve, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(restricciones, '')) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_perfil_epidemiologico WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_perfil_epidemiologico WHERE ${where} ORDER BY id_epidemiologico DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(mapEpiRow),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      permission: perm
    });
  } catch (err) {
    console.error('[sst-service] list epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al listar el Perfil Epidemiológico.' });
  }
});

router.post('/epidemiologico', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Epidemiológico (Sandra Roa) o el Administrador pueden crear registros.' });
  }
  const b = req.body;
  if (!b.documento || (!b.nombreCompleto && (!b.apellidos || !b.nombres))) {
    return res.status(400).json({ error: 'El documento y nombre del servidor público son obligatorios.' });
  }

  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const fechaEmo = toIsoDateOrNull(b.fechaEmo) || new Date().toISOString().split('T')[0];
  const tipoEmo = b.tipoEmo || 'Periódico';
  const fechaProximoEmo = toIsoDateOrNull(b.fechaProximoEmo) || (tipoEmo === 'Egreso' ? null : addOneYear(fechaEmo));

  try {
    const r = await pool.query(
      `INSERT INTO sst_perfil_epidemiologico (
        tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
        fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
        restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
        accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
        enfermedad_laboral, fecha_enfermedad, estado_actual_enfermedad,
        estado_final_caso, actividades_pendientes, soporte, creado_por
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
      ) RETURNING *`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento).trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.telefono || '',
        parseInt(b.edad) || null,
        b.fechaIngreso || '',
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || 'PROFESIONAL UNIVERSITARIO'),
        fechaEmo,
        tipoEmo,
        b.restricciones || 'NINGUNA',
        b.recomendaciones || 'Pausas activas e higiene postural',
        b.direccionadoPve || 'No aplica',
        b.direccionadoEps || 'No aplica',
        fechaProximoEmo,
        upper(b.accidenteTrabajo || 'NO'),
        toIsoDateOrNull(b.fechaAccidente),
        b.estadoActualAccidente || '',
        upper(b.cumplioRehabilitacion || 'N/A'),
        upper(b.enfermedadLaboral || 'NO'),
        toIsoDateOrNull(b.fechaEnfermedad),
        b.estadoActualEnfermedad || '',
        b.estadoFinalCaso || 'Vigente',
        b.actividadesPendientes || '',
        b.soporte || null,
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_epidemiologico;
    const radicado = `EMO-2026-${String(newId).padStart(4, '0')}`;
    await pool.query(
      `INSERT INTO sst_historial (submodulo, id_registro, accion, detalle, realizado_por)
       VALUES ('epidemiologico', $1, 'Creación EMO', $2, $3)`,
      [newId, `Registro de EMO (${tipoEmo}) para ${nombreCompleto}`, req.user.username || 'admin']
    );

    await logAudit(pool, {
      modulo: 'epidemiologico',
      idRegistro: newId,
      radicado,
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapEpiRow(r.rows[0]),
      observaciones: `Creación de registro EMO (${tipoEmo}) para ${nombreCompleto}`,
    });

    res.status(201).json({
      message: 'Registro epidemiológico creado exitosamente.',
      id: newId,
      radicado
    });
  } catch (err) {
    console.error('[sst-service] create epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al crear el registro epidemiológico.' });
  }
});

router.put('/epidemiologico/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Epidemiológico (Sandra Roa) o el Administrador pueden editar registros.' });
  }
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });

  const prevRes = await pool.query('SELECT * FROM sst_perfil_epidemiologico WHERE id_epidemiologico=$1', [id]);
  if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
  const prevRow = prevRes.rows[0];

  const b = req.body;
  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const fechaEmo = toIsoDateOrNull(b.fechaEmo);
  const fechaProximoEmo = toIsoDateOrNull(b.fechaProximoEmo);

  try {
    const r = await pool.query(
      `UPDATE sst_perfil_epidemiologico SET
        tipo_identificacion=$1, documento=$2, apellidos=$3, nombres=$4, nombre_completo=$5,
        telefono=$6, edad=$7, fecha_ingreso=$8, dependencia=$9, sede_trabajo=$10, cargo=$11,
        fecha_emo=$12, tipo_emo=$13, restricciones=$14, recomendaciones=$15,
        direccionado_pve=$16, direccionado_eps=$17, fecha_proximo_emo=$18,
        accidente_trabajo=$19, fecha_accidente=$20, estado_actual_accidente=$21,
        cumplio_rehabilitacion=$22, enfermedad_laboral=$23, fecha_enfermedad=$24,
        estado_actual_enfermedad=$25, estado_final_caso=$26, actividades_pendientes=$27,
        soporte=COALESCE($28, soporte), actualizado_en=CURRENT_TIMESTAMP
       WHERE id_epidemiologico=$29 RETURNING *`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento || '').trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.telefono || '',
        parseInt(b.edad) || null,
        b.fechaIngreso || '',
        b.dependencia || '',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || ''),
        fechaEmo,
        b.tipoEmo || 'Periódico',
        b.restricciones || 'NINGUNA',
        b.recomendaciones || '',
        b.direccionadoPve || 'No aplica',
        b.direccionadoEps || 'No aplica',
        fechaProximoEmo,
        upper(b.accidenteTrabajo || 'NO'),
        toIsoDateOrNull(b.fechaAccidente),
        b.estadoActualAccidente || '',
        upper(b.cumplioRehabilitacion || 'N/A'),
        upper(b.enfermedadLaboral || 'NO'),
        toIsoDateOrNull(b.fechaEnfermedad),
        b.estadoActualEnfermedad || '',
        b.estadoFinalCaso || 'Vigente',
        b.actividadesPendientes || '',
        b.soporte !== undefined ? b.soporte : null,
        id
      ]
    );

    await pool.query(
      `INSERT INTO sst_historial (submodulo, id_registro, accion, detalle, realizado_por)
       VALUES ('epidemiologico', $1, 'Actualización', $2, $3)`,
      [id, `Actualizado estado: ${b.estadoFinalCaso || 'Vigente'}`, req.user.username || 'admin']
    );

    await logAudit(pool, {
      modulo: 'epidemiologico',
      idRegistro: id,
      radicado: `EMO-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: prevRow.estado_final_caso !== r.rows[0].estado_final_caso ? 'CAMBIO_ESTADO' : 'MODIFICACION',
      valoresAnteriores: mapEpiRow(prevRow),
      valoresNuevos: mapEpiRow(r.rows[0]),
      observaciones: `Actualización de Perfil Epidemiológico (${nombreCompleto})`,
    });

    res.json({ message: 'Registro epidemiológico actualizado correctamente.' });
  } catch (err) {
    console.error('[sst-service] update epidemiologico error:', err.message);
    res.status(500).json({ error: 'Error al actualizar registro epidemiológico.' });
  }
});

router.patch('/epidemiologico/:id/status', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Epidemiológico o el Administrador pueden cambiar estados.' });
  }
  const id = parseInt(req.params.id, 10);
  const { estadoFinalCaso, actividadesPendientes } = req.body;
  try {
    const prevRes = await pool.query('SELECT * FROM sst_perfil_epidemiologico WHERE id_epidemiologico=$1', [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const prevRow = prevRes.rows[0];

    const r = await pool.query(
      `UPDATE sst_perfil_epidemiologico
       SET estado_final_caso = $1,
           actividades_pendientes = CASE WHEN $2 <> '' THEN $2 ELSE actividades_pendientes END,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id_epidemiologico = $3 RETURNING *`,
      [estadoFinalCaso || 'Vigente', (actividadesPendientes || '').trim(), id]
    );

    await logAudit(pool, {
      modulo: 'epidemiologico',
      idRegistro: id,
      radicado: `EMO-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: 'CAMBIO_ESTADO',
      valoresAnteriores: { estadoFinalCaso: prevRow.estado_final_caso, actividadesPendientes: prevRow.actividades_pendientes },
      valoresNuevos: { estadoFinalCaso: r.rows[0].estado_final_caso, actividadesPendientes: r.rows[0].actividades_pendientes },
      observaciones: `Cambio de estado del caso EMO de "${prevRow.estado_final_caso}" a "${r.rows[0].estado_final_caso}"`,
    });

    res.json({ message: 'Estado del caso SST actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado del caso.' });
  }
});

router.post('/epidemiologico/check-vencimientos', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable de SST o el Administrador pueden ejecutar la verificación de vencimientos.' });
  }
  try {
    const expired = await pool.query(`
      UPDATE sst_perfil_epidemiologico
      SET estado_final_caso = 'Vencido', actualizado_en = CURRENT_TIMESTAMP
      WHERE fecha_proximo_emo IS NOT NULL
        AND fecha_proximo_emo < CURRENT_DATE
        AND estado_final_caso NOT IN ('Cerrado', 'Vencido')
      RETURNING id_epidemiologico
    `);

    const soon = await pool.query(`
      UPDATE sst_perfil_epidemiologico
      SET estado_final_caso = 'Próximo a Vencer', actualizado_en = CURRENT_TIMESTAMP
      WHERE fecha_proximo_emo IS NOT NULL
        AND fecha_proximo_emo >= CURRENT_DATE
        AND fecha_proximo_emo <= CURRENT_DATE + INTERVAL '30 days'
        AND estado_final_caso = 'Vigente'
      RETURNING id_epidemiologico
    `);

    res.json({
      message: `Verificación completada: ${expired.rowCount} EMOs vencidos y ${soon.rowCount} próximos a vencer detectados.`,
      vencidos: expired.rowCount,
      proximos: soon.rowCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar vencimientos de EMO.' });
  }
});

router.post('/epidemiologico/bulk', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canImport) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Epidemiológico (Sandra Roa) o el Administrador pueden importar registros masivamente.' });
  }
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron filas para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT documento, COALESCE(TO_CHAR(fecha_emo, 'YYYY-MM-DD'), '') AS f_emo, LOWER(COALESCE(tipo_emo, '')) AS t_emo
         FROM sst_perfil_epidemiologico`
    );
    const seenKeys = new Set(
      existingRes.rows.map(r => `${String(r.documento).trim()}|${r.f_emo}|${r.t_emo}`)
    );

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const filaExcel = r._rowNum || (i + 2);
      const doc = String(r.documento || r['NÚMERO DOCUMENTO DE IDENTIFICACIÓN'] || r['Cédula'] || '').trim();
      const nom = upper(r.nombreCompleto || `${r.apellidos || ''} ${r.nombres || ''}`.trim());
      if (!doc || !nom) {
        errors.push({
          fila: filaExcel,
          columna: !doc ? 'NÚMERO DOCUMENTO DE IDENTIFICACIÓN' : 'APELLIDOS Y NOMBRES',
          motivo: 'El documento y nombre completo son obligatorios.'
        });
        skipped++;
        continue;
      }
      const fechaEmo = toIsoDateOrNull(r.fechaEmo) || new Date().toISOString().split('T')[0];
      const tipoEmo = r.tipoEmo || 'Periódico';
      const dupKey = `${doc}|${fechaEmo}|${String(tipoEmo).toLowerCase()}`;
      if (seenKeys.has(dupKey)) {
        errors.push({
          fila: filaExcel,
          columna: 'DOCUMENTO / FECHA EMO',
          motivo: `Registro duplicado para documento ${doc} con fecha EMO ${fechaEmo} (${tipoEmo}).`
        });
        skipped++;
        continue;
      }
      seenKeys.add(dupKey);

      const fechaProx = toIsoDateOrNull(r.fechaProximoEmo) || addOneYear(fechaEmo);

      await client.query(
        `INSERT INTO sst_perfil_epidemiologico (
          tipo_identificacion, documento, apellidos, nombres, nombre_completo, telefono, edad,
          fecha_ingreso, dependencia, sede_trabajo, cargo, fecha_emo, tipo_emo,
          restricciones, recomendaciones, direccionado_pve, direccionado_eps, fecha_proximo_emo,
          accidente_trabajo, fecha_accidente, estado_actual_accidente, cumplio_rehabilitacion,
          enfermedad_laboral, fecha_enfermedad, estado_actual_enfermedad,
          estado_final_caso, actividades_pendientes, creado_por
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
        )`,
        [
          r.tipoIdentificacion || 'Cédula de Ciudadanía',
          doc,
          upper(r.apellidos || (nom.split(' ').length > 2 ? nom.split(' ').slice(0, 2).join(' ') : nom.split(' ').slice(0, 1).join(' '))),
          upper(r.nombres || (nom.split(' ').length > 2 ? nom.split(' ').slice(2).join(' ') : nom.split(' ').slice(1).join(' ') || nom)),
          nom,
          r.telefono || '',
          parseInt(r.edad) || null,
          r.fechaIngreso || '',
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
          r.sedeTrabajo || 'CASA DE LA TORRE',
          upper(r.cargo || 'PROFESIONAL UNIVERSITARIO'),
          fechaEmo,
          tipoEmo,
          r.restricciones || 'NINGUNA',
          r.recomendaciones || 'Pausas activas e higiene postural',
          r.direccionadoPve || 'No aplica',
          r.direccionadoEps || 'No aplica',
          fechaProx,
          upper(r.accidenteTrabajo || 'NO'),
          toIsoDateOrNull(r.fechaAccidente),
          r.estadoActualAccidente || 'No aplica',
          upper(r.cumplioRehabilitacion || 'N/A'),
          upper(r.enfermedadLaboral || 'NO'),
          toIsoDateOrNull(r.fechaEnfermedad),
          r.estadoActualEnfermedad || 'No aplica',
          r.estadoFinalCaso || 'Vigente',
          r.actividadesPendientes || '',
          req.user.username || 'admin'
        ]
      );
      inserted++;
    }

    await logAudit(client, {
      modulo: 'epidemiologico',
      idRegistro: `BULK-${Date.now()}`,
      radicado: 'IMPORT-EMO',
      user: req.user,
      tipoOperacion: 'IMPORTACION_MASIVA',
      valoresAnteriores: null,
      valoresNuevos: { totalRecibidos: rows.length, insertados: inserted, omitidos: skipped },
      observaciones: `Importación masiva Formato E-DO-ST-F-024: ${inserted} insertados, ${skipped} omitidos/duplicados.`,
    });

    await client.query('COMMIT');
    res.json({
      message: `Se importaron ${inserted} registros al Perfil Epidemiológico (${skipped} omitidos/duplicados).`,
      inserted,
      skipped,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de Perfil Epidemiológico.' });
  } finally {
    client.release();
  }
});

router.delete('/epidemiologico/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epidemiologico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Epidemiológico o el Administrador pueden eliminar registros.' });
  }
  const id = parseInt(req.params.id, 10);
  try {
    const prevRes = await pool.query('SELECT * FROM sst_perfil_epidemiologico WHERE id_epidemiologico=$1', [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const prevRow = prevRes.rows[0];

    await pool.query('DELETE FROM sst_perfil_epidemiologico WHERE id_epidemiologico=$1', [id]);

    await logAudit(pool, {
      modulo: 'epidemiologico',
      idRegistro: id,
      radicado: `EMO-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: 'ELIMINACION',
      valoresAnteriores: mapEpiRow(prevRow),
      valoresNuevos: null,
      observaciones: `Eliminación de registro EMO-2026-${String(id).padStart(4, '0')} (${prevRow.nombre_completo})`,
    });

    res.json({ message: 'Registro eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar registro.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 2: ENTREGA DE EPP E INVENTARIO (Formato E-DO-ST-F-028 V4)
// ═════════════════════════════════════════════════════════════════════════════

// Consultar inventario y existencias de los 28 elementos de EPP (Sección 6.6)
router.get('/epp/inventario', auth, async (req, res) => {
  try {
    const perm = await getModulePermission(pool, req.user, 'epp');
    const r = await pool.query(`
      SELECT
        i.id_inventario,
        i.codigo_elemento,
        i.elemento_epp,
        i.categoria_epp,
        i.unidad_medida,
        i.stock_total,
        i.stock_minimo,
        i.ubicacion_bodega,
        i.observaciones,
        i.actualizado_por,
        i.actualizado_en,
        COALESCE(e.unidades_entregadas, 0)::int AS entregados,
        GREATEST(0, i.stock_total - COALESCE(e.unidades_entregadas, 0))::int AS disponibles,
        (GREATEST(0, i.stock_total - COALESCE(e.unidades_entregadas, 0)) <= i.stock_minimo) AS bajo_stock
      FROM sst_inventario_epp i
      LEFT JOIN (
        SELECT
          codigo_elemento,
          SUM(GREATEST(1, NULLIF(REGEXP_REPLACE(COALESCE(cantidad,'1'), '[^0-9]', '', 'g'), '')::int))::int AS unidades_entregadas
        FROM sst_entrega_epp
        WHERE estado_entrega = 'Entregado'
        GROUP BY codigo_elemento
      ) e ON e.codigo_elemento = i.codigo_elemento
      ORDER BY i.id_inventario ASC
    `);
    res.json({ data: r.rows, permission: perm });
  } catch (err) {
    console.error('[sst-service] get inventario epp error:', err.message);
    res.status(500).json({ error: 'Error al consultar inventario de EPP.' });
  }
});

// Actualizar stock total y umbral de alerta de un elemento EPP (Solo Sandra Roa / Admin)
router.put('/epp/inventario/:codigo', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epp');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de EPP (Sandra Roa) o el Administrador pueden actualizar el inventario de existencias.' });
  }
  const codigo = String(req.params.codigo || '').trim().toUpperCase();
  const { stockTotal, stockMinimo, ubicacionBodega, observaciones } = req.body;

  try {
    const prevRes = await pool.query('SELECT * FROM sst_inventario_epp WHERE codigo_elemento = $1', [codigo]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Elemento EPP no encontrado en el inventario.' });
    const prev = prevRes.rows[0];

    const nuevoTotal = Math.max(0, parseInt(stockTotal, 10) || 0);
    const nuevoMin = Math.max(0, parseInt(stockMinimo, 10) || 0);

    const upd = await pool.query(
      `UPDATE sst_inventario_epp
          SET stock_total = $1,
              stock_minimo = $2,
              ubicacion_bodega = COALESCE($3, ubicacion_bodega),
              observaciones = COALESCE($4, observaciones),
              actualizado_por = $5,
              actualizado_en = CURRENT_TIMESTAMP
        WHERE codigo_elemento = $6
        RETURNING *`,
      [nuevoTotal, nuevoMin, ubicacionBodega || null, observaciones !== undefined ? observaciones : null, req.user.username || 'sandra.roa', codigo]
    );

    await logAudit(pool, {
      modulo: 'epp',
      idRegistro: upd.rows[0].id_inventario,
      radicado: `INV-EPP-${codigo}`,
      user: req.user,
      tipoOperacion: 'INVENTARIO_EPP',
      valoresAnteriores: { stock_total: prev.stock_total, stock_minimo: prev.stock_minimo },
      valoresNuevos: { stock_total: nuevoTotal, stock_minimo: nuevoMin },
      observaciones: `Actualización de existencias de "${prev.elemento_epp}": Stock Total ${prev.stock_total} -> ${nuevoTotal}, Mínimo ${prev.stock_minimo} -> ${nuevoMin}`,
    });

    res.json({ message: 'Existencias de EPP actualizadas correctamente.', data: upd.rows[0] });
  } catch (err) {
    console.error('[sst-service] update inventario epp error:', err.message);
    res.status(500).json({ error: 'Error al actualizar existencias de EPP.' });
  }
});

router.get('/epp', auth, async (req, res) => {
  const { q = '', elemento = '', estado = '', dependencia = '', fechaInicio = '', fechaFin = '', page = 1, limit = 20 } = req.query;
  try {
    const perm = await getModulePermission(pool, req.user, 'epp');
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    // RBAC: Funcionario solo consulta sus propias entregas de EPP; Sandra Roa y Admin gestionan todo el módulo.
    if (!perm.canManage) {
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      const uname = String(req.user.username || '').trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(nombre_completo, '')) = $${idx}
        OR ($${idx + 1} <> '' AND documento = $${idx + 1})
        OR LOWER(COALESCE(creado_por, '')) = $${idx + 2}
      )`);
      params.push(fullName, userDoc, uname);
      idx += 3;
    }

    if (elemento && elemento !== 'Todos') {
      conditions.push(`(codigo_elemento = $${idx} OR LOWER(elemento_epp) LIKE LOWER($${idx + 1}))`);
      params.push(elemento.trim(), `%${elemento.trim()}%`);
      idx += 2;
    }
    if (estado && estado !== 'Todos') {
      conditions.push(`LOWER(estado_entrega) = LOWER($${idx++})`);
      params.push(estado.trim());
    }
    if (dependencia && dependencia !== 'Todas') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (fechaInicio) {
      conditions.push(`COALESCE(fecha_entrega, creado_en::date) >= $${idx++}::date`);
      params.push(fechaInicio);
    }
    if (fechaFin) {
      conditions.push(`COALESCE(fecha_entrega, creado_en::date) <= $${idx++}::date`);
      params.push(fechaFin);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(elemento_epp) LIKE LOWER($${idx})
        OR LOWER(dependencia) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_entrega_epp WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_entrega_epp WHERE ${where} ORDER BY id_entrega_epp DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(mapEppRow),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      permission: perm
    });
  } catch (err) {
    console.error('[sst-service] list epp error:', err.message);
    res.status(500).json({ error: 'Error al listar entregas de EPP.' });
  }
});

router.post('/epp', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epp');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Entrega de EPP (Sandra Roa) o el Administrador pueden registrar entregas.' });
  }
  const b = req.body;
  if (!b.documento || !b.nombreCompleto) {
    return res.status(400).json({ error: 'Documento y nombre completo son obligatorios.' });
  }

  const resolved = resolveEppItem(b.elementoEpp || b.codigoElemento);
  const elementoFinal = b.elementoEpp ? String(b.elementoEpp).trim() : resolved.nombre;
  const fechaEntrega = toIsoDateOrNull(b.fechaEntrega) || new Date().toISOString().split('T')[0];

  const firmaDigital = b.firmaDigital || b.firma_digital || null;
  const firmadoFuncionario = firmaDigital ? true : (b.firmadoFuncionario !== false);

  try {
    const r = await pool.query(
      `INSERT INTO sst_entrega_epp (
        documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo,
        cargo, tipo_vinculacion, restricciones_recomendaciones, codigo_elemento,
        elemento_epp, talla, cantidad, fecha_entrega, estado_entrega,
        firmado_funcionario, observaciones, soporte, firma_digital, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        String(b.documento).trim(),
        upper(b.nombreCompleto),
        b.telefono || '',
        upper(b.secretaria || 'SECRETARIA GENERAL'),
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || 'PROFESIONAL UNIVERSITARIO'),
        upper(b.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
        b.restriccionesRecomendaciones || 'NINGUNA',
        resolved.codigo,
        elementoFinal,
        upper(b.talla || 'N/A'),
        upper(b.cantidad || '1 UNIDAD'),
        fechaEntrega,
        b.estadoEntrega || 'Entregado',
        firmadoFuncionario,
        b.observaciones || '',
        b.soporte || null,
        firmaDigital,
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_entrega_epp;
    const radicado = `EPP-2026-${String(newId).padStart(4, '0')}`;

    await logAudit(pool, {
      modulo: 'epp',
      idRegistro: newId,
      radicado,
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapEppRow(r.rows[0]),
      observaciones: `Entrega de EPP (${elementoFinal}) a ${upper(b.nombreCompleto)}`,
    });

    res.status(201).json({
      message: 'Entrega de EPP registrada exitosamente.',
      id: newId,
      radicado
    });
  } catch (err) {
    console.error('[sst-service] create epp error:', err.message);
    res.status(500).json({ error: 'Error al registrar entrega de EPP.' });
  }
});

router.put('/epp/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epp');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Entrega de EPP (Sandra Roa) o el Administrador pueden editar entregas.' });
  }
  const id = parseInt(req.params.id, 10);
  const prevRes = await pool.query('SELECT * FROM sst_entrega_epp WHERE id_entrega_epp=$1', [id]);
  if (!prevRes.rows.length) return res.status(404).json({ error: 'Entrega de EPP no encontrada.' });
  const prevRow = prevRes.rows[0];

  const b = req.body;
  const resolved = resolveEppItem(b.elementoEpp || b.codigoElemento);
  const elementoFinal = b.elementoEpp ? String(b.elementoEpp).trim() : resolved.nombre;
  const fechaEntrega = toIsoDateOrNull(b.fechaEntrega) || new Date().toISOString().split('T')[0];

  try {
    const r = await pool.query(
      `UPDATE sst_entrega_epp SET
        documento=$1, nombre_completo=$2, telefono=$3, secretaria=$4, dependencia=$5,
        sede_trabajo=$6, cargo=$7, tipo_vinculacion=$8, restricciones_recomendaciones=$9,
        codigo_elemento=$10, elemento_epp=$11, talla=$12, cantidad=$13, fecha_entrega=$14,
        estado_entrega=$15, firmado_funcionario=$16, observaciones=$17,
        soporte=COALESCE($18, soporte),
        firma_digital=CASE WHEN $19 IS NOT NULL AND $19 != '' THEN $19 ELSE firma_digital END
       WHERE id_entrega_epp=$20 RETURNING *`,
      [
        String(b.documento || '').trim(),
        upper(b.nombreCompleto),
        b.telefono || '',
        upper(b.secretaria || 'SECRETARIA GENERAL'),
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        upper(b.cargo || 'PROFESIONAL UNIVERSITARIO'),
        upper(b.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
        b.restriccionesRecomendaciones || 'NINGUNA',
        resolved.codigo,
        elementoFinal,
        upper(b.talla || 'N/A'),
        upper(b.cantidad || '1 UNIDAD'),
        fechaEntrega,
        b.estadoEntrega || 'Entregado',
        (b.firmaDigital || b.firma_digital) ? true : (b.firmadoFuncionario !== false),
        b.observaciones || '',
        b.soporte !== undefined ? b.soporte : null,
        b.firmaDigital || b.firma_digital || null,
        id
      ]
    );

    await logAudit(pool, {
      modulo: 'epp',
      idRegistro: id,
      radicado: `EPP-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: prevRow.estado_entrega !== r.rows[0].estado_entrega ? 'CAMBIO_ESTADO' : 'MODIFICACION',
      valoresAnteriores: mapEppRow(prevRow),
      valoresNuevos: mapEppRow(r.rows[0]),
      observaciones: `Actualización de entrega de EPP (${elementoFinal}) para ${upper(b.nombreCompleto)}`,
    });

    res.json({ message: 'Entrega de EPP actualizada exitosamente.' });
  } catch (err) {
    console.error('[sst-service] update epp error:', err.message);
    res.status(500).json({ error: 'Error al actualizar entrega de EPP: ' + err.message });
  }
});

router.post('/epp/bulk', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epp');
  if (!perm.canImport) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Entrega de EPP (Sandra Roa) o el Administrador pueden importar entregas masivamente.' });
  }
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT documento, codigo_elemento, COALESCE(TO_CHAR(fecha_entrega, 'YYYY-MM-DD'), '') AS f_ent
         FROM sst_entrega_epp`
    );
    const seenKeys = new Set(
      existingRes.rows.map(r => `${String(r.documento).trim()}|${r.codigo_elemento}|${r.f_ent}`)
    );

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const filaExcel = r._rowNum || (i + 2);
      const doc = String(r.documento || '').trim();
      const nom = upper(r.nombreCompleto || '');
      if (!doc || !nom) {
        errors.push({
          fila: filaExcel,
          columna: !doc ? 'CÉDULA' : 'FUNCIONARIO',
          motivo: 'El número de cédula y el nombre del funcionario son obligatorios.'
        });
        skipped++;
        continue;
      }
      const resolved = resolveEppItem(r.elementoEpp || r.codigoElemento);
      const elementoFinal = r.elementoEpp ? String(r.elementoEpp).trim() : resolved.nombre;
      const fechaEntrega = toIsoDateOrNull(r.fechaEntrega) || new Date().toISOString().split('T')[0];

      const dupKey = `${doc}|${resolved.codigo}|${fechaEntrega}`;
      if (seenKeys.has(dupKey)) {
        errors.push({
          fila: filaExcel,
          columna: 'CÉDULA / ELEMENTO EPP / FECHA',
          motivo: `Entrega duplicada del elemento ${resolved.codigo} (${elementoFinal}) para documento ${doc} en fecha ${fechaEntrega}.`
        });
        skipped++;
        continue;
      }
      seenKeys.add(dupKey);

      await client.query(
        `INSERT INTO sst_entrega_epp (
          documento, nombre_completo, telefono, secretaria, dependencia, sede_trabajo,
          cargo, tipo_vinculacion, restricciones_recomendaciones, codigo_elemento,
          elemento_epp, talla, cantidad, fecha_entrega, estado_entrega, observaciones, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          doc, nom, r.telefono || '', upper(r.secretaria || 'SECRETARIA GENERAL'),
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)', r.sedeTrabajo || 'CASA DE LA TORRE',
          upper(r.cargo || 'PROFESIONAL UNIVERSITARIO'), upper(r.tipoVinculacion || 'CARRERA ADMINISTRATIVA'),
          r.restriccionesRecomendaciones || 'NINGUNA', resolved.codigo, elementoFinal,
          upper(r.talla || 'N/A'), upper(r.cantidad || '1 UNIDAD'), fechaEntrega,
          r.estadoEntrega || 'Entregado', r.observaciones || '', req.user.username || 'admin'
        ]
      );
      inserted++;
    }

    await logAudit(client, {
      modulo: 'epp',
      idRegistro: `BULK-${Date.now()}`,
      radicado: 'IMPORT-EPP',
      user: req.user,
      tipoOperacion: 'IMPORTACION_MASIVA',
      valoresAnteriores: null,
      valoresNuevos: { totalRecibidos: rows.length, insertados: inserted, omitidos: skipped },
      observaciones: `Importación masiva Formato E-DO-ST-F-028: ${inserted} insertados, ${skipped} omitidos/duplicados.`,
    });

    await client.query('COMMIT');
    res.json({
      message: `Se importaron ${inserted} entregas de EPP exitosamente (${skipped} omitidas/duplicadas).`,
      inserted,
      skipped,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de EPP.' });
  } finally {
    client.release();
  }
});

router.delete('/epp/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'epp');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Entrega de EPP o el Administrador pueden eliminar registros.' });
  }
  const id = parseInt(req.params.id, 10);
  try {
    const prevRes = await pool.query('SELECT * FROM sst_entrega_epp WHERE id_entrega_epp=$1', [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const prevRow = prevRes.rows[0];

    await pool.query('DELETE FROM sst_entrega_epp WHERE id_entrega_epp=$1', [id]);

    await logAudit(pool, {
      modulo: 'epp',
      idRegistro: id,
      radicado: `EPP-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: 'ELIMINACION',
      valoresAnteriores: mapEppRow(prevRow),
      valoresNuevos: null,
      observaciones: `Eliminación de entrega EPP-2026-${String(id).padStart(4, '0')} (${prevRow.elemento_epp} - ${prevRow.nombre_completo})`,
    });

    res.json({ message: 'Registro de EPP eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar entrega de EPP.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMÓDULO 3: PERFIL SOCIODEMOGRÁFICO (Formato E-DO-ST-F-011 V5)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/sociodemografico', auth, async (req, res) => {
  const { q = '', escolaridad = '', tipoVinculacion = '', dependencia = '', sexo = '', page = 1, limit = 20 } = req.query;
  try {
    const perm = await getModulePermission(pool, req.user, 'sociodemografico');
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    // RBAC: Funcionario solo consulta su propio registro individual en la tabla; Sandra Roa y Admin gestionan todo el módulo.
    if (!perm.canManage) {
      const fullName = String(req.user.name || '').trim().toLowerCase();
      const userDoc = String(req.user.documento || '').trim();
      const uname = String(req.user.username || '').trim().toLowerCase();
      conditions.push(`(
        LOWER(COALESCE(nombre_completo, '')) = $${idx}
        OR ($${idx + 1} <> '' AND documento = $${idx + 1})
        OR LOWER(COALESCE(creado_por, '')) = $${idx + 2}
      )`);
      params.push(fullName, userDoc, uname);
      idx += 3;
    }

    if (escolaridad && escolaridad !== 'Todas' && escolaridad !== 'Todos') {
      conditions.push(`LOWER(escolaridad) = LOWER($${idx++})`);
      params.push(escolaridad.trim());
    }
    if (tipoVinculacion && tipoVinculacion !== 'Todos' && tipoVinculacion !== 'Todas') {
      conditions.push(`LOWER(tipo_vinculacion) = LOWER($${idx++})`);
      params.push(tipoVinculacion.trim());
    }
    if (sexo && sexo !== 'Todos' && sexo !== 'Todas') {
      conditions.push(`LOWER(sexo) = LOWER($${idx++})`);
      params.push(sexo.trim());
    }
    if (dependencia && dependencia !== 'Todas' && dependencia !== 'Todos') {
      conditions.push(`LOWER(dependencia) LIKE LOWER($${idx++})`);
      params.push(`%${dependencia.trim()}%`);
    }
    if (q && q.trim()) {
      conditions.push(`(
        LOWER(nombre_completo) LIKE LOWER($${idx})
        OR documento LIKE $${idx}
        OR LOWER(dependencia) LIKE LOWER($${idx})
        OR LOWER(COALESCE(ocupacion_profesion, '')) LIKE LOWER($${idx})
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const totalRes = await pool.query(`SELECT COUNT(*) FROM sst_perfil_sociodemografico WHERE ${where}`, params);
    const total = parseInt(totalRes.rows[0].count) || 0;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const rows = await pool.query(
      `SELECT * FROM sst_perfil_sociodemografico WHERE ${where} ORDER BY id_sociodemografico DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      data: rows.rows.map(mapSocioRow),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      permission: perm
    });
  } catch (err) {
    console.error('[sst-service] list sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al listar el Perfil Sociodemográfico.' });
  }
});

router.post('/sociodemografico', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'sociodemografico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Sociodemográfico (Sandra Roa) o el Administrador pueden crear registros.' });
  }
  const b = req.body;
  if (!b.documento || (!b.nombreCompleto && (!b.apellidos || !b.nombres))) {
    return res.status(400).json({ error: 'Documento y nombre son obligatorios.' });
  }

  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const currentYear = new Date().getFullYear();
  const anioNac = parseInt(b.anioNacimiento) || null;
  const edad = parseInt(b.edad) || (anioNac ? currentYear - anioNac : null);

  try {
    const r = await pool.query(
      `INSERT INTO sst_perfil_sociodemografico (
        tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
        anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
        tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
        escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
        tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
        dependencia, sede_trabajo, creado_por
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING *`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento).trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.sexo || 'Masculino',
        anioNac,
        edad,
        b.razaEtnia || 'Blanco/Mestizo',
        b.estadoCivil || 'Soltero (a)',
        b.composicionFamiliar || 'Conyuge Permanente, Hijos',
        b.tipoVivienda || 'Arriendo',
        String(b.estrato || '3'),
        b.municipioResidencia || 'Tunja',
        b.municipioTrabajo || 'Tunja',
        b.escolaridad || 'Profesional',
        b.ocupacionProfesion || '',
        b.rangoIngresos || 'Entre 3 y 6 SMMLV',
        b.denominacionCargo || 'Profesional Universitario',
        b.tipoCargo || 'Profesional',
        b.tipoVinculacion || 'Carrera Administrativa',
        b.antiguedadCargo || 'Entre 1 y 4 años',
        b.antiguedadEntidad || 'Entre 1 y 4 años',
        b.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        req.user.username || 'admin'
      ]
    );

    const newId = r.rows[0].id_sociodemografico;
    const radicado = `SOC-2026-${String(newId).padStart(4, '0')}`;

    await logAudit(pool, {
      modulo: 'sociodemografico',
      idRegistro: newId,
      radicado,
      user: req.user,
      tipoOperacion: 'CREACION',
      valoresAnteriores: null,
      valoresNuevos: mapSocioRow(r.rows[0]),
      observaciones: `Creación de Perfil Sociodemográfico para ${nombreCompleto}`,
    });

    res.status(201).json({
      message: 'Perfil Sociodemográfico registrado exitosamente.',
      id: newId,
      radicado
    });
  } catch (err) {
    console.error('[sst-service] create sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al registrar Perfil Sociodemográfico.' });
  }
});

router.put('/sociodemografico/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'sociodemografico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Sociodemográfico (Sandra Roa) o el Administrador pueden editar registros.' });
  }
  const id = parseInt(req.params.id, 10);
  const prevRes = await pool.query('SELECT * FROM sst_perfil_sociodemografico WHERE id_sociodemografico=$1', [id]);
  if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
  const prevRow = prevRes.rows[0];

  const b = req.body;
  const apellidos = upper(b.apellidos || (b.nombreCompleto || '').split(' ').slice(0, 2).join(' '));
  const nombres = upper(b.nombres || (b.nombreCompleto || '').split(' ').slice(2).join(' ') || b.nombreCompleto);
  const nombreCompleto = upper(b.nombreCompleto || `${apellidos} ${nombres}`);
  const currentYear = new Date().getFullYear();
  const anioNac = parseInt(b.anioNacimiento) || null;
  const edad = parseInt(b.edad) || (anioNac ? currentYear - anioNac : null);

  try {
    const r = await pool.query(
      `UPDATE sst_perfil_sociodemografico SET
        tipo_identificacion=$1, documento=$2, apellidos=$3, nombres=$4, nombre_completo=$5,
        sexo=$6, anio_nacimiento=$7, edad=$8, raza_etnia=$9, estado_civil=$10,
        composicion_familiar=$11, tipo_vivienda=$12, estrato=$13, municipio_residencia=$14,
        municipio_trabajo=$15, escolaridad=$16, ocupacion_profesion=$17, rango_ingresos=$18,
        denominacion_cargo=$19, tipo_cargo=$20, tipo_vinculacion=$21, antiguedad_cargo=$22,
        antiguedad_entidad=$23, dependencia=$24, sede_trabajo=$25, actualizado_en=CURRENT_TIMESTAMP
       WHERE id_sociodemografico=$26 RETURNING *`,
      [
        b.tipoIdentificacion || 'Cédula de Ciudadanía',
        String(b.documento || '').trim(),
        apellidos,
        nombres,
        nombreCompleto,
        b.sexo || 'Masculino',
        anioNac,
        edad,
        b.razaEtnia || 'Blanco/Mestizo',
        b.estadoCivil || 'Soltero (a)',
        b.composicionFamiliar || '',
        b.tipoVivienda || 'Arriendo',
        String(b.estrato || '3'),
        b.municipioResidencia || 'Tunja',
        b.municipioTrabajo || 'Tunja',
        b.escolaridad || 'Profesional',
        b.ocupacionProfesion || '',
        b.rangoIngresos || 'Entre 3 y 6 SMMLV',
        b.denominacionCargo || '',
        b.tipoCargo || 'Profesional',
        b.tipoVinculacion || 'Carrera Administrativa',
        b.antiguedadCargo || 'Entre 1 y 4 años',
        b.antiguedadEntidad || 'Entre 1 y 4 años',
        b.dependencia || '',
        b.sedeTrabajo || 'CASA DE LA TORRE',
        id
      ]
    );

    await logAudit(pool, {
      modulo: 'sociodemografico',
      idRegistro: id,
      radicado: `SOC-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: 'MODIFICACION',
      valoresAnteriores: mapSocioRow(prevRow),
      valoresNuevos: mapSocioRow(r.rows[0]),
      observaciones: `Actualización de Perfil Sociodemográfico (${nombreCompleto})`,
    });

    res.json({ message: 'Perfil Sociodemográfico actualizado.' });
  } catch (err) {
    console.error('[sst-service] update sociodemografico error:', err.message);
    res.status(500).json({ error: 'Error al actualizar Perfil Sociodemográfico.' });
  }
});

router.post('/sociodemografico/bulk', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'sociodemografico');
  if (!perm.canImport) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Sociodemográfico (Sandra Roa) o el Administrador pueden realizar importaciones masivas.' });
  }
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No se recibieron registros para importar.' });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors = [];
  try {
    await client.query('BEGIN');
    const existingRes = await client.query('SELECT documento FROM sst_perfil_sociodemografico');
    const seenDocs = new Set(existingRes.rows.map(r => String(r.documento).trim()));

    const currentYear = new Date().getFullYear();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const filaExcel = r._rowNum || (i + 2);
      const doc = String(r.documento || '').trim();
      const nom = upper(r.nombreCompleto || `${r.apellidos || ''} ${r.nombres || ''}`.trim());
      if (!doc || !nom) {
        errors.push({
          fila: filaExcel,
          columna: !doc ? 'NÚMERO DOCUMENTO DE IDENTIFICACIÓN' : 'APELLIDOS Y NOMBRES',
          motivo: 'El número de documento y el nombre completo son obligatorios.'
        });
        skipped++;
        continue;
      }
      if (seenDocs.has(doc)) {
        errors.push({
          fila: filaExcel,
          columna: 'NÚMERO DOCUMENTO DE IDENTIFICACIÓN',
          motivo: `El servidor con documento ${doc} ya cuenta con un perfil sociodemográfico registrado.`
        });
        skipped++;
        continue;
      }
      seenDocs.add(doc);

      const anioNac = parseInt(r.anioNacimiento) || null;
      const edad = parseInt(r.edad) || (anioNac ? currentYear - anioNac : null);

      await client.query(
        `INSERT INTO sst_perfil_sociodemografico (
          tipo_identificacion, documento, apellidos, nombres, nombre_completo, sexo,
          anio_nacimiento, edad, raza_etnia, estado_civil, composicion_familiar,
          tipo_vivienda, estrato, municipio_residencia, municipio_trabajo,
          escolaridad, ocupacion_profesion, rango_ingresos, denominacion_cargo,
          tipo_cargo, tipo_vinculacion, antiguedad_cargo, antiguedad_entidad,
          dependencia, sede_trabajo, creado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          r.tipoIdentificacion || 'Cédula de Ciudadanía',
          doc,
          upper(r.apellidos || nom.split(' ').slice(0, 2).join(' ')),
          upper(r.nombres || nom.split(' ').slice(2).join(' ') || nom),
          nom,
          r.sexo || 'Masculino',
          anioNac,
          edad,
          r.razaEtnia || 'Blanco/Mestizo',
          r.estadoCivil || 'Soltero (a)',
          r.composicionFamiliar || 'Conyuge Permanente, Hijos',
          r.tipoVivienda || 'Arriendo',
          String(r.estrato || '3'),
          r.municipioResidencia || 'Tunja',
          r.municipioTrabajo || 'Tunja',
          r.escolaridad || 'Profesional',
          r.ocupacionProfesion || '',
          r.rangoIngresos || 'Entre 3 y 6 SMMLV',
          r.denominacionCargo || 'Profesional Universitario',
          r.tipoCargo || 'Profesional',
          r.tipoVinculacion || 'Carrera Administrativa',
          r.antiguedadCargo || 'Entre 1 y 4 años',
          r.antiguedadEntidad || 'Entre 1 y 4 años',
          r.dependencia || 'SGEN - SECRETARIA GENERAL (Despacho)',
          r.sedeTrabajo || 'CASA DE LA TORRE',
          req.user.username || 'admin'
        ]
      );
      inserted++;
    }

    await logAudit(client, {
      modulo: 'sociodemografico',
      idRegistro: `BULK-${Date.now()}`,
      radicado: 'IMPORT-SOC',
      user: req.user,
      tipoOperacion: 'IMPORTACION_MASIVA',
      valoresAnteriores: null,
      valoresNuevos: { totalRecibidos: rows.length, insertados: inserted, omitidos: skipped },
      observaciones: `Importación masiva Formato E-DO-ST-F-011: ${inserted} insertados, ${skipped} omitidos/duplicados.`,
    });

    await client.query('COMMIT');
    res.json({
      message: `Se importaron ${inserted} registros al Perfil Sociodemográfico (${skipped} omitidos/duplicados).`,
      inserted,
      skipped,
      errors
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error en carga masiva de Perfil Sociodemográfico.' });
  } finally {
    client.release();
  }
});

router.delete('/sociodemografico/:id', auth, async (req, res) => {
  const perm = await getModulePermission(pool, req.user, 'sociodemografico');
  if (!perm.canManage) {
    return res.status(403).json({ error: 'Solo la responsable asignada al módulo de Perfil Sociodemográfico o el Administrador pueden eliminar registros.' });
  }
  const id = parseInt(req.params.id, 10);
  try {
    const prevRes = await pool.query('SELECT * FROM sst_perfil_sociodemografico WHERE id_sociodemografico=$1', [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const prevRow = prevRes.rows[0];

    await pool.query('DELETE FROM sst_perfil_sociodemografico WHERE id_sociodemografico=$1', [id]);

    await logAudit(pool, {
      modulo: 'sociodemografico',
      idRegistro: id,
      radicado: `SOC-2026-${String(id).padStart(4, '0')}`,
      user: req.user,
      tipoOperacion: 'ELIMINACION',
      valoresAnteriores: mapSocioRow(prevRow),
      valoresNuevos: null,
      observaciones: `Eliminación de Perfil Sociodemográfico SOC-2026-${String(id).padStart(4, '0')} (${prevRow.nombre_completo})`,
    });

    res.json({ message: 'Registro sociodemográfico eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar registro sociodemográfico.' });
  }
});

module.exports = router;
