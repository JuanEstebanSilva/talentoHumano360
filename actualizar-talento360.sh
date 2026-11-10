#!/usr/bin/env bash
set -Eeuo pipefail
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/talento360-update-${UID}.lock"
flock -n 9 || exit 0
cd "$(dirname "$(readlink -f "$0")")"
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo 'No estamos en main; revisión cancelada.'; exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Hay cambios locales; revisión cancelada.'; exit 1
fi
git fetch origin main
local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse origin/main)
if [[ "$local_rev" == "$remote_rev" ]]; then
  echo 'Sin cambios en GitHub.'; exit 0
fi
if ! git merge-base --is-ancestor HEAD origin/main; then
  echo 'Historial remoto divergente; revisión cancelada.'; exit 1
fi
echo "Nueva versión detectada: $local_rev -> $remote_rev"
echo 'Modo seguro: NO se descargan cambios al árbol de trabajo, NO se reinicia Docker ni se modifica PostgreSQL.'
