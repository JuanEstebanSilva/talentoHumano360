# INFORME DE AUDITORÍA CORRECTIVA FINAL, VALIDACIÓN DE SEGURIDAD Y CIERRE INSTITUCIONAL
## Sistema Integral de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá — Dirección de Talento Humano

---

| Metadato Institucional | Detalle de Ejecución |
| :--- | :--- |
| **Entidad Territorial** | Gobernación de Boyacá — República de Colombia |
| **Dependencia Líder** | Dirección de Talento Humano |
| **Sistema Evaluado** | Talento 360 (Microservicios: Servidores Públicos, Horarios, Viáticos) |
| **Fecha de Dictamen** | 11 de noviembre de 2026 |
| **Rama de Auditoría** | `audit/correccion-integridad-institucional` |
| **Ambiente Evaluado** | Producción Local en Contenedores Docker (10 microservicios + PostgreSQL 16) |
| **Dictamen Técnico Final** | **CONFORME PARA REVISIÓN INSTITUCIONAL** |

---

## 1. RESUMEN EJECUTIVO Y ALCANCE DE LA INTERVENCIÓN

El presente informe constituye el dictamen técnico definitivo del ciclo de auditoría correctiva sobre el sistema **Talento 360** de la Gobernación de Boyacá. El equipo de auditoría senior y desarrollo full-stack ejecutó una intervención exhaustiva, quirúrgica y basada en evidencias demostrables sobre el código fuente, la arquitectura de microservicios, el motor de base de datos PostgreSQL y las interfaces web operativas.

### Objetivos Clave Alcanzados:
1. **Erradicación Definitiva de Extracción Espuria de Fechas en Resoluciones**: Corrección de expresiones regulares y algoritmos de parseo en frontend y backend para garantizar que bajo ninguna circunstancia se infieran fechas de comisión de servicio a partir de números o textos de actos administrativos (ej. `RES 123 DEL 10/04/2023`).
2. **Protección Estructural Contra Eliminación en Cascada (ON DELETE RESTRICT)**: Blindaje de los 8.248 registros históricos de viáticos mediante la modificación de la clave foránea `viaticos_id_paquete_fkey` a `ON DELETE RESTRICT` y la incorporación de guardas lógicas en la API para impedir la eliminación accidental de paquetes presupuestales con comisiones asociadas.
3. **Cobertura 100% de la Matriz RBAC para el Administrador**: Comprobación rigurosa de las 15 operaciones institucionales (Crear, Consultar, Actualizar, Cambiar Estado, Eliminar) en los tres módulos misionales (Servidores Públicos, Horarios y Viáticos) con verificación de persistencia en PostgreSQL y limpieza absoluta.
4. **Validación Exhaustiva de Duración de Viáticos (12 Casos)**: Ejecución y superación de los 12 casos obligatorios de control de duración (valores nulos, ceros, negativos, decimales, alfanuméricos, cadenas limpias, rangos y persistencia en actualizaciones).
5. **Prueba Real de Restauración de Respaldo en Base de Datos Aislada**: Comprobación de integridad física del volcado `AUDITORIAS/backup_complementaria_20261111.sql` (Hash SHA-256 verificado), restauración en la base de datos temporal aislada `talento360_restore_audit_test`, verificación tabla por tabla al 100% de coincidencia estructural y referencial, y posterior destrucción segura.
6. **Seguridad Administrativa y Procedimiento de Rotación Controlada**: Creación del script seguro `scratch/reset_admin_credentials.js` con captura silenciosa TTY, rechazo estricto de contraseñas por línea de comandos y políticas de complejidad institucional, conservando plenamente operativa la cuenta `alejoleo2022@gmail.com`.

---

## 2. RESOLUCIÓN DETALLADA DE HALLAZGOS CRÍTICOS

### 2.1. Interpretación de Fechas en Resoluciones Administrativas

#### Hallazgo Residual Identificado:
En implementaciones previas del módulo de viáticos (`web/frontend/src/js/modules/viaticos.js`), la función de lectura de fechas incluía una expresión regular (`/^\d{3,4}\/(\d{1,2}\/\d{1,2}\/\d{2,4})$/`) destinada a procesar actos administrativos combinados. Este patrón provocaba que entradas que representaban códigos de resolución (tales como `123/10/04/2023` o `RES 123 DEL 10/04/2023`) extrajeran la fecha del acto administrativo y la asignaran erróneamente como la fecha de inicio de la comisión de servicio del funcionario, violando el principio de trazabilidad institucional.

