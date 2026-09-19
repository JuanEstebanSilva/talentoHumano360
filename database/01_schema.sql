DROP TABLE IF EXISTS historial_solicitudes CASCADE;
DROP TABLE IF EXISTS vacaciones CASCADE;
DROP TABLE IF EXISTS rel_principal CASCADE;
DROP TABLE IF EXISTS estados CASCADE;
DROP TABLE IF EXISTS contactos CASCADE;
DROP TABLE IF EXISTS educacion CASCADE;
DROP TABLE IF EXISTS cargos CASCADE;
DROP TABLE IF EXISTS dependencias CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    nombre VARCHAR(160) NOT NULL,
    rol VARCHAR(80) NOT NULL DEFAULT 'Administrador',
    cargo_laboral VARCHAR(200) DEFAULT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE personas (
    id_persona VARCHAR(30) PRIMARY KEY,
    cedula VARCHAR(40),
    primer_apellido VARCHAR(120),
    segundo_apellido VARCHAR(120),
    nombres VARCHAR(180),
    nombre_completo VARCHAR(280),
    expedida VARCHAR(120),
    tipo_sangre VARCHAR(30),
    tipo_discapacidad VARCHAR(50),
    fecha_nacimiento VARCHAR(60),
    edad VARCHAR(30),
    sexo VARCHAR(30),
    documento_pendiente BOOLEAN DEFAULT FALSE,
    es_vacante BOOLEAN DEFAULT FALSE
);

CREATE TABLE dependencias (
    id_dependencia VARCHAR(30) PRIMARY KEY,
    dependencia VARCHAR(280),
    responsable VARCHAR(280),
    cargo_directivo VARCHAR(280),
    correo_responsable VARCHAR(180),
    extension_telefonica VARCHAR(80),
    funciones VARCHAR(1000)
);

CREATE TABLE cargos (
    id_cargo VARCHAR(30) PRIMARY KEY,
    tipo_cargo VARCHAR(120),
    cargo VARCHAR(280),
    codigo VARCHAR(80),
    grado VARCHAR(80),
    asignacion_sueldo VARCHAR(120),
    nivel VARCHAR(120)
);

CREATE TABLE educacion (
    id_educacion VARCHAR(30) PRIMARY KEY,
    estudios VARCHAR(280),
    matricula_profesional VARCHAR(180),
    institucion_estudios VARCHAR(280),
    postgrado VARCHAR(280),
    institucion_postgrado VARCHAR(280),
    diplomado_cap_sena VARCHAR(280),
    correo_institucional VARCHAR(180)
);

CREATE TABLE contactos (
    id_contacto VARCHAR(30) PRIMARY KEY,
    direccion VARCHAR(280),
    ciudad VARCHAR(120),
    telefono_fijo VARCHAR(80),
    celular VARCHAR(80),
    correo_personal VARCHAR(180),
    correo_institucional VARCHAR(180)
);

CREATE TABLE estados (
    id_estado VARCHAR(30) PRIMARY KEY,
    clasificacion_empleo VARCHAR(180),
    situacion VARCHAR(180),
    funciones_pagadas VARCHAR(180),
    novedades VARCHAR(280),
    opec VARCHAR(120)
);

CREATE TABLE rel_principal (
    id_registro VARCHAR(30) PRIMARY KEY,
    id_persona VARCHAR(30),
    id_cargo_base VARCHAR(30),
    id_cargo_actual VARCHAR(30),
    id_dependencia VARCHAR(30),
    id_educacion VARCHAR(30),
    id_contacto VARCHAR(30),
    id_estado VARCHAR(30),
    otro_tiempo_gobernacion TEXT,
    otros_tiempos_periodos JSONB DEFAULT '[]'::jsonb,
    tiempo_total_gobernacion TEXT,
    fecha_ingreso VARCHAR(80),
    tiempo_servicio VARCHAR(120),
    fecha_encargo VARCHAR(80),
    FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
    FOREIGN KEY (id_cargo_base) REFERENCES cargos(id_cargo),
    FOREIGN KEY (id_cargo_actual) REFERENCES cargos(id_cargo),
    FOREIGN KEY (id_dependencia) REFERENCES dependencias(id_dependencia),
    FOREIGN KEY (id_educacion) REFERENCES educacion(id_educacion),
    FOREIGN KEY (id_contacto) REFERENCES contactos(id_contacto),
    FOREIGN KEY (id_estado) REFERENCES estados(id_estado)
);

CREATE TABLE vacaciones (
    id_vacacion SERIAL PRIMARY KEY,
    dependencia VARCHAR(280),
    numero VARCHAR(60),
    apellidos_nombres VARCHAR(280),
    titular_cargo VARCHAR(280),
    genero VARCHAR(40),
    documento VARCHAR(60),
    fecha_ingreso VARCHAR(80),
    cargo VARCHAR(280),
    codigo VARCHAR(80),
    grado VARCHAR(80),
    sueldo VARCHAR(120),
    gastos_rep VARCHAR(120),
    fecha_corte VARCHAR(80),
    hoy VARCHAR(80),
    dias_totales VARCHAR(80),
    anos VARCHAR(80),
    meses VARCHAR(80),
    periodos VARCHAR(120),
    observaciones VARCHAR(400),
    tipo_vinculacion VARCHAR(180),
    estado VARCHAR(80) DEFAULT 'Pendiente',
    revision_planta VARCHAR(180)
);

CREATE TABLE historial_solicitudes (
    id_historial SERIAL PRIMARY KEY,
    id_vacacion INTEGER REFERENCES vacaciones(id_vacacion) ON DELETE CASCADE,
    estado_nuevo VARCHAR(80) NOT NULL,
    nota VARCHAR(400) NOT NULL DEFAULT 'Cambio realizado desde interfaz',
    actualizado_por VARCHAR(120) NOT NULL DEFAULT CURRENT_USER,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


