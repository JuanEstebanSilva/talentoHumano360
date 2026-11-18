# Copias de seguridad

**Estado:** guía técnica para la instalación en Docker Compose. Dónde se guardan las copias, cada cuánto y por cuánto tiempo está **por confirmar** con la entidad.

## Qué guarda cada cosa

| Información | Dónde vive en Docker | ¿La incluye la copia de la aplicación? |
| :--- | :--- | :--- |
| Base de datos (servidores, solicitudes, viáticos, horarios, SST, informes, historial) | Volumen `postgres_data` | Sí |
| Archivos de Gestión Documental y sus versiones | Volumen `documents_data` | **No** |
| Carpeta de entrada automática (`procesados/`, `rechazados/`) | Volumen `documents_inbox` | **No** |
| Las propias copias de la aplicación | Volumen `backups_data` | — |

Docker Compose antepone el nombre del proyecto a cada volumen. Con el `docker-compose.yml` de `web/`, se llaman `web_postgres_data`, `web_documents_data`, etc. Se pueden ver con `docker volume ls`.

## Copia desde la aplicación

El usuario **Administrador Técnico** la genera en *Copias de seguridad*. También puede programar una diaria (por defecto a las 23:00, hora de Colombia) y descargar cada archivo.

- Es un archivo `.sql` con los datos de todas las tablas, salvo el propio registro de copias.
- Se guarda en el volumen `backups_data`. Antes de este ajuste quedaba dentro del contenedor y se perdía al reconstruirlo con `docker compose up --build`.
- El ajuste `backup_retention_days` (30 días) se guarda, pero **no se aplica**: las copias antiguas se acumulan hasta borrarlas a mano.
- **No se ha probado restaurar** una base completa desde este archivo. Para restaurar se recomienda la copia de PostgreSQL de la siguiente sección.

## Copia completa del servidor

Se ejecuta en el computador servidor, desde la carpeta `web/`. `D:\respaldos` es un ejemplo: debe ser otro disco u otro equipo.

Estos comandos se probaron en una instalación Docker aislada: la base restaurada volvió al estado de la copia y los archivos restaurados volvieron al volumen.

Base de datos, en el formato propio de PostgreSQL. Se genera dentro del contenedor y luego se copia, porque redirigir con `>` en PowerShell daña los archivos binarios:

```powershell
docker exec talento360_db pg_dump -U postgres -Fc -f /tmp/talento360.dump talento360
docker cp talento360_db:/tmp/talento360.dump D:\respaldos\talento360_AAAA-MM-DD.dump
```

Archivos de Gestión Documental:

```powershell
docker run --rm -v web_documents_data:/datos -v D:\respaldos:/respaldo alpine tar czf /respaldo/documentos_AAAA-MM-DD.tgz -C /datos .
```

Restaurar la base de datos (reemplaza los datos actuales):

```powershell
docker cp D:\respaldos\talento360_AAAA-MM-DD.dump talento360_db:/tmp/restaurar.dump
docker exec talento360_db pg_restore -U postgres -d talento360 --clean --if-exists /tmp/restaurar.dump
```

Restaurar los archivos:

```powershell
docker run --rm -v web_documents_data:/datos -v D:\respaldos:/respaldo alpine tar xzf /respaldo/documentos_AAAA-MM-DD.tgz -C /datos
```

La base de datos y los archivos deben copiarse a la vez. Si no, un documento puede figurar en la base sin su archivo, o al revés.

## Riesgos de un solo computador

- Si las copias quedan en el mismo disco que los datos, una falla del disco pierde ambos.
- Si el equipo está apagado a la hora programada, la copia diaria de ese día no se hace.
- `docker compose down -v` borra todos los volúmenes, incluidas las copias de la aplicación.

## Por confirmar con la entidad

- Dónde se guardan las copias: otro disco, otro equipo o un servidor institucional.
- Cada cuánto se hacen y quién lo hace.
- Por cuánto tiempo se conservan.
- Quién puede restaurarlas.