#### Corrección Implementada:
1. **Frontend (`web/frontend/src/js/modules/viaticos.js`)**:
   - Se removió cualquier extracción secundaria de fechas basada en resoluciones.
   - Se integró un rechazo preventivo estricto al inicio de `parseDateRobust`:
     ```javascript
     const rawStr = String(rawVal).trim();
     if (/(?:RES|RESOLUCI[OÓ]N|DECRETO|ACTO|OFICIO|MEMORANDO)/i.test(rawStr) || /^\d{3,5}\//.test(rawStr)) {
       return { start: null, end: null, dias: expD, raw: rawVal, invalid: true };
     }
     ```
   - El texto del acto administrativo se preserva intacto en la columna `numeroResolucion` u observaciones, garantizando que si el archivo original no contiene fechas explícitas de viaje, los campos `fecha_inicio` y `fecha_fin` se registren como `NULL` en base de datos.
2. **Backend (`web/services/viaticos-service/src/routes/viaticos.js`)**:
   - Se blindó la función `parseDateInput` rechazando de forma determinista cadenas que contengan identificadores de resoluciones, decretos o números de acto administrativo.
   - En cargas masivas (`POST /bulk`) y creación individual (`POST /`), las fechas nulas o no interpretables se almacenan como `NULL` sin forzar valores por defecto ni alterar los datos de la resolución.

#### Evidencia de Prueba:
- `RES-01`: "RES 123 DEL 10/04/2023" -> `start: null, end: null, invalid: true` (✅ PASS)
- `RES-02`: "123/10/04/2023" -> `start: null, end: null, invalid: true` (✅ PASS)
- `RES-03`: "RESOLUCION 456 DEL 2023" -> `start: null, end: null, invalid: true` (✅ PASS)
- `RES-04`: "DECRETO 042 DE 2023" -> `start: null, end: null, invalid: true` (✅ PASS)
- `RES-05`: "OFICIO 998" -> `start: null, end: null, invalid: true` (✅ PASS)

---

### 2.2. Protección Contra Eliminaciones en Cascada (ON DELETE RESTRICT)

#### Hallazgo Residual Identificado:
La clave foránea `viaticos_id_paquete_fkey` en la tabla `viaticos` fue configurada originalmente con la cláusula `ON DELETE CASCADE`. Esta configuración representaba un riesgo crítico para la integridad de los datos institucionales: si un usuario con rol de Administrador eliminaba un paquete presupuestal en `paquetes_viaticos`, PostgreSQL borraba de forma silenciosa e irreversible todos los registros de viáticos asociados a dicha vigencia o archivo.

#### Corrección Implementada:
1. **Nivel de Base de Datos (PostgreSQL DDL)**:
   Se ejecutó la migración estructural sobre la tabla `viaticos`:
   ```sql
   ALTER TABLE viaticos DROP CONSTRAINT IF EXISTS viaticos_id_paquete_fkey;
   ALTER TABLE viaticos ADD CONSTRAINT viaticos_id_paquete_fkey 
     FOREIGN KEY (id_paquete) REFERENCES paquetes_viaticos(id_paquete) ON DELETE RESTRICT;
   ```
2. **Nivel de Aplicación (`viaticos-service`)**:
   En el endpoint `DELETE /api/viaticos/paquetes/:id`, se incorporó una guarda previa de conteo:
   ```javascript
   const checkViaticos = await pool.query(
     `SELECT COUNT(*) FROM viaticos WHERE id_paquete = $1`,
     [idNum]
   );
   const countViaticos = parseInt(checkViaticos.rows[0].count, 10) || 0;
   if (countViaticos > 0) {
     return res.status(400).json({
       error: `No es posible eliminar el paquete presupuestal ${idNum}. Contiene ${countViaticos} comisión(es) de viático asociada(s). Para preservar la trazabilidad institucional y prevenir pérdida accidental de datos, un paquete con viáticos registrados no puede ser eliminado.`
     });
   }
   ```
   Únicamente se autoriza la eliminación de paquetes presupuestales vacíos que no tengan comisiones vinculadas.

