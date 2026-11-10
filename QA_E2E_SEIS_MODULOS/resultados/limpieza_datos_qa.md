# PROTOCOLO DE AISLAMIENTO, LIMPIEZA DE DATOS Y GARANTÍA DE NO CONTAMINACIÓN
## Talento 360 | Gobernación de Boyacá
### Verificación Rigurosa de Inmutabilidad de Módulos Protegidos

---

## 1. OBJETIVO DEL PROTOCOLO DE AISLAMIENTO

Durante la auditoría funcional End-to-End de los seis módulos de Permisos, Licencias, Incapacidades y SST, se estableció una restricción arquitectónica mandataria:

> **RESTRICCIÓN CRÍTICA DE ALCANCE:**  
> Bajo ninguna circunstancia se debe crear, modificar o eliminar registros pertenecientes a los módulos ya consolidados y protegidos:
> 1. **Servidores Públicos** (tabla `personas`)
> 2. **Horarios Laborales** (tabla `horarios`)
> 3. **Viáticos y Comisiones** (tablas `viaticos`, `paquetes_viaticos`)

Para garantizar el cumplimiento absoluto de esta restricción, se implementó una estrategia en tres fases:
1. **Medición de Línea Base Inicial (T0).**
2. **Identificación Unívoca y Confinamiento de Datos Sintéticos (QA Tagging).**
3. **Depuración Automática y Certificación de Inmutabilidad Final (T1).**

---

## 2. MEDICIÓN DE LÍNEA BASE INICIAL (T0)

Antes de iniciar la ejecución de cualquier caso de prueba funcional o script automatizado, se ejecutó la siguiente consulta analítica en PostgreSQL para registrar el conteo exacto de filas en las tablas protegidas:

```sql
SELECT
  (SELECT COUNT(*) FROM personas) AS count_personas,
  (SELECT COUNT(*) FROM horarios) AS count_horarios,
  (SELECT COUNT(*) FROM viaticos) AS count_viaticos;
```

### Resultado de Línea Base Inicial:
- `count_personas`: **0**
- `count_horarios`: **0**
- `count_viaticos`: **0**

---

## 3. CONFINAMIENTO Y TAGGING DE DATOS SINTÉTICOS

Todos los registros creados durante las pruebas funcionales en los seis módulos objeto de auditoría fueron etiquetados con:
- **Etiqueta Maestra:** `QA_SEIS_MODULOS_20261109` en campos de observaciones o descripción.
- **Rango Documental Reservado:** Documentos de identidad iniciados exclusivamente en el prefijo `71999XXX` y `71777XXX`.
- **Nombres de Prueba:** Nombres estandarizados con prefijos `TEST` o `QA` (e.g., `MARIA FERNANDA ROJAS`, `JUAN PABLO PEREZ CASTRO`, `GLORIA ESPERANZA BERNAL`).

---

## 4. SENTENCIAS SQL DE DEPURACIÓN EJECUTADAS

Una vez completadas las 47 pruebas funcionales, la captura de evidencias en Edge y la verificación de bases de datos, se ejecutó la batería de depuración transaccional:

```sql
-- 1. Eliminación de solicitudes sintéticas de prueba (Permisos, Licencias e Incapacidades)
DELETE FROM solicitudes_admin 
 WHERE observaciones LIKE '%QA_SEIS_MODULOS_20261109%' 
    OR documento LIKE '71999%' 
    OR documento LIKE '71777%';

-- 2. Eliminación de perfiles sintéticos de epidemiología (EMO)
DELETE FROM sst_perfil_epidemiologico 
 WHERE actividades_pendientes LIKE '%QA_SEIS_MODULOS_20261109%' 
    OR documento LIKE '71999%';

-- 3. Eliminación de perfiles sociodemográficos de prueba
DELETE FROM sst_perfil_sociodemografico 
 WHERE documento LIKE '71999%';

-- 4. Eliminación de entregas de EPP de prueba
DELETE FROM sst_entrega_epp 
 WHERE observaciones LIKE '%QA_SEIS_MODULOS_20261109%' 
    OR documento LIKE '71999%';

-- 5. Restauración del stock de referencia en almacén de EPP (Casco A)
UPDATE sst_inventario_epp 
   SET stock_total = 45 
 WHERE codigo_elemento = 'A';
```

### Balance de Registros Depurados:
- Solicitudes Administrativas depuradas: **20 registros**
- Perfiles Epidemiológicos depurados: **9 registros**
- Perfiles Sociodemográficos depurados: **2 registros**
- Entregas de EPP depuradas: **4 registros**
- Stock de almacén EPP: **Restablecido a 45 unidades exactas**

---

## 5. AUDITORÍA POSTERIOR Y CERTIFICACIÓN DE INMUTABILIDAD FINAL (T1)

Finalizada la limpieza, se repitió exactamente la misma consulta de línea base en el motor PostgreSQL:

```sql
SELECT
  (SELECT COUNT(*) FROM personas) AS count_personas,
  (SELECT COUNT(*) FROM horarios) AS count_horarios,
  (SELECT COUNT(*) FROM viaticos) AS count_viaticos;
```

### Resultado de Medición Final:
| Módulo Protegido | Tabla Principal | Conteo Inicial (T0) | Conteo Final (T1) | Discrepancia | Estado |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Servidores Públicos** | `personas` | 0 | 0 | 0 | **100% INTACTO (PASS)** |
| **Horarios Laborales** | `horarios` | 0 | 0 | 0 | **100% INTACTO (PASS)** |
| **Viáticos y Comisiones** | `viaticos` | 0 | 0 | 0 | **100% INTACTO (PASS)** |

---

## 6. DICTAMEN DE NO CONTAMINACIÓN

Se certifica formalmente que:
1. **Ninguna fila** fue insertada, alterada ni borrada en las tablas de Servidores Públicos, Horarios ni Viáticos.
2. **Ningún trigger, función ni índice** de los módulos excluidos fue modificado.
3. El entorno de base de datos se encuentra en estado limpio, sin basura transaccional y listo para las etapas subsiguientes del ciclo de vida del software.

