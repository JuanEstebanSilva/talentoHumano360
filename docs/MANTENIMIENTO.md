# Manual de Mantenimiento y Operación Técnica
## Talento 360 — Gobernación de Boyacá

Este manual describe los procedimientos operativos rutinarios, estrategias de respaldo, tareas de mantenimiento preventivo y recuperación ante desastres para los administradores de sistemas de la Gobernación de Boyacá.

---

## 1. Estrategia de Copias de Seguridad (Backups)

### 1.1. Respaldo Binario Comprimido (Recomendado para Producción)
El formato binario comprimido de PostgreSQL (`-Fc`) es el estándar institucional por su velocidad, menor tamaño y capacidad de restauración selectiva por tablas:

```bash
# 1. Crear carpeta de respaldos si no existe
mkdir -p /var/backups/talento360

# 2. Generar el volcado binario con marca de tiempo UTC
FECHA=$(date +%Y%m%d_%H%M%S)
docker exec talento360_db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "/var/backups/talento360/talento360_${FECHA}.dump"

# 3. Validar la integridad del archivo generado
docker run --rm -i --entrypoint pg_restore postgres:16-alpine -l < "/var/backups/talento360/talento360_${FECHA}.dump" > /dev/null && echo "✅ Respaldo íntegro y verificado."
```

### 1.2. Respaldo en Texto Plano (SQL) para Auditorías
Para exportar un volcado legible en formato SQL estándar:

```bash
docker exec -t talento360_db pg_dump -U postgres -d talento360 --clean --if-exists > "/var/backups/talento360/talento360_${FECHA}.sql"
```

---

## 2. Procedimiento de Restauración Segura (Disaster Recovery)

Para restaurar una copia de seguridad sin riesgo de corrupción:

### 2.1. Restauración en Base de Datos de Pruebas (Aislamiento Preventivo)
Antes de sobreescribir la base de datos de producción, valide el archivo en una base temporal:

```bash
# Crear base temporal
docker exec -i talento360_db psql -U postgres -c "CREATE DATABASE talento360_test_restore;"

# Restaurar volcado binario en la base temporal
docker exec -i talento360_db pg_restore -U postgres -d talento360_test_restore --clean --if-exists < "/var/backups/talento360/talento360_respaldo.dump"

# Comprobar conteo de registros principales
docker exec -i talento360_db psql -U postgres -d talento360_test_restore -c "SELECT COUNT(*) FROM personas; SELECT COUNT(*) FROM viaticos; SELECT COUNT(*) FROM horarios;"

# Eliminar base temporal una vez verificada
docker exec -i talento360_db psql -U postgres -c "DROP DATABASE talento360_test_restore;"
```

### 2.2. Restauración en Base de Datos Principal
1. Detener los microservicios para evitar escrituras concurrentes:
   ```bash
   cd /opt/talento360/web
   docker compose stop auth-service employees-service requests-service admin-requests-service viaticos-service dashboard-service horarios-service sst-service
   ```
2. Ejecutar la restauración:
   ```bash
   docker exec -i talento360_db pg_restore -U postgres -d talento360 --clean --if-exists < "/var/backups/talento360/talento360_respaldo.dump"
   ```
3. Reiniciar los microservicios:
   ```bash
   docker compose start
   ```

---

## 3. Mantenimiento Preventivo de Base de Datos

Cada 3 a 6 meses se recomienda optimizar índices y liberar espacio físico en disco:

```bash
# Analizar y optimizar estadísticas del optimizador de consultas
docker exec -i talento360_db psql -U postgres -d talento360 -c "VACUUM ANALYZE;"

# Reindexar tablas con alto volumen transaccional
docker exec -i talento360_db psql -U postgres -d talento360 -c "REINDEX TABLE viaticos; REINDEX TABLE horarios; REINDEX TABLE personas;"
```

---

## 4. Gestión de Espacio y Rotación de Logs de Docker

Para evitar que los archivos de registro consuman el disco duro del servidor:
1. Consultar espacio ocupado por Docker:
   ```bash
   docker system df
   ```
2. Limpiar imágenes huérfanas y cachés de construcción no utilizadas:
   ```bash
   docker image prune -f
   ```
3. Consultar los últimos logs de un servicio con límite de líneas:
   ```bash
   cd /opt/talento360/web
   docker compose logs --tail=100 -f viaticos-service
   ```

---

## 5. Restablecimiento de Emergencia de Credenciales Administrativas

En caso de olvido de la clave del administrador institucional o pérdida de acceso al correo, el sistema cuenta con una utilidad segura interactiva en `scratch/reset_admin_credentials.js`:

```bash
# Ejecutar restablecimiento interactivo seguro
node scratch/reset_admin_credentials.js
```
El script solicitará el correo administrativo (`alejoleo2022@gmail.com`), generará el hash bcrypt correspondiente con salt cost 12 y actualizará la base de datos de forma segura sin exponer contraseñas en logs ni historial de terminal.