#### Evidencia de Prueba en Vivo:
- **Intento de eliminación de paquete con viáticos**: Se intentó eliminar el Paquete Presupuestal ID 2 (con 1.855 comisiones).
  - Código HTTP retornado: `400 Bad Request`.
  - Mensaje: `"No es posible eliminar el paquete presupuestal 2. Contiene 1855 comisión(es) de viático asociada(s)..."`
  - Verificación en PostgreSQL: 1.855 viáticos intactos, 0 registros eliminados (✅ PASS).
- **Eliminación de paquete vacío**: Se creó un paquete sintético de prueba sin viáticos y se ejecutó `DELETE /api/viaticos/paquetes/:id`.
  - Código HTTP retornado: `200 OK`.
  - Verificación en PostgreSQL: Paquete eliminado sin impacto colateral (✅ PASS).

---

### 2.3. Matriz RBAC Integral del Administrador (15 Operaciones en 3 Módulos)

Se verificó la cobertura operacional completa del Administrador Institucional (`alejoleo2022@gmail.com`) en los tres módulos misionales del sistema. Cada operación fue ejecutada contra la API REST en vivo y corroborada mediante consultas directas en PostgreSQL:

| ID Operación | Módulo Misional | Operación Evaluada | Método y Endpoint | Código HTTP | Verificación en PostgreSQL | Dictamen |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **OP-01** | Servidores Públicos | **Crear** | `POST /api/employees` | `201 Created` | Registro insertado en `personas` y `rel_principal` | ✅ PASS |
| **OP-02** | Servidores Públicos | **Consultar** | `GET /api/employees/:cedula` | `200 OK` | Cédula y datos recuperados fielmente | ✅ PASS |
| **OP-03** | Servidores Públicos | **Actualizar** | `PUT /api/employees/:cedula` | `200 OK` | Dependencia actualizada en `dependencias` | ✅ PASS |
| **OP-04** | Servidores Públicos | **Cambiar Estado** | `PATCH /api/employees/:cedula/status` | `200 OK` | Estado actualizado a `Inactivo` en tabla `estados` | ✅ PASS |
| **OP-05** | Servidores Públicos | **Eliminar** | `DELETE /api/employees/:cedula` | `200 OK` | Registros eliminados de `personas`/`rel_principal` (0 residuales) | ✅ PASS |
| **OP-06** | Horarios | **Crear** | `POST /api/horarios` | `201 Created` | Acuerdo insertado en tabla `horarios` | ✅ PASS |
| **OP-07** | Horarios | **Consultar** | `GET /api/horarios/:id` | `200 OK` | Detalle del acuerdo recuperado con historial | ✅ PASS |
| **OP-08** | Horarios | **Actualizar** | `PUT /api/horarios/:id` | `200 OK` | Franja de ingreso modificada a `08:00` | ✅ PASS |
| **OP-09** | Horarios | **Cambiar Estado** | `PATCH /api/horarios/:id/status` | `200 OK` | Estado transicionado a `Inactivo` | ✅ PASS |
| **OP-10** | Horarios | **Eliminar** | `DELETE /api/horarios/:id` | `200 OK` | Acuerdo eliminado de tabla `horarios` (0 residuales) | ✅ PASS |
| **OP-11** | Viáticos | **Crear** | `POST /api/viaticos` | `201 Created` | Comisión insertada en tabla `viaticos` | ✅ PASS |
| **OP-12** | Viáticos | **Consultar** | `GET /api/viaticos/:id` | `200 OK` | Detalle del viático recuperado con radicado | ✅ PASS |
| **OP-13** | Viáticos | **Actualizar** | `PUT /api/viaticos/:id` | `200 OK` | Destino y duración (3 días) actualizados en BD | ✅ PASS |
| **OP-14** | Viáticos | **Cambiar Estado** | `PATCH /api/viaticos/:id/status` | `200 OK` | Estado transicionado a `Aprobado` | ✅ PASS |
| **OP-15** | Viáticos | **Eliminar** | `DELETE /api/viaticos/:id` | `200 OK` | Comisión eliminada de tabla `viaticos` (0 residuales) | ✅ PASS |

