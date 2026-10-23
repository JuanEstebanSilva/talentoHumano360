-- ============================================================================
-- 11_stress_test_data.sql: Generación de Datos Masivos para Pruebas de Carga
-- Requerimientos del Usuario:
-- 1. Servidores Públicos: ~2,000 registros (Personas, Rel_Principal, Educacion, Contactos, Estados y Usuarios)
-- 2. Viáticos: Por lo menos 20,000 viáticos totales (Adición de ~16,000 registros)
-- 3. Horarios y Modalidades: Por lo menos 2,000 esquemas (Adición de ~1,900 registros)
-- ============================================================================

DO $$
DECLARE
    -- Contadores actuales
    v_cur_personas INT;
    v_cur_viaticos INT;
    v_cur_horarios INT;

    -- Objetivos
    v_target_personas CONSTANT INT := 2050;
    v_target_viaticos CONSTANT INT := 20082;
    v_target_horarios CONSTANT INT := 2033;

    v_add_personas INT;
    v_add_viaticos INT;
    v_add_horarios INT;

    v_max_per_num INT;
    v_max_edu_num INT;
    v_max_con_num INT;
    v_max_est_num INT;
    v_max_rel_num INT;
    v_max_hor_consec INT;
    v_pool_count INT;
    
    -- Catálogos de apoyo
    cargos_arr VARCHAR[];
    dep_arr VARCHAR[];
