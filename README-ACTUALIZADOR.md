# Actualizador automático de Talento360 (v2)

## Instalación
Copiar estos cuatro archivos y la carpeta `systemd/` a la raíz del repositorio, hacer commit y subir a `main`.
En Ubuntu:

```bash
cd ~/talentoHumano360
git pull --ff-only origin main
bash instalar-actualizador.sh
sudo systemctl start talento360-update.service
sudo systemctl status talento360-update.service --no-pager
systemctl list-timers --all talento360-update.timer
```

## Funcionamiento
Cada ~5 minutos comprueba `origin/main`. Si no hay cambios no hace nada. Si hay cambios de código permitidos: crea un respaldo PostgreSQL en `/var/backups/talento360/`, valida el formato, avanza Git, reconstruye servicios distintos de `postgres` sin dependencias, y comprueba el frontend en `http://127.0.0.1/`. Ante fallo intenta volver al commit anterior. **No restaura automáticamente la base de datos**.

**Cambios sensibles se bloquean**: archivos SQL, carpetas de bases de datos/migraciones/semillas, archivos Compose, Dockerfile, `.env`, y `package.json` / `package-lock.json`. Requieren despliegue manual supervisado. Esto reduce riesgos, pero NO garantiza que código nuevo no altere datos o inserte duplicados. El código de arranque y las migraciones deben revisarse antes de confiar datos reales al sistema.

No se ejecuta `down -v`, `volume rm`, ni se recrea PostgreSQL durante el despliegue. No se crea una segunda base de datos. Los respaldos son archivos, no bases activas. No se borran respaldos automáticamente: vigilar espacio en disco y establecer política de retención.

## Comandos útiles
```bash
sudo journalctl -u talento360-update.service -n 40 --no-pager
sudo systemctl status talento360-update.timer --no-pager
sudo systemctl stop talento360-update.timer   # pausar actualizaciones
sudo systemctl start talento360-update.timer  # reanudar
sudo ls -lh /var/backups/talento360
```

## Limitaciones y precauciones
- Se asume ruta `/home/talento360-server/talentoHumano360`, usuario `talento360-server`, servicio `postgres`, contenedor `talento360_db` y puerto local 80.
- Las copias están en el mismo equipo: también deben copiarse periódicamente a un destino seguro externo, con permisos adecuados.
- La verificación HTTP comprueba solo el frontend; no garantiza funcionamiento de API ni integridad de datos.
- El rollback del código puede fallar y NO revierte cambios de esquema ni datos.
- La ejecución automática puede interrumpir usuarios. Para datos institucionales, obtener autorización, revisar migraciones y probar restauración y flujos reales antes de habilitar despliegues desatendidos.