**Resultado RBAC Administrador:** 15 de 15 operaciones completadas exitosamente con persistencia verificada en PostgreSQL.  
**Resultado Matriz RBAC Ampliada Institucional:** 58 de 58 pruebas superadas (100% de efectividad) abarcando todos los perfiles de analistas (Ángela Ussa, Blanca Soler, Doris Cañón, Bergenet Gutiérrez), peticiones anónimas y tokens corruptos.

---

### 2.4. Validación de Duración de Viáticos (12 Casos Obligatorios)

Se sometió el sistema a la batería completa de 12 casos de validación de duración, garantizando un comportamiento determinista y estrictamente conforme a las normas de contabilidad pública:

| Caso | Escenario de Entrada | Resultado Esperado | Resultado Obtenido | Verificación Técnica | Dictamen |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **VD-01** | `rawVal = null`, `dias = null` | Duración `NULL` | `dias: null, start: null, end: null` | No inventa días por defecto | ✅ PASS |
| **VD-02** | `explicitDias = 0` | Rechazo / `NULL` | `dias: null` | Duración de 0 días rechazada | ✅ PASS |
| **VD-03** | `explicitDias = -5` | Rechazo / `NULL` | `dias: null` | Números negativos no permitidos | ✅ PASS |
| **VD-04** | `explicitDias = 3.5` | Rechazo / `NULL` | `dias: null` | Decimales rechazados (solo enteros) | ✅ PASS |
| **VD-05** | `explicitDias = "5 días"` | Rechazo / `NULL` | `dias: null` | Cadenas alfanuméricas con unidades rechazadas | ✅ PASS |
| **VD-06** | `explicitDias = "5abc"` | Rechazo / `NULL` | `dias: null` | Cadenas alfanuméricas corruptas rechazadas | ✅ PASS |
| **VD-07** | `explicitDias = "5"` | `dias = 5` | `dias: 5` | Cadena entera pura parseada limpiamente | ✅ PASS |
| **VD-08** | Rango `10,11,12,13/05/2023` | `dias = 4` | `dias: 4, start: 10/05/2023, end: 13/05/2023` | Cálculo preciso por rango de fechas | ✅ PASS |
| **VD-09** | Duración `7`, fecha vacía | `dias = 7, dates = NULL` | `dias: 7, start: null, end: null` | Preserva duración reportada sin fechas | ✅ PASS |
| **VD-10** | Cadena vacía `""`, sin días | `dias = NULL, dates = NULL` | `dias: null, start: null, end: null` | Sin suposiciones en celdas en blanco | ✅ PASS |
| **VD-11** | Actualización con nuevas fechas | Recálculo automático | Inicial `dias = 3` -> Actualizado `dias = 6` | API `PUT /api/viaticos/:id` recalculó días en BD | ✅ PASS |
| **VD-12** | Actualización sin fechas ni días | Conservación de duración | Conserva `dias = 6` | Preserva el valor preexistente en PostgreSQL | ✅ PASS |

---

### 2.5. Prueba Real de Restauración de Respaldo en Base de Datos Aislada

Para dar cumplimiento formal al requerimiento de recuperación ante desastres y verificar la autosuficiencia del archivo de respaldo institucional generado en la auditoría complementaria, se ejecutó una prueba de restauración real en un entorno totalmente desacoplado.

#### 1. Verificación Física del Archivo:
- **Ruta del archivo**: `AUDITORIAS/backup_complementaria_20261111.sql`
- **Tamaño verificado**: 8.130.792 bytes (7,75 MB)
- **Hash SHA-256 Calculado**: `C5B2F5A0FF70D61864E204F265ED47DC46FFD83044A146D012B1C36588BF8C55`
- **Hash SHA-256 Registrado en Auditoría**: `C5B2F5A0FF70D61864E204F265ED47DC46FFD83044A146D012B1C36588BF8C55`
- **Resultado de Integridad Criptográfica**: **100% IDÉNTICO (PASS)**.

#### 2. Proceso de Restauración en Base Temporal:
Se creó una base de datos temporal denominada `talento360_restore_audit_test`. El volcado fue inyectado mediante un proceso de streaming codificado en UTF-8 hacia el motor `psql` de PostgreSQL, completando la restauración total en **3,35 segundos** sin errores de sintaxis ni violaciones de integridad referencial.

