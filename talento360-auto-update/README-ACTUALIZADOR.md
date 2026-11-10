# Comprobador de cambios Talento360 (modo seguro)

Revisa `origin/main` aproximadamente cada 5 minutos mediante `systemd`, después del arranque del servidor.

**Importante:** esta primera versión **solo detecta** actualizaciones. **No hace `git pull`, no despliega, no ejecuta SQL y no toca PostgreSQL.** Se diseñó así para no arriesgar los registros existentes hasta revisar migraciones y probar restauración.

## Instalar en Ubuntu Server

1. Copia estos archivos a la **raíz** del repositorio `talentoHumano360` y súbelos a `main`:
   - `actualizar-talento360.sh`
   - `instalar-actualizador.sh`
   - `systemd/talento360-update.service`
   - `systemd/talento360-update.timer`
2. En el servidor, desde `~/talentoHumano360`, ejecuta:

   ```bash
   git pull --ff-only origin main
   bash instalar-actualizador.sh
   ```

3. Para comprobar:

   ```bash
   systemctl list-timers --all talento360-update.timer
   sudo journalctl -u talento360-update.service -n 20 --no-pager
   ```

## Consideraciones

- El servicio asume usuario Linux `talento360-server` y ruta `/home/talento360-server/talentoHumano360`.
- El script usa `flock` para evitar revisiones simultáneas y no actualiza si hay cambios locales o si el historial diverge.
- `git fetch` sí actualiza referencias remotas, pero no los archivos del proyecto.
- El archivo `web/.env` debe mantenerse fuera de Git; nunca subir contraseñas o secretos.
- El volumen persistente de PostgreSQL no se modifica.
- **No** usar `docker compose down -v` ni `docker volume rm`.
- Antes de habilitar despliegues automáticos: revisar migraciones y semillas de los microservicios, probar restauración de respaldos, y definir ventana de mantenimiento y reversión.
