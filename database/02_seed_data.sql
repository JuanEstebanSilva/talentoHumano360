-- Seed data for Talento 360 - Gobernación de Boyacá

-- 3. Insertar el usuario administrador
--    La contraseña se guarda hasheada con bcrypt (nunca en texto plano).
INSERT INTO public.usuarios (username, password, nombre, rol, cargo_laboral, estado)
VALUES 
    ('admin@boyaca.gov.co', '$2a$12$V/AEZH3sAI.ZPJZdnCj3Ue8TU5P/6ekQdo9whQRwfR9H9RyLSjXDm', 'Administrador', 'Administrador', NULL, 'ACTIVO'),
    ('angela.ussa@boyaca.gov.co', '$2a$12$eI7ehEXpN701IhYkkXSS1.hMobi37kko/n2/jjH6dkOm87BO5mYl6', 'Angela Ussa', 'Administrador', 'Directora de Talento Humano', 'ACTIVO'),
    ('carlos@boyaca.gov.co', '$2a$12$oxJAvA4mX2.XXloxn./MDeHAg7Xzwuq8pwUbXXY7xNGIdFCGzan0.', 'Carlos Andrés Torres Rivera', 'Coordinador', 'Coordinador de Solicitudes', 'ACTIVO'),
    ('maria@boyaca.gov.co', '$2a$12$4Pqs0cP5hrAqWydfUiiX0Oe.sBhpvh7pUjDfpvyDQ9V9WiXQyVHRe', 'María Camila Rodríguez Niño', 'Consulta', 'Analista de Talento Humano', 'ACTIVO')
    ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, nombre = EXCLUDED.nombre, rol = EXCLUDED.rol, cargo_laboral = EXCLUDED.cargo_laboral, estado = 'ACTIVO';

-- ============================================================
-- DEPENDENCIAS
-- ============================================================
INSERT INTO dependencias (id_dependencia, dependencia, responsable, cargo_directivo, correo_responsable, extension_telefonica, funciones) VALUES
('DEP001', 'DESPACHO DEL GOBERNADOR', 'ROJAS HERRERA ANDRÉS FELIPE', 'GOBERNADOR / JEFE DE DESPACHO', 'despacho.gobernador@boyaca.gov.co', '2214', 'DIRECCIÓN ESTRATÉGICA INSTITUCIONAL Y COORDINACIÓN DEL GABINETE DEPARTAMENTAL.'),
('DEP002', 'SECRETARÍA DE PLANEACIÓN', 'MÉNDEZ ROJAS LAURA CAMILA', 'SECRETARIO DE PLANEACIÓN', 'planeacion@boyaca.gov.co', '2213', 'PLANEACIÓN TERRITORIAL, SEGUIMIENTO A PROYECTOS Y APOYO A LA TOMA DE DECISIONES.'),
('DEP003', 'SECRETARÍA DE HACIENDA', 'AGUILAR MORENO CARLOS EDUARDO', 'SECRETARIO DE HACIENDA', 'hacienda@boyaca.gov.co', '2125', 'GESTIÓN PRESUPUESTAL, FINANCIERA Y TRIBUTARIA DEL DEPARTAMENTO.'),
('DEP004', 'SECRETARÍA DE EDUCACIÓN', 'CASTRO DÍAZ MIGUEL ÁNGEL', 'SECRETARIO DE EDUCACIÓN', 'educacion@boyaca.gov.co', '3101', 'GESTIÓN DEL SISTEMA EDUCATIVO DEPARTAMENTAL Y TALENTO HUMANO DOCENTE.'),
('DEP005', 'SECRETARÍA DE SALUD', 'GÓMEZ RUIZ PAULA ANDREA', 'SECRETARIO DE SALUD', 'salud@boyaca.gov.co', '4115', 'SALUD PÚBLICA, RED DE SERVICIOS Y PROGRAMAS DE PREVENCIÓN.'),
('DEP006', 'SECRETARÍA DE INFRAESTRUCTURA PÚBLICA', 'CÁRDENAS LÓPEZ JORGE IVÁN', 'SECRETARIO DE INFRAESTRUCTURA', 'infraestructura@boyaca.gov.co', '2254', 'INFRAESTRUCTURA VIAL, OBRAS PÚBLICAS Y SEGUIMIENTO TÉCNICO.'),
('DEP007', 'SECRETARÍA GENERAL', 'MORALES NIÑO JUAN PABLO', 'SECRETARIO GENERAL', 'secretaria.general@boyaca.gov.co', '2119', 'SOPORTE ADMINISTRATIVO TRANSVERSAL, GESTIÓN DOCUMENTAL Y SERVICIOS INTERNOS.'),
('DEP008', 'SECRETARÍA DE GOBIERNO Y ACCIÓN COMUNAL', 'TORRES RIVERA DIANA MARCELA', 'SECRETARIO DE GOBIERNO', 'gobierno@boyaca.gov.co', '2155', 'GOBERNABILIDAD, ACCIÓN COMUNAL Y COORDINACIÓN CON MUNICIPIOS.'),
('DEP009', 'SECRETARÍA DE CULTURA Y PATRIMONIO', 'PARDO RUIZ VALENTINA', 'SECRETARIO DE CULTURA', 'cultura@boyaca.gov.co', '2212', 'PROMOCIÓN CULTURAL, PATRIMONIO Y PROCESOS ARTÍSTICOS REGIONALES.'),
('DEP010', 'DIRECCIÓN DE TALENTO HUMANO', 'TORRES RIVERA CARLOS ANDRÉS', 'DIRECTOR DE TALENTO HUMANO', 'talento.humano@boyaca.gov.co', '2275', 'GESTIÓN DEL TALENTO HUMANO, ADMINISTRACIÓN DE PERSONAL Y BIENESTAR LABORAL.'),
('DEP011', 'OFICINA JURÍDICA', 'PRIETO GARCÍA MÓNICA ALEJANDRA', 'JEFE DE OFICINA JURÍDICA', 'juridica@boyaca.gov.co', '2112', 'ASISTENCIA LEGAL, CONCEPTOS JURÍDICOS Y REPRESENTACIÓN JUDICIAL.'),
('DEP012', 'SECRETARÍA DE DESARROLLO EMPRESARIAL', 'SUÁREZ MEJÍA DANIEL ESTEBAN', 'SECRETARIO DE DESARROLLO EMPRESARIAL', 'desarrolloempresarial@boyaca.gov.co', '2132', 'EMPRENDIMIENTO, COMPETITIVIDAD, PRODUCTIVIDAD E INNOVACIÓN EMPRESARIAL.'),
('DEP013', 'SECRETARÍA DE AGRICULTURA', 'RODRÍGUEZ NIÑO MARÍA CAMILA', 'SECRETARIO DE AGRICULTURA', 'agricultura@boyaca.gov.co', '2367', 'DESARROLLO AGROPECUARIO, ASISTENCIA TÉCNICA Y ARTICULACIÓN PRODUCTIVA.'),
('DEP014', 'SECRETARÍA DE AMBIENTE Y DESARROLLO SOSTENIBLE', 'HERRERA LÓPEZ SANTIAGO', 'SECRETARIO DE AMBIENTE', 'ambiente@boyaca.gov.co', '2353', 'GESTIÓN AMBIENTAL, SOSTENIBILIDAD Y COORDINACIÓN CLIMÁTICA.'),
('DEP015', 'SECRETARÍA DE TURISMO', 'RINCÓN DUARTE CAROLINA', 'SECRETARIO DE TURISMO', 'turismo@boyaca.gov.co', '2203', 'PROMOCIÓN TURÍSTICA, RUTAS Y FORTALECIMIENTO DE DESTINOS.');

