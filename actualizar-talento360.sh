#!/usr/bin/env bash
set -Eeuo pipefail
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
REPO=/home/talento360-server/talentoHumano360
OWNER=talento360-server
COMPOSE="$REPO/web/docker-compose.yml"
ENVFILE="$REPO/web/.env"
BACKUPS=/var/backups/talento360
LOCK=/run/lock/talento360-update.lock
log(){ echo "[$(date -Is)] $*"; }
exec 9>"$LOCK"
flock -n 9 || { log 'Otra actualización está en curso; saliendo.'; exit 0; }
cd "$REPO"
[[ -f "$ENVFILE" && -f "$COMPOSE" ]] || { log 'Faltan archivos de configuración'; exit 1; }
[[ -z "$(runuser -u "$OWNER" -- git status --porcelain)" ]] || { log 'Cambios locales detectados: cancelado'; exit 1; }
runuser -u "$OWNER" -- git fetch origin main
OLD=$(runuser -u "$OWNER" -- git rev-parse HEAD)
NEW=$(runuser -u "$OWNER" -- git rev-parse origin/main)
[[ "$OLD" != "$NEW" ]] || { log 'Sin cambios en GitHub.'; exit 0; }
runuser -u "$OWNER" -- git merge-base --is-ancestor "$OLD" "$NEW" || { log 'No es avance rápido; revisión manual'; exit 1; }
# Los cambios de esquema, semillas, configuración de Docker y scripts de arranque
# requieren revisión humana: podrían cambiar o duplicar registros.
CHANGES=$(runuser -u "$OWNER" -- git diff --name-only "$OLD" "$NEW")
if grep -Eiq '(^|/)(database|migrations?|seeds?|initdb)(/|$)|\.(sql|prisma)$|(^|/)(docker-compose[^/]*\.ya?ml|\.env[^/]*|Dockerfile[^/]*)$|(^|/)(package(-lock)?\.json)$' <<< "$CHANGES"; then
  log 'Cambios sensibles detectados. NO se desplegó. Revisar manualmente:'
  echo "$CHANGES"
  exit 0
fi
mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP="$BACKUPS/.talento360-$STAMP.dump.tmp"
OUT="$BACKUPS/talento360-$STAMP.dump"
trap 'rm -f "$TMP"' EXIT
log 'Generando respaldo PostgreSQL antes del despliegue...'
docker exec talento360_db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"
[[ -s "$TMP" ]] || { log 'Respaldo vacío: cancelado'; exit 1; }
docker exec -i talento360_db pg_restore --version >/dev/null
docker run --rm -i --entrypoint pg_restore postgres:16-alpine -l < "$TMP" >/dev/null
chmod 600 "$TMP"
mv "$TMP" "$OUT"
log "Respaldo verificado: $OUT"
log "Actualizando código a $NEW"
runuser -u "$OWNER" -- git merge --ff-only origin/main
# No detener/eliminar postgres; tampoco eliminar volúmenes.
# --no-deps evita recrear postgres por dependencia de los servicios.
mapfile -t SERVICES < <(docker compose --env-file "$ENVFILE" -f "$COMPOSE" config --services | grep -v '^postgres$')
if [[ ${#SERVICES[@]} -eq 0 ]]; then log 'No hay servicios para actualizar'; exit 1; fi
if ! docker compose --env-file "$ENVFILE" -f "$COMPOSE" up -d --build --no-deps "${SERVICES[@]}"; then
  log 'Error de despliegue. Revirtiendo código y reconstruyendo servicios previos.'
  runuser -u "$OWNER" -- git reset --hard "$OLD"
  docker compose --env-file "$ENVFILE" -f "$COMPOSE" up -d --build --no-deps "${SERVICES[@]}" || true
  exit 1
fi
sleep 10
if ! curl --fail --silent --show-error --max-time 20 -o /dev/null http://127.0.0.1/; then
  log 'El frontend no responde. Intentando recuperar la versión anterior.'
  runuser -u "$OWNER" -- git reset --hard "$OLD"
  docker compose --env-file "$ENVFILE" -f "$COMPOSE" up -d --build --no-deps "${SERVICES[@]}" || true
  exit 1
fi
log "Despliegue completado. PostgreSQL no fue recreado. Respaldo: $OUT"