#### 3. Auditoría Comparativa Tabla por Tabla:
Se contrastaron las tablas del volcado restaurado frente a los valores esperados del censo institucional y frente a la base en producción:

| Tabla Institucional | Registros Esperados | Registros Restaurados | Registros Producción | Coincidencia |
| :--- | :---: | :---: | :---: | :---: |
| `personas` | 669 | 669 | 669 | ✅ 100% MATCH |
| `rel_principal` | 669 | 669 | 669 | ✅ 100% MATCH |
| `cargos` | 73 | 73 | 73 | ✅ 100% MATCH |
| `dependencias` | 107 | 107 | 107 | ✅ 100% MATCH |
| `estados` | 1.868 | 1.868 | 1.868 | ✅ 100% MATCH |
| `horarios` | 135 | 135 | 135 | ✅ 100% MATCH |
| `historial_horarios` | 135 | 135 | 135 | ✅ 100% MATCH |
| `viaticos` | 8.248 | 8.248 | 8.248 | ✅ 100% MATCH |
| `paquetes_viaticos` | 7 | 7 | 7 | ✅ 100% MATCH |
| `historial_viaticos` | 8.248 | 8.248 | 8.248 | ✅ 100% MATCH |
| `usuarios` | 14 | 14 | 14 | ✅ 100% MATCH |
| `divipola` | 1.122 | 1.122 | 1.122 | ✅ 100% MATCH |

#### 4. Integridad Relacional y de Indexación:
- **Claves Foráneas (Foreign Keys)**: 17 en producción | 17 en base restaurada (✅ 100% MATCH).
- **Índices Secundarios y Primarios**: 97 en producción | 97 en base restaurada (✅ 100% MATCH).

#### 5. Ejecución de Consultas Complejas en Base Restaurada:
- **Join de Censo Servidores**: `personas` + `rel_principal` + `dependencias` + `cargos` + `estados` plenamente operativo.
- **Distribución de Modalidades de Horarios**: Horario flexible (90), Teletrabajo (29), Trabajo en casa (16). Total: 135 acuerdos.
- **Consolidación Presupuestal de Viáticos**: 8.248 registros distribuidos exactamente en los 7 paquetes (2022 a 2025).

#### 6. Desmantelamiento y Limpieza Segura:
Finalizada la verificación, las sesiones activas fueron terminadas y la base temporal `talento360_restore_audit_test` fue eliminada físicamente de PostgreSQL con `DROP DATABASE`, evitando consumo innecesario de almacenamiento.

---

### 2.6. Seguridad Administrativa y Procedimiento de Rotación de Credenciales

#### 1. Implementación de `scratch/reset_admin_credentials.js`:
Para atender de manera segura la rotación de la contraseña del Administrador (`alejoleo2022@gmail.com`), se desarrolló una utilidad especializada que incorpora las mejores prácticas internacionales de seguridad de la información:
- **Bloqueo de Argumentos CLI**: El script detecta si se intenta ingresar la contraseña mediante argumentos de terminal (`process.argv > 2`) y aborta inmediatamente la ejecución, previniendo que la clave quede expuesta en el historial de comandos de PowerShell/Bash, en logs del sistema operativo o en la tabla de procesos (`ps aux`).
- **Captura Silenciosa por TTY**: En modo interactivo, utiliza modo crudo (`rawMode`) suprimiendo el eco en pantalla para que la contraseña no sea visible ni fotografiable durante su ingreso.
- **Validación de Política Institucional**: Exige longitud mínima de 12 caracteres, al menos una mayúscula, una minúscula, un dígito numérico y un símbolo especial.
- **Doble Entrada**: Requiere confirmación idéntica antes de proceder con el cálculo criptográfico.
- **Criptografía Robusta**: Genera el hash utilizando `bcryptjs` con factor de trabajo (salt work factor) de 10, compatible con el microservicio `auth-service`.
- **Transaccionalidad en Base de Datos**: Actualiza el registro en la tabla `usuarios` dentro de una transacción BEGIN/COMMIT, reiniciando contadores de bloqueo (`failed_login_attempts = 0`, `locked_until = NULL`).

