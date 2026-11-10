#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
sudo install -o root -g root -m 755 actualizar-talento360.sh /usr/local/bin/actualizar-talento360.sh
sudo install -o root -g root -m 644 systemd/talento360-update.service /etc/systemd/system/talento360-update.service
sudo install -o root -g root -m 644 systemd/talento360-update.timer /etc/systemd/system/talento360-update.timer
sudo mkdir -p /var/backups/talento360
sudo chmod 700 /var/backups/talento360
sudo systemctl daemon-reload
sudo systemctl enable --now talento360-update.timer
echo 'Instalación completa. Verifica con: systemctl list-timers --all talento360-update.timer'
echo 'Ejecuta una prueba: sudo systemctl start talento360-update.service'