BEGIN
    SELECT count(*) INTO v_cur_personas FROM personas;
    SELECT count(*) INTO v_cur_viaticos FROM viaticos;
    SELECT count(*) INTO v_cur_horarios FROM horarios;

    RAISE NOTICE 'Estado inicial: Personas: %, Viáticos: %, Horarios: %', v_cur_personas, v_cur_viaticos, v_cur_horarios;

    v_add_personas := GREATEST(0, v_target_personas - v_cur_personas);
    v_add_viaticos := GREATEST(0, v_target_viaticos - v_cur_viaticos);
    v_add_horarios := GREATEST(0, v_target_horarios - v_cur_horarios);

    -- ──────────────────────────────────────────────────────────────────────────
    -- 1. GENERACIÓN DE SERVIDORES PÚBLICOS
    -- ──────────────────────────────────────────────────────────────────────────
    IF v_add_personas > 0 THEN
        RAISE NOTICE 'Generando % servidores públicos adicionales...', v_add_personas;

        SELECT COALESCE(MAX(SUBSTRING(id_persona FROM 4)::INT), 0) INTO v_max_per_num FROM personas WHERE id_persona ~ '^PER\d+$';
        SELECT COALESCE(MAX(SUBSTRING(id_educacion FROM 4)::INT), 0) INTO v_max_edu_num FROM educacion WHERE id_educacion ~ '^EDU\d+$';
        SELECT COALESCE(MAX(SUBSTRING(id_contacto FROM 4)::INT), 0) INTO v_max_con_num FROM contactos WHERE id_contacto ~ '^CON\d+$';
        SELECT COALESCE(MAX(SUBSTRING(id_estado FROM 4)::INT), 0) INTO v_max_est_num FROM estados WHERE id_estado ~ '^EST\d+$';
        SELECT COALESCE(MAX(SUBSTRING(id_registro FROM 4)::INT), 0) INTO v_max_rel_num FROM rel_principal WHERE id_registro ~ '^REL\d+$';

        SELECT ARRAY_AGG(id_cargo) INTO cargos_arr FROM cargos;
        SELECT ARRAY_AGG(id_dependencia) INTO dep_arr FROM dependencias;

        -- Crear tabla temporal con datos generados
        CREATE TEMP TABLE tmp_new_servidores ON COMMIT DROP AS
        WITH seed_names AS (
            SELECT
                i,
                ('PER' || LPAD((v_max_per_num + i)::text, 4, '0')) AS id_persona,
                ('EDU' || LPAD((v_max_edu_num + i)::text, 4, '0')) AS id_educacion,
                ('CON' || LPAD((v_max_con_num + i)::text, 4, '0')) AS id_contacto,
                ('EST' || LPAD((v_max_est_num + i)::text, 4, '0')) AS id_estado,
                ('REL' || LPAD((v_max_rel_num + i)::text, 4, '0')) AS id_registro,
                (1050000000 + (v_max_per_num + i) * 37 + (i % 899))::text AS cedula,
                (ARRAY['RODRIGUEZ','GOMEZ','GONZALEZ','MARTINEZ','GARCIA','PEREZ','LOPEZ','HERNANDEZ','SANCHEZ','RAMIREZ','TORRES','DIAZ','VARGAS','CASTRO','ROJAS','MORENO','ORTIZ','MEDINA','SILVA','ROMERO','SUAREZ','PINZON','CASTILLO','MONROY','BARRERA','ROA','CHAPARRO','RINCON','BERNAL','PARRA','RUIZ','FORERO','CAMARGO','CELY','FAGUA','CRUZ','TELLEZ','GUERRERO','PULIDO','ACUNA'])[(i % 40) + 1] AS primer_apellido,
                (ARRAY['RODRIGUEZ','GOMEZ','GONZALEZ','MARTINEZ','GARCIA','PEREZ','LOPEZ','HERNANDEZ','SANCHEZ','RAMIREZ','TORRES','DIAZ','VARGAS','CASTRO','ROJAS','MORENO','ORTIZ','MEDINA','SILVA','ROMERO','SUAREZ','PINZON','CASTILLO','MONROY','BARRERA','ROA','CHAPARRO','RINCON','BERNAL','PARRA','RUIZ','FORERO','CAMARGO','CELY','FAGUA','CRUZ','TELLEZ','GUERRERO','PULIDO','ACUNA'])[((i + 7) % 40) + 1] AS segundo_apellido,
                (ARRAY['JUAN CARLOS','MARIA ALEJANDRA','CARLOS ANDRES','ANA MILENA','DIEGO FERNANDO','PAOLA ANDREA','JORGE ELIECER','DIANA CAROLINA','LUIS FERNANDO','LILIANA PATRICIA','JOSE DANIEL','SANDRA MILENA','ANDRES FELIPE','CLAUDIA PATRICIA','EDWIN ALEXANDER','GLORIA INES','WILSON JAVIER','YENNY PAOLA','GUSTAVO ADOLFO','LEIDY JOHANNA','HECTOR MANUEL','MONICA DEL PILAR','OSCAR MAURICIO','ADRIANA LUCIA','CESAR AUGUSTO','ESPERANZA','FERNANDO ALONSO','LINA MARIA','RICARDO ALBERTO','SONIA ESPERANZA'])[(i % 30) + 1] AS nombres,
                (ARRAY['TUNJA','DUITAMA','SOGAMOSO','CHIQUINQUIRA','PAIPA','VILLA DE LEYVA','MONIQUIRA','PUERTO BOYACA','GARAGOA','MIRAFLORES','SOATA','GUATEQUE','NOBSA','TUTA','VENTAQUEMADA'])[(i % 15) + 1] AS municipio,
                (ARRAY['O+','A+','B+','AB+','O-'])[(i % 5) + 1] AS tipo_sangre,
                (ARRAY['MASCULINO','FEMENINO'])[(i % 2) + 1] AS sexo,
                (DATE '1968-01-01' + (i * 13 % 11000) * INTERVAL '1 day')::date AS fecha_nac,
                cargos_arr[(i % array_length(cargos_arr, 1)) + 1] AS id_cargo,
                dep_arr[(i % array_length(dep_arr, 1)) + 1] AS id_dependencia,
                (ARRAY['PROFESIONAL EN DERECHO','INGENIERIA DE SISTEMAS','CONTADURIA PUBLICA','ADMINISTRACION DE EMPRESAS','ECONOMIA','TRABAJO SOCIAL','PSICOLOGIA','INGENIERIA AMBIENTAL','INGENIERIA CIVIL','COMUNICACION SOCIAL'])[(i % 10) + 1] AS estudios,
                (ARRAY['UPTC','UNIVERSIDAD SANTO TOMAS','UNIVERSIDAD DE BOYACA','UNAD','ESAP','PONTIFICIA UNIVERSIDAD JAVERIANA','UNIVERSIDAD NACIONAL'])[(i % 7) + 1] AS institucion,
                (ARRAY['CARRERA ADMINISTRATIVA','PROVISIONALIDAD','LIBRE NOMBRAMIENTO Y REMOCION'])[(i % 3) + 1] AS clasificacion,
                (DATE '2016-01-15' + (i * 7 % 3600) * INTERVAL '1 day')::date AS fecha_ingreso
            FROM generate_series(1, v_add_personas) AS i
        )
        SELECT
            i,
            id_persona,
            id_educacion,
            id_contacto,
            id_estado,
            id_registro,
            cedula,
            primer_apellido,
            segundo_apellido,
            nombres,
            primer_apellido || ' ' || segundo_apellido || ' ' || nombres AS nombre_completo,
            municipio || ', BOYACA' AS expedida,
            'BOYACA' AS depto,
            municipio,
            tipo_sangre,
            sexo,
            to_char(fecha_nac, 'YYYY-MM-DD') AS fecha_nac_str,
            (EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_nac)) || ' anos') AS edad_str,
            LOWER(SUBSTRING(nombres FROM '^[A-Z]+')) || '.' ||
            LOWER(primer_apellido) || (v_max_per_num + i)::text || '@boyaca.gov.co' AS correo_inst,
            'Calle ' || (10 + (i % 60)) || ' # ' || (5 + (i % 30)) || '-' || (10 + (i % 70)) AS direccion,
            '31' || (0 + (i % 8)) || LPAD((1000000 + i * 17 % 8999999)::text, 7, '0') AS celular,
            id_cargo,
            id_dependencia,
            estudios,
            institucion,
            clasificacion,
            to_char(fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso_str,
            (EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_ingreso)) || ' anos, ' || EXTRACT(MONTH FROM age(CURRENT_DATE, fecha_ingreso)) || ' meses') AS tiempo_servicio_str
        FROM seed_names;

        -- Inserción en personas
        INSERT INTO personas (
            id_persona, cedula, primer_apellido, segundo_apellido, nombres, nombre_completo,
            expedida, tipo_sangre, tipo_discapacidad, fecha_nacimiento, edad, sexo,
            documento_pendiente, es_vacante, departamento_expedicion, ciudad_expedicion, municipio_expedicion
        )
        SELECT
            id_persona, cedula, primer_apellido, segundo_apellido, nombres, nombre_completo,
            expedida, tipo_sangre, NULL, fecha_nac_str, edad_str, sexo,
            false, false, depto, municipio, municipio
        FROM tmp_new_servidores;

        -- Inserción en educacion
        INSERT INTO educacion (
            id_educacion, estudios, matricula_profesional, institucion_estudios,
            postgrado, institucion_postgrado, diplomado_cap_sena, correo_institucional
        )
        SELECT
            id_educacion, estudios, 'MP-' || cedula, institucion,
            NULL, NULL, 'GESTION PUBLICA DEPARTAMENTAL', correo_inst
        FROM tmp_new_servidores;

        -- Inserción en contactos
        INSERT INTO contactos (
            id_contacto, direccion, ciudad, telefono_fijo, celular, correo_personal, correo_institucional
        )
        SELECT
            id_contacto, direccion, municipio, NULL, celular,
            LOWER(primer_apellido) || '.' || cedula || '@gmail.com', correo_inst
        FROM tmp_new_servidores;

        -- Inserción en estados
        INSERT INTO estados (
            id_estado, clasificacion_empleo, situacion, funciones_pagadas, novedades, opec
        )
        SELECT
            id_estado, clasificacion, 'ACTIVO', 'CARGO BASE', 'SIN NOVEDAD REPORTADA', 'OPEC-' || (2020 + (i % 6))
        FROM tmp_new_servidores;

        -- Inserción en rel_principal
        INSERT INTO rel_principal (
            id_registro, id_persona, id_cargo_base, id_cargo_actual, id_dependencia,
            id_educacion, id_contacto, id_estado, otro_tiempo_gobernacion, otros_tiempos_periodos,
            tiempo_total_gobernacion, fecha_ingreso, tiempo_servicio, fecha_encargo
        )
        SELECT
            id_registro, id_persona, id_cargo, id_cargo, id_dependencia,
            id_educacion, id_contacto, id_estado, NULL, '[]'::jsonb,
            tiempo_servicio_str, fecha_ingreso_str, tiempo_servicio_str, NULL
        FROM tmp_new_servidores;

        -- Inserción en usuarios (cuentas de acceso asociadas)
        INSERT INTO usuarios (username, password, nombre, rol, cargo_laboral, estado)
        SELECT
            correo_inst,
            'Servidor2026*',
            nombre_completo,
            'Servidor',
            'SERVIDOR PUBLICO DEPARTAMENTAL',
            'ACTIVO'
        FROM tmp_new_servidores
        ON CONFLICT (username) DO NOTHING;

        RAISE NOTICE 'Servidores públicos generados exitosamente.';
    END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- PREPARAR POOL DE PERSONAS PARA RELACIONES
    -- ──────────────────────────────────────────────────────────────────────────
    CREATE TEMP TABLE tmp_pool_personas ON COMMIT DROP AS
    SELECT
        row_number() OVER () AS row_idx,
        p_sub.nombre_completo,
        p_sub.cedula,
        COALESCE(c_sub.cargo, 'PROFESIONAL UNIVERSITARIO') AS cargo,
        COALESCE(c_sub.codigo, '219') AS cargo_codigo,
        COALESCE(c_sub.grado, '03') AS cargo_grado,
        COALESCE(d_sub.dependencia, 'SECRETARIA GENERAL') AS dependencia,
        COALESCE(con_sub.celular, '3100000000') AS celular
    FROM personas p_sub
    JOIN rel_principal r_sub ON r_sub.id_persona = p_sub.id_persona
    LEFT JOIN cargos c_sub ON c_sub.id_cargo = r_sub.id_cargo_actual
    LEFT JOIN dependencias d_sub ON d_sub.id_dependencia = r_sub.id_dependencia
    LEFT JOIN contactos con_sub ON con_sub.id_contacto = r_sub.id_contacto
    WHERE NOT p_sub.es_vacante;

    CREATE INDEX ON tmp_pool_personas(row_idx);
    SELECT count(*) INTO v_pool_count FROM tmp_pool_personas;
    RAISE NOTICE 'Pool de personas activas preparado: % servidores disponibles.', v_pool_count;

    -- ──────────────────────────────────────────────────────────────────────────
    -- 2. GENERACIÓN DE VIÁTICOS
    -- ──────────────────────────────────────────────────────────────────────────
    IF v_add_viaticos > 0 THEN
        RAISE NOTICE 'Generando % viáticos adicionales...', v_add_viaticos;

        INSERT INTO viaticos (
            dependencia, apellidos_nombres, documento, cargo, destino, motivo,
            fecha_inicio, fecha_fin, dias, valor_diario, estado, observaciones,
            fecha_solicitud, aprobado_por, tipo_destino, numero_resolucion, saldo, creado_en
        )
        SELECT
            p.dependencia,
            p.nombre_completo,
            p.cedula,
            p.cargo,
            (ARRAY['SOGAMOSO','DUITAMA','CHIQUINQUIRA','PUERTO BOYACA','MONIQUIRA','SOATA','GUATEQUE','VILLA DE LEYVA','BOGOTA D.C.','PAIPA','GARAGOA','MIRAFLORES','EL COCUY','AQUITANIA','SOCHA','CHITA','GUICAN','RAMIRIQUI','JENESANO','TIBASOSA'])[(i % 20) + 1] AS destino,
            (ARRAY[
                'Comision institucional de servicios y seguimiento tecnico',
                'Acompanamiento a mesas municipales de concertacion ciudadana',
                'Supervision y control de proyectos departamentales',
                'Inspeccion y verificacion de infraestructura publica',
                'Capacitacion institucional y asistencia administrativa'
            ])[(i % 5) + 1] AS motivo,
            to_char(f_ini, 'DD/MM/YYYY') AS fecha_inicio,
            to_char(f_fin, 'DD/MM/YYYY') AS fecha_fin,
            dias_val AS dias,
            val_dia AS valor_diario,
            (ARRAY['Aprobada','Finalizada','Pendiente','En revision'])[(i % 4) + 1] AS estado,
            (ARRAY['Comision debidamente autorizada','Conforme a agenda institucional','Legalizacion en tramite','Comision cumplida a satisfaccion','SIN VIATICOS'])[(i % 5) + 1] AS observaciones,
            to_char(f_ini - 5, 'DD/MM/YYYY') AS fecha_solicitud,
            (ARRAY['DIRECCION DE TALENTO HUMANO','SECRETARIA GENERAL','DESPACHO GOBERNADOR'])[(i % 3) + 1] AS aprobado_por,
            (ARRAY['Nacional','Departamental'])[(i % 2) + 1] AS tipo_destino,
            LPAD((100 + (i % 900))::text, 4, '0') || '/' || to_char(f_ini, 'DD/MM/YYYY') AS numero_resolucion,
            (5000000 + (i % 40) * 1000000)::numeric(15,2) AS saldo,
            (TIMESTAMP '2024-01-10 08:00:00' + (i * 29 % 75000) * INTERVAL '10 minutes') AS creado_en
        FROM (
            SELECT
                i,
                (DATE '2024-01-15' + (i * 3 % 800) * INTERVAL '1 day')::date AS f_ini,
                (DATE '2024-01-15' + (i * 3 % 800) * INTERVAL '1 day' + ((i % 3) + 1) * INTERVAL '1 day')::date AS f_fin,
                ((i % 3) + 1) AS dias_val,
                (ARRAY[130000, 165000, 195000, 220000, 250000])[(i % 5) + 1]::numeric(15,2) AS val_dia
            FROM generate_series(1, v_add_viaticos) AS i
        ) sub
        JOIN tmp_pool_personas p ON p.row_idx = (((sub.i * 7) % v_pool_count) + 1);

        -- Actualizar secuencia de viaticos
        PERFORM setval('viaticos_id_viatico_seq', (SELECT MAX(id_viatico) FROM viaticos));
        RAISE NOTICE 'Viáticos generados exitosamente.';
    END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- 3. GENERACIÓN DE HORARIOS Y MODALIDADES
    -- ──────────────────────────────────────────────────────────────────────────
    IF v_add_horarios > 0 THEN
        RAISE NOTICE 'Generando % esquemas de horarios adicionales...', v_add_horarios;

        SELECT COALESCE(MAX(numero_consecutivo), 0) INTO v_max_hor_consec FROM horarios;

        INSERT INTO horarios (
            numero_consecutivo, documento, apellidos_nombres, dependencia, cargo,
            modalidad, estado, fecha_inicio, fecha_fin, duracion_texto, duracion_dias,
            tipo_calculo, numero_resolucion, fecha_aprobacion, fecha_notificacion,
            aprobado_por, subtipo_teletrabajo, dias_teletrabajo, dias_presencial,
            domicilio_laboral, notificacion_arl, fecha_reporte_arl, motivo_trabajo_casa,
            direccion_trabajo_casa, herramientas_tic, prorroga, franja_ingreso,
            franja_salida, horas_semanales, tiempo_almuerzo, justificacion_flex,
            observaciones, creado_por, creado_en, actualizado_en, codigo, grado, secretaria, telefono
        )
        SELECT
            (v_max_hor_consec + i) AS numero_consecutivo,
            p.cedula AS documento,
            p.nombre_completo AS apellidos_nombres,
            p.dependencia,
            p.cargo,
            mod_val AS modalidad,
            (ARRAY['Activa','Activa','Activa','Pendiente','Caducada'])[(i % 5) + 1] AS estado,
            f_ini AS fecha_inicio,
            CASE WHEN (i % 4) = 0 THEN (f_ini + 180) ELSE NULL END AS fecha_fin,
            CASE WHEN (i % 4) = 0 THEN '180 dias autorizados' ELSE 'Vigencia Indefinida' END AS duracion_texto,
            CASE WHEN (i % 4) = 0 THEN 180 ELSE 365 END AS duracion_dias,
            (ARRAY['Habiles','Habiles','Calendario'])[(i % 3) + 1] AS tipo_calculo,
            'RES-' || LPAD((v_max_hor_consec + i)::text, 4, '0') || '/2026' AS numero_resolucion,
            (f_ini - 5) AS fecha_aprobacion,
            (f_ini - 3) AS fecha_notificacion,
            'Direccion de Gestion de Talento Humano' AS aprobado_por,
            CASE WHEN mod_val = 'Teletrabajo' THEN (ARRAY['Suplementario','Autonomo','Movil'])[(i % 3) + 1] ELSE NULL END AS subtipo_teletrabajo,
            CASE WHEN mod_val = 'Teletrabajo' THEN (ARRAY['2 dias (Martes y Jueves)','3 dias (Lunes, Miercoles, Viernes)','2 dias (Lunes y Miercoles)'])[(i % 3) + 1] ELSE NULL END AS dias_teletrabajo,
            CASE WHEN mod_val = 'Teletrabajo' THEN (ARRAY['3 dias en sede','2 dias en sede','3 dias presenciales'])[(i % 3) + 1] ELSE NULL END AS dias_presencial,
            'Domicilio habitual reportado ante ARL' AS domicilio_laboral,
            (i % 3 = 0) AS notificacion_arl,
            CASE WHEN (i % 3 = 0) THEN (f_ini - 2) ELSE NULL END AS fecha_reporte_arl,
            CASE WHEN mod_val = 'Trabajo en casa' THEN 'Habilitacion transitoria por fuerza mayor o estudio familiar' ELSE NULL END AS motivo_trabajo_casa,
            CASE WHEN mod_val = 'Trabajo en casa' THEN 'Calle ' || (10 + i % 50) || ' # ' || (5 + i % 20) || ' Duitama, Boyaca' ELSE NULL END AS direccion_trabajo_casa,
            'Equipo institucional de computo y conectividad VPN asegurada' AS herramientas_tic,
            false AS prorroga,
            (ARRAY['07:00 AM - 08:30 AM','07:30 AM - 09:00 AM','08:00 AM - 09:30 AM'])[(i % 3) + 1] AS franja_ingreso,
            (ARRAY['04:30 PM - 06:00 PM','05:00 PM - 06:30 PM','05:30 PM - 07:00 PM'])[(i % 3) + 1] AS franja_salida,
            40 AS horas_semanales,
            '1 hora' AS tiempo_almuerzo,
            CASE WHEN mod_val = 'Horario flexible' THEN 'Concertacion laboral por cuidado de hijos / familiares o estudios' ELSE NULL END AS justificacion_flex,
            'Esquema registrado y validado en planta de personal' AS observaciones,
            'admin' AS creado_por,
            NOW() - (i % 60) * INTERVAL '1 hour' AS creado_en,
            NOW() - (i % 60) * INTERVAL '1 hour' AS actualizado_en,
            p.cargo_codigo AS codigo,
            p.cargo_grado AS grado,
            p.dependencia AS secretaria,
            p.celular AS telefono
        FROM (
            SELECT
                i,
                (ARRAY['Teletrabajo','Horario flexible','Trabajo en casa','Presencial'])[(i % 4) + 1] AS mod_val,
                (DATE '2025-06-01' + (i * 2 % 300) * INTERVAL '1 day')::date AS f_ini
            FROM generate_series(1, v_add_horarios) AS i
        ) sub
        JOIN tmp_pool_personas p ON p.row_idx = (((sub.i * 11) % v_pool_count) + 1);

        -- Actualizar secuencia de horarios
        PERFORM setval('horarios_id_horario_seq', (SELECT MAX(id_horario) FROM horarios));
        RAISE NOTICE 'Horarios generados exitosamente.';
    END IF;

    -- Conteo final
    SELECT count(*) INTO v_cur_personas FROM personas;
    SELECT count(*) INTO v_cur_viaticos FROM viaticos;
    SELECT count(*) INTO v_cur_horarios FROM horarios;

    RAISE NOTICE '=== CONTEO FINAL TRAS INSERCIÓN ===';
    RAISE NOTICE 'Personas / Servidores: %', v_cur_personas;
    RAISE NOTICE 'Viáticos Totales: %', v_cur_viaticos;
    RAISE NOTICE 'Horarios y Esquemas: %', v_cur_horarios;
END $$;
