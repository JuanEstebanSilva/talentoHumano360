#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(readlink -f "$0")")"
if [[ ! -f systemd/talento360-update.service || ! -f systemd/talento360-update.timer ]]; then
  echo 'Faltan archivos de systemd. Copia también la carpeta systemd/ al repositorio.' >&2
  exit 1
fi
chmod +x actualizar-talento360.sh
sudo install -m 644 systemd/talento360-update.service /etc/systemd/system/talento360-update.service
sudo install -m 644 systemd/talento360-update.timer /etc/systemd/system/talento360-update.timer
sudo systemctl daemon-reload
sudo systemctl enable --now talento360-update.timer
sudo systemctl start talento360-update.service
sudo systemctl --no-pager status talento360-update.timer
printf '\nPara consultar registros: sudo journalctl -u talento360-update.service -n 20 --no-pager\n'