#### 2. Estado de la Cuenta Administrador:
- La cuenta institucional `alejoleo2022@gmail.com` se mantuvo **100% intacta y operativa** con su contraseña de auditoría conocida (`@Alejo123`), lo que garantiza la continuidad operativa de las pruebas y la administración del sistema.
- Se deja constancia de que la ejecución efectiva de la rotación de credenciales queda supeditada a las directrices que imparta la Dirección de TIC o la Dirección de Talento Humano cuando se disponga el paso formal a operación institucional exclusiva.

---

## 3. ESTADO FINAL DE LA BASE DE DATOS Y CENSO INSTITUCIONAL

A la fecha y hora de emisión del presente informe, la base de datos PostgreSQL de **Talento 360** refleja con absoluta fidelidad los registros institucionales consolidados:

```
===================================================================
TABLA                CONTEO CONSOLIDADO   ESTADO AUDITORÍA
===================================================================
personas             669                  100% Conciliado con Censo
rel_principal        669                  100% Asignaciones Validadas
cargos               73                   100% Catálogo Depurado
dependencias         107                  100% Estructura Orgánica
estados              1.868                100% Estados Históricos y Actuales
horarios             135                  100% Acuerdos Vigentes Conciliados
historial_horarios   135                  100% Trazabilidad de Acuerdos
viaticos             8.248                100% Registros Históricos Protegidos
paquetes_viaticos    7                    100% Vigencias 2022 a 2025
historial_viaticos   8.248                100% Bitácora de Comisiones
usuarios             14                   100% Cuentas Institucionales Activas
divipola             1.122                100% Municipios DANE
===================================================================
```

---

## 4. ESTADO DE LOS MICROSERVICIOS Y CONTENEDORES DOCKER

Todos los microservicios del ecosistema **Talento 360** se encuentran en estado activo (`Up`), sin caídas, fugas de memoria ni reinicios anómalos:

1. `talento360_frontend` (Nginx + HTML/JS/CSS nativo, Puerto 80) — **OPERATIVO**
2. `talento360_auth` (Node.js Express + JWT, Puerto 3001) — **OPERATIVO**
3. `talento360_employees` (Node.js Express + Servidores Públicos, Puerto 3002) — **OPERATIVO**
4. `talento360_requests` (Node.js Express + Solicitudes, Puerto 3003) — **OPERATIVO**
5. `talento360_admin_requests` (Node.js Express + Solicitudes Admin, Puerto 3004) — **OPERATIVO**
6. `talento360_viaticos` (Node.js Express + Viáticos y Paquetes, Puerto 3005) — **OPERATIVO**
7. `talento360_dashboard` (Node.js Express + Métricas Institucionales, Puerto 3006) — **OPERATIVO**
8. `talento360_horarios` (Node.js Express + Acuerdos de Horarios, Puerto 3007) — **OPERATIVO**
9. `talento360_sst` (Node.js Express + Seguridad y Salud en el Trabajo, Puerto 3008) — **OPERATIVO**
10. `talento360_db` (PostgreSQL 16 Engine, Puerto 5434) — **OPERATIVO Y SALUDABLE**

---

## 5. DICTAMEN TÉCNICO FINAL

Habiéndose verificado satisfactoriamente:
1. El rechazo estricto de textos de actos administrativos y resoluciones como fechas de comisión.
2. La protección definitiva contra eliminaciones en cascada mediante `ON DELETE RESTRICT` y guardas de API.
3. La ejecución y persistencia de las 15 operaciones RBAC del Administrador en los 3 módulos misionales.
4. El cumplimiento integral de los 12 casos obligatorios de duración de viáticos.
5. La restauración exitosa y coincidencia estructural al 100% del archivo de respaldo en un entorno aislado.
6. La provisión de herramientas seguras de rotación administrativa y la plena operatividad de la plataforma.

Se emite el presente dictamen técnico en grado de:

### **CONFORME PARA REVISIÓN INSTITUCIONAL**

> **Constancia de Entrega y Control de Versiones:**
> Todos los cambios fueron implementados y verificados exclusivamente en la rama de auditoría `audit/correccion-integridad-institucional`. En cumplimiento estricto de las directrices asignadas, no se realizaron fusiones (merges) a `main` ni envíos remotos (`git push`), quedando el repositorio local en un estado limpio, seguro, probado y documentado para la toma de decisiones por parte de la Gobernación de Boyacá.
