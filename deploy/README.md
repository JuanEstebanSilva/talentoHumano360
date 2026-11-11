# Despliegue y Actualizador Automático de Talento 360
## Gobernación de Boyacá — Dirección de Talento Humano

Este directorio contiene las herramientas y scripts oficiales para el despliegue on-premise y el ciclo de actualización continua de **Talento 360** en servidores Linux (Ubuntu Server 22.04 / 24.04 LTS).

---

## 📁 Estructura del Directorio `deploy/`

```text
deploy/
├── README.md                           # Guía operativa de este directorio
├── scripts/
│   ├── actualizar-talento360.sh        # Script maestro de actualización con pg_dump y rollback
│   └── instalar-actualizador.sh        # Instalador de los servicios systemd en el sistema operativo
└── systemd/
    ├── talento360-update.service       # Unidad systemd (tipo oneshot) para ejecución del script
    └── talento360-update.timer         # Temporizador systemd para comprobación periódica (cada 5 min)
```

---

## 🚀 Instalación y Puesta en Marcha

Para configurar la actualización continua en un servidor Linux institucional con permisos de administrador:

```bash
cd /home/talento360-server/talentoHumano360/deploy/scripts
bash instalar-actualizador.sh
```

El script instalará automáticamente:
1. `actualizar-talento360.sh` en `/usr/local/bin/actualizar-talento360.sh` con permisos `755`.
2. Las unidades systemd en `/etc/systemd/system/`.
3. Creará el directorio de respaldos blindado en `/var/backups/talento360` con permisos `700`.
4. Habilitará e iniciará `talento360-update.timer`.

---

## ⚙️ Principios de Funcionamiento y Seguridad

1. **Bloqueo Concurrente (`flock`):** Evita que dos instancias del script se ejecuten simultáneamente.
2. **Respaldo Previo Obligatorio:** Antes de avanzar código o tocar contenedores, genera un volcado binario completo de PostgreSQL (`pg_dump -Fc`) y valida su integridad con `pg_restore -l`. Si el volcado falla, la actualización se aborta de inmediato.
3. **Bloqueo Preventivo ante Cambios Sensibles:** Si el commit incluye cambios en esquemas SQL (`database/`), Docker Compose, variables de entorno (`.env`), Dockerfiles o dependencias (`package.json`), el script **NO despliega automáticamente** para prevenir corrupción o duplicidad de datos. Requiere intervención y revisión humana.
4. **Protección del Motor de Base de Datos:** Los contenedores de microservicios se reconstruyen usando `--no-deps`, garantizando que el contenedor `talento360_db` y su volumen `postgres_data` jamás sean destruidos o reiniciados innecesariamente.
5. **Verificación de Salud y Rollback:** Tras reconstruir, el script espera 10 segundos y valida una respuesta HTTP satisfactoria en `http://127.0.0.1/`. Si el frontend no responde, el script revierte automáticamente el repositorio al commit previo (`git reset --hard $OLD`) y restablece los servicios anteriores.

---

## 🛠️ Comandos de Monitoreo y Diagnóstico

```bash
# Ver registro de eventos de la última actualización
sudo journalctl -u talento360-update.service -n 50 --no-pager

# Consultar estado del temporizador
sudo systemctl status talento360-update.timer --no-pager

# Forzar una comprobación de actualización manual
sudo systemctl start talento360-update.service

# Pausar el actualizador automático (mantenimiento o auditorías)
sudo systemctl stop talento360-update.timer

# Reanudar el actualizador
sudo systemctl start talento360-update.timer

# Inspeccionar respaldos creados en el servidor
sudo ls -lh /var/backups/talento360
```