-- ============================================================
-- CARGOS
-- ============================================================
INSERT INTO cargos (id_cargo, tipo_cargo, cargo, codigo, grado, asignacion_sueldo, nivel) VALUES
('CAR001', 'PLANTA', 'PROFESIONAL UNIVERSITARIO', 'PU-001', 'G1', '$3.500.000', 'PROFESIONAL'),
('CAR002', 'PLANTA', 'PROFESIONAL ESPECIALIZADO', 'PE-001', 'G2', '$5.200.000', 'PROFESIONAL'),
('CAR003', 'PLANTA', 'TÉCNICO ADMINISTRATIVO', 'TA-001', 'G1', '$2.800.000', 'TÉCNICO'),
('CAR004', 'PLANTA', 'AUXILIAR ADMINISTRATIVO', 'AA-001', 'G1', '$1.800.000', 'AUXILIAR'),
('CAR005', 'PLANTA', 'ASESOR JURÍDICO', 'AJ-001', 'G3', '$6.500.000', 'ASESOR'),
('CAR006', 'PLANTA', 'COORDINADOR DE ÁREA', 'CA-001', 'G3', '$5.800.000', 'DIRECTIVO'),
('CAR007', 'PLANTA', 'SECRETARIO DE DESPACHO', 'SD-001', 'G4', '$7.200.000', 'DIRECTIVO'),
('CAR008', 'PLANTA', 'CONTRATISTA DE APOYO', 'CA-002', 'G1', '$2.200.000', 'CONTRATISTA'),
('CAR009', 'PLANTA', 'ANALISTA DE SISTEMAS', 'AS-001', 'G2', '$4.100.000', 'PROFESIONAL'),
('CAR010', 'PLANTA', 'INSPECTOR ADMINISTRATIVO', 'IA-001', 'G2', '$3.900.000', 'PROFESIONAL');

-- ============================================================
-- ESTADOS (situaciones laborales)
-- ============================================================
INSERT INTO estados (id_estado, clasificacion_empleo, situacion, funciones_pagadas, novedades, opec) VALUES
('EST001', 'EMPLEADO PÚBLICO', 'ACTIVO', 'TOTAL', 'Sin novedades', 'SI'),
('EST002', 'EMPLEADO PÚBLICO', 'ENCARGO', 'TOTAL', 'Encargo temporal', 'SI'),
('EST003', 'EMPLEADO PÚBLICO', 'RETIRADO', 'NINGUNA', 'Retiro voluntario', 'NO'),
('EST004', 'EMPLEADO PÚBLICO', 'PROVISIONAL', 'TOTAL', 'Nombramiento provisional', 'SI'),
('EST005', 'EMPLEADO PÚBLICO', 'VACANTE DEFINITIVA', 'NINGUNA', 'Cargo vacante', 'NO');

-- ============================================================
-- TABLAS TRANSACCIONALES / OPERATIVAS
-- ============================================================
-- Las tablas transaccionales (personas, contactos, educacion, rel_principal,
-- vacaciones, historial_solicitudes) inician limpias para operación real.

