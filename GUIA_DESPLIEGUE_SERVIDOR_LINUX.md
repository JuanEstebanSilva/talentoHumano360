# GUÍA DEFINITIVA DE DESPLIEGUE EN SERVIDOR LOCAL LINUX (ON-PREMISE)
## Sistema de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá

---

## 1. INTRODUCCIÓN Y CONCEPTO CLAVE

Esta guía detalla el procedimiento paso a paso para transformar cualquier computador físico (de escritorio, torre corporativa o servidor dedicado) en un **Servidor de Producción Local** ejecutando **Linux** y **Docker**.

### ¿Cómo funciona la arquitectura en la red de la Gobernación?

```
┌────────────────────────────────────────────────────────────────────────┐
│                          RED LOCAL (LAN / WI-FI)                       │
│                           Gobernación de Boyacá                        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────┐                           ┌──────────────────────┐
│  Computador Usuario  │                           │  Computador Usuario  │
│    (Navegador Web)   │                           │    (Navegador Web)   │
│ http://192.168.1.100 │                           │ http://192.168.1.100 │
└──────────┬───────────┘                           └──────────┬───────────┘
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     │ Solicitudes HTTP (Puerto 80)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   SERVIDOR FÍSICO LINUX (Ubuntu Server)                │
│                   IP Fija Local: Ej. 192.168.1.100                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     NGINX (Gateway / Puerto 80)                  │  │
│  │             Sirve el Frontend + Enruta peticiones /api           │  │
│  └───────┬────────────┬─────────────┬─────────────┬─────────────┬───┘  │
│          │            │             │             │             │      │
│          ▼            ▼             ▼             ▼             ▼      │
│     [Auth:3001] [Empleados:3002] [Viáticos:3005] [Horarios:3007] ...  │
│          │            │             │             │             │      │
│          └────────────┴───────┬─────┴─────────────┴─────────────┘      │
│                               ▼                                        │
│                 [PostgreSQL 16: Puerto 5432]                           │
│                 Volumen de Datos Persistente                           │
└────────────────────────────────────────────────────────────────────────┘
```

Gracias a **Docker**, no necesitas instalar Node.js, Nginx ni PostgreSQL manualmente en el sistema operativo del computador. Los contenedores empaquetan todo el entorno idéntico a como funciona en desarrollo, garantizando **cero incompatibilidades** y una portabilidad del 100%.

---

## 2. REQUISITOS DEL HARDWARE Y LIMITACIONES DEL COMPUTADOR

Antes de iniciar la instalación, verifica que el equipo cumpla con las siguientes especificaciones:

| Componente | Requisito Mínimo Absoluto | Requisito Recomendado (Producción) | Impacto / Limitación si no se cumple |
| :--- | :--- | :--- | :--- |
| **Procesador (CPU)** | 64 bits (x86_64), 2 núcleos (Intel Core i3 / AMD Ryzen 3) | 4 núcleos o más (Intel Core i5/i7/Xeon o AMD Ryzen 5) | Sistemas de 32 bits **no son compatibles**. Menos de 2 núcleos ralentizará la generación masiva de PDFs y reportes. |
| **Memoria RAM** | **4 GB** (El stack completo consume ~1.8 GB a 2.2 GB en reposo) | **8 GB a 16 GB** DDR4 / DDR5 | **Con menos de 4 GB el sistema colapsará** por falta de memoria (OOM Killer) al procesar consultas concurrentes de nómina o viáticos. |
| **Almacenamiento (Disco)** | 60 GB libres en unidad de estado sólido (**SSD**) | 120 GB a 250 GB (**SSD NVMe**) | **Prohibido usar discos mecánicos antiguos (HDD)**: la construcción de imágenes Docker y las operaciones de base de datos se volverían hasta 10 veces más lentas. |
| **Conectividad de Red** | Tarjeta Ethernet Gigabit (RJ45 por cable) | Conexión cableada directa al switch/router institucional | **No usar Wi-Fi en el servidor**: la latencia, interferencias o microcortes desconectarán las sesiones activas de los usuarios. |
| **Suministro Eléctrico** | Conexión con regulador | Conexión a **UPS (Batería ininterrumpida)** | Un corte abrupto de energía puede corromper tablas de PostgreSQL si ocurre durante una transacción de escritura. |
| **Aparato Físico** | Computador de escritorio o portátil | Computador de escritorio corporativo (Torre o SFF) | Si usas un portátil, debes desactivar la suspensión automática al cerrar la tapa y asegurar buena ventilación continua. |

---

## 3. SELECCIÓN DE LA DISTRIBUCIÓN LINUX

### ¿Cuál versión instalar?
- **Distribución Recomendada:** **Ubuntu Server 24.04 LTS (Noble Numbat)** de 64 bits.
- **¿Por qué Ubuntu Server y no Ubuntu Desktop?**
  - **Ubuntu Server** no tiene entorno gráfico (ventanas, botones, escritorios). Consume apenas **~350 MB de memoria RAM** en reposo. Todo el poder del computador queda libre para Docker y la base de datos.
  - **Ubuntu Desktop** (con entorno gráfico GNOME) consume **~1.8 GB de memoria RAM** solo para mostrar la pantalla de escritorio, desperdiciando recursos valiosos.
- **¿Qué significa LTS?** *Long Term Support* (Soporte a Largo Plazo). Garantiza estabilidad, parches de seguridad y compatibilidad oficial de librerías hasta el año 2029 (extensible a 2034).

### Enlaces Oficiales de Descarga (Software Gratuito):
1. **Ubuntu Server 24.04 LTS (Archivo ISO):**
   - Enlace directo oficial: [https://ubuntu.com/download/server](https://ubuntu.com/download/server)
2. **Rufus (Herramienta para crear la USB booteable en Windows):**
   - Enlace directo oficial: [https://rufus.ie/](https://rufus.ie/)

---

## 4. FASE 1: CREACIÓN DE LA MEMORIA USB BOOTEABLE

Realiza estos pasos en tu computador actual con Windows:

1. Consigue una memoria USB de al menos **8 GB** (asegúrate de que no tenga datos importantes, pues será formateada).
2. Descarga la imagen ISO de **Ubuntu Server 24.04 LTS** desde el enlace oficial.
3. Descarga y abre **Rufus**.
4. En Rufus, configura:
   - **Dispositivo:** Selecciona tu memoria USB.
   - **Elección de arranque:** Clic en *Seleccionar* y elige el archivo ISO de Ubuntu Server descargado.
   - **Esquema de partición:** **GPT** (para computadores modernos con UEFI) o **MBR** (si el computador es muy antiguo con BIOS Legacy).
   - **Sistema de destino:** UEFI (no CSM).
5. Haz clic en **Empezar**. Si pregunta por el modo de escritura, selecciona *Escribir en modo imagen ISO (Recomendado)* y acepta.
6. Espera a que la barra verde llegue al 100% (*Preparado*) y expulsa la memoria USB de forma segura.

---

## 5. FASE 2: INSTALACIÓN DE LINUX EN EL COMPUTADOR SERVIDOR

1. Conecta el computador destinado al servidor a la red mediante **cable de red Ethernet (RJ45)**.
2. Inserta la memoria USB booteable en el equipo.
3. Enciende el computador y presiona repetidamente la tecla del menú de arranque (*Boot Menu*):
   - HP: `F9` o `Esc`
   - Dell: `F12`
   - Lenovo: `F12` o botón Novo
   - Asus / Acer / Otros: `F8`, `F11` o `F12`
4. Selecciona la memoria USB (opción UEFI) para iniciar el instalador.
5. Sigue el asistente interactivo de Ubuntu Server:
   - **Language:** Selecciona *Español* o *English*.
   - **Keyboard configuration:** Selecciona *Spanish (Latin American)*.
   - **Choose type of install:** Selecciona *Ubuntu Server* (versión estándar por defecto).
   - **Network connections:** Mostrará la interfaz de red Ethernet (ej. `eth0` o `enp3s0`). Tomará una IP por DHCP automáticamente. *Anota esta IP provisional*.
   - **Configure proxy:** Dejar en blanco a menos que la Gobernación use un proxy corporativo para salir a internet.
   - **Configure Ubuntu archive mirror:** Dejar el valor por defecto (`http://co.archive.ubuntu.com/ubuntu`).
   - **Guided storage configuration:**
     - Selecciona **Use an entire disk** (Usar todo el disco).
     - *Recomendación:* Desmarca la casilla "Set up this disk as an LVM group" si quieres simplificar el particionado para principiantes, o déjala marcada si sabes administrar volúmenes lógicos.
     - Confirma la advertencia de formateo de disco (*Continue*).
   - **Profile setup:**
     - *Your name:* `Administrador Talento 360`
     - *Your server's name:* `servidor-talento360`
     - *Pick a username:* `admin-talento` (este será tu usuario en Linux)
     - *Choose a password:* Escribe una contraseña robusta (anótala en un lugar seguro).
   - **Upgrade to Ubuntu Pro:** Selecciona *Skip for now* (Omitir por ahora).
   - **SSH Setup (¡MUY IMPORTANTE!):**
     - **Marca con la barra espaciadora la casilla: `[*] Install OpenSSH server`**.
     - Esto te permitirá administrar el servidor remotamente desde tu computador con Windows sin necesidad de tenerle pantalla ni teclado conectados en el futuro.
   - **Featured Server Snaps:** No marques ninguno (Docker se instalará mediante el repositorio oficial de Docker para mayor estabilidad). Clic en *Done*.
6. El sistema comenzará la instalación y descargará actualizaciones. Al terminar, dirá **Installation complete**.
7. Selecciona **Reboot Now** (Reiniciar ahora).
8. Cuando aparezca el mensaje *"Please remove the installation medium, then press ENTER"*, retira la memoria USB y presiona `Enter`.

El equipo reiniciará y cargará una pantalla negra con texto pidiendo login:
`servidor-talento360 login:`

---

## 6. FASE 3: CONFIGURACIÓN INICIAL DEL SERVIDOR LINUX

Puedes realizar estas acciones directamente en la pantalla del servidor o, preferiblemente, desde tu computador habitual abriendo **PowerShell** y conectándote por SSH:

```powershell
ssh admin-talento@IP_DEL_SERVIDOR
```
*(Ingresas la contraseña creada durante la instalación).*

### 6.1. Actualizar repositorios y paquetes del sistema
Ejecuta en la terminal de Linux:
```bash
sudo apt update && sudo apt upgrade -y
```

### 6.2. Configurar la zona horaria institucional (Colombia)
```bash
sudo timedatectl set-timezone America/Bogota
```

### 6.3. Fijar la Dirección IP Local (IP Estática)
Para que los usuarios siempre accedan a la misma dirección (por ejemplo `192.168.1.100`), se debe fijar la IP.
Existen dos formas:
1. **Recomendada:** Solicitar al administrador de redes de la Gobernación que cree una reserva estática por dirección MAC en el router/DHCP.
2. **Configuración manual en Ubuntu con Netplan:**
   Verifica el nombre de tu tarjeta de red con:
   ```bash
   ip addr
   ```
   (Supongamos que se llama `enp3s0`). Edita el archivo de red:
   ```bash
   sudo nano /etc/netplan/50-cloud-init.yaml
   ```
   Configura la estructura (respetando los espacios y sangrías):
   ```yaml
   network:
     version: 2
     ethernets:
       enp3s0:
         dhcp4: no
         addresses:
           - 192.168.1.100/24
         routes:
           - to: default
             via: 192.168.1.1
         nameservers:
           addresses: [1.1.1.1, 8.8.8.8]
   ```
   Guarda con `Ctrl + O`, presiona `Enter`, y sal con `Ctrl + X`. Aplica los cambios:
   ```bash
   sudo netplan apply
   ```

---

## 7. FASE 4: INSTALACIÓN OFICIAL DE DOCKER ENGINE Y DOCKER COMPOSE

En Linux no se instala Docker Desktop; se instala el motor nativo **Docker Engine**, el cual corre de forma directa sobre el kernel de Linux con el máximo rendimiento posible.

Ejecuta el siguiente bloque de comandos en la terminal de Linux:

```bash
# 1. Instalar utilidades previas
sudo apt install -y ca-certificates curl gnupg lsb-release git

# 2. Agregar la clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Configurar el repositorio oficial de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Instalar Docker Engine y el plugin Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Permitir que tu usuario ejecute Docker sin requerir 'sudo' en cada comando
sudo usermod -aG docker $USER

# 6. Habilitar el servicio para que Docker arranque automáticamente si se reinicia la máquina
sudo systemctl enable docker
sudo systemctl start docker
```

*Nota:* Cierra la sesión y vuelve a ingresar para que los permisos de grupo surtan efecto:
```bash
exit
```
Vuelve a entrar por SSH:
```bash
ssh admin-talento@192.168.1.100
```
Verifica que Docker funcione:
```bash
docker --version
docker compose version
```
*(Debe responder mostrando las versiones instaladas, e.g., Docker version 27.x y Docker Compose v2.x).*

---

## 8. FASE 5: TRANSFERENCIA DEL PROYECTO AL SERVIDOR LINUX

### ¿Qué archivos se deben transferir?
Se debe transferir la totalidad del código fuente del sistema, incluyendo:
- Carpeta `database/` (con los 27 scripts de inicialización SQL).
- Carpeta `web/` (con los microservicios, el frontend y el archivo `docker-compose.yml`).
- Archivo de variables de entorno de producción: `web/.env`.

### ¿Qué archivos NO se deben transferir?
- Carpetas `node_modules/` (estas se autoconstruyen en Linux dentro de los contenedores Docker).
- Carpetas de pruebas temporales `scratch/`.

---

### Opción A (La más rápida y recomendada): Clonar directamente desde GitHub

Como el proyecto ya se encuentra actualizado en GitHub en la rama `main`, simplemente clónalo en el servidor:

```bash
# Crear directorio institucional de aplicaciones
sudo mkdir -p /opt/talento360
sudo chown -R $USER:$USER /opt/talento360

# Clonar el repositorio
git clone https://github.com/JuanEstebanSilva/talentoHumano360.git /opt/talento360

# Ingresar al directorio del proyecto
cd /opt/talento360
```

---

### Opción B: Copia manual desde Windows hacia Linux mediante SCP

Si por alguna razón no tienes salida directa a GitHub en el servidor, desde tu Windows abre PowerShell en la raíz del proyecto y copia las carpetas mediante `scp`:

```powershell
# En PowerShell (Windows)
scp -r D:\Varios\Varios\GitHub\talento360\database admin-talento@192.168.1.100:/opt/talento360/
scp -r D:\Varios\Varios\GitHub\talento360\web admin-talento@192.168.1.100:/opt/talento360/
```

---

## 9. FASE 6: CONFIGURACIÓN DEL ENTORNO DE PRODUCCIÓN (`web/.env`)

En el servidor Linux, ingresa a la carpeta `web`:
```bash
cd /opt/talento360/web
```

Crea o edita el archivo `.env` para producción:
```bash
nano .env
```

Pega la siguiente configuración recomendada y ajusta las contraseñas para producción:

```env
# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN DE PRODUCCIÓN — TALENTO 360 (GOBERNACIÓN DE BOYACÁ)
# ─────────────────────────────────────────────────────────────────────────────

NODE_ENV=production

# Base de Datos PostgreSQL
POSTGRES_DB=talento360
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Definir_Password_Seguro_Aqui_2026!

# Enlace de puertos: en producción local se puede enlazar a 5432:5432 o 127.0.0.1:5432:5432
POSTGRES_PORT=127.0.0.1:5432:5432

# JSON Web Token (Seguridad de Sesiones)
JWT_SECRET=Talento360_GobernacionBoyaca_ClaveCriptografica_Produccion_2026_X9z
JWT_EXPIRES_IN=8h

# CORS y Seguridad
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.1.100
```
*(Guarda con `Ctrl + O`, `Enter` y sal con `Ctrl + X`).*

---

## 10. FASE 7: CONSTRUCCIÓN Y DESPLIEGUE CON DOCKER COMPOSE

Una vez configurado el archivo `.env`, ejecuta el comando maestro de despliegue:

```bash
cd /opt/talento360/web
docker compose up -d --build
```

### ¿Qué hace este comando automáticamente?
1. Descarga las imágenes base ligeras (`alpine`, `node:20-alpine`, `postgres:16-alpine`, `nginx:alpine`).
2. Construye cada uno de los microservicios instalando sus dependencias productivas de Node.js.
3. Inicia la base de datos PostgreSQL y crea el volumen persistente `postgres_data`.
4. Ejecuta de forma secuencial y transparente todos los scripts SQL de inicialización ubicados en `/database` (desde el esquema base hasta las matrices RBAC y catálogos).
5. Inicia el servidor Nginx en el puerto `80`.

### Verificar que todos los contenedores estén activos y saludables:
```bash
docker compose ps
```

Deberás ver los **10 contenedores** en estado `Up` o `healthy`:
- `talento360_db`
- `talento360_auth`
- `talento360_employees`
- `talento360_requests`
- `talento360_admin_requests`
- `talento360_viaticos`
- `talento360_dashboard`
- `talento360_horarios`
- `talento360_sst`
- `talento360_frontend`

### Monitorear los logs en tiempo real:
```bash
# Ver los logs de todos los servicios
docker compose logs -f

# O ver los logs de un servicio específico
docker compose logs -f frontend
docker compose logs -f postgres
```
*(Para salir de los logs presiona `Ctrl + C`).*

---

## 11. FASE 8: MIGRACIÓN DE DATOS (SI REQUIERES COPIAR DATOS DE TU PC)

Si tienes datos reales en tu computador Windows que deseas transferir al servidor Linux:

### 1. En tu máquina Windows (generar el volcado):
```powershell
docker exec -t talento360_db pg_dump -U postgres -d talento360 -F c -b -v -f /tmp/talento360_backup.dump
docker cp talento360_db:/tmp/talento360_backup.dump D:\Varios\talento360_backup.dump
scp D:\Varios\talento360_backup.dump admin-talento@192.168.1.100:/tmp/
```

### 2. En el servidor Linux (restaurar el volcado):
```bash
docker cp /tmp/talento360_backup.dump talento360_db:/tmp/talento360_backup.dump
docker exec -i talento360_db pg_restore -U postgres -d talento360 -v --clean /tmp/talento360_backup.dump
```

*Si no requieres pasar datos previos porque vas a iniciar en limpio, no necesitas hacer este paso: el arranque inicial ya carga los catálogos institucionales limpios.*

---

## 12. FASE 9: CONFIGURACIÓN DEL FIREWALL DEL SERVIDOR

Para proteger el servidor y permitir el acceso de los demás computadores:

```bash
# Instalar UFW si no está activo
sudo apt install -y ufw

# Permitir SSH (administración remota)
sudo ufw allow 22/tcp

# Permitir HTTP (acceso de los usuarios al sistema)
sudo ufw allow 80/tcp

# Activar el firewall
sudo ufw enable
sudo ufw status
```

---

## 13. FASE 10: ACCESO FINAL DESDE CUALQUIER COMPUTADOR DE LA GOBERNACIÓN

¡Todo está listo! Desde cualquier computador conectado a la misma red local (cableada o Wi-Fi institucional):

1. Abre cualquier navegador moderno (Google Chrome, Microsoft Edge, Mozilla Firefox).
2. En la barra de direcciones escribe la IP del servidor Linux:
   ```
   http://192.168.1.100
   ```
   *(Reemplaza `192.168.1.100` por la IP real asignada a tu servidor).*
3. El sistema cargará de inmediato la pantalla de inicio de sesión de **Talento 360**.

---

## 14. POLÍTICA DE MANTENIMIENTO Y RESPALDOS AUTOMÁTICOS

### 14.1. Configuración de Copias de Seguridad Automáticas Diarias (Cron)
Crea un script de respaldo automático para proteger la información todas las noches:

1. Crea el directorio de respaldos:
   ```bash
   sudo mkdir -p /var/backups/talento360
   sudo chown -R $USER:$USER /var/backups/talento360
   ```

2. Crea el script de backup:
   ```bash
   nano /home/admin-talento/backup_talento360.sh
   ```
   Pega el siguiente contenido:
   ```bash
   #!/bin/bash
   FECHA=$(date +'%Y%m%d_%H%M%S')
   DESTINO="/var/backups/talento360"
   docker exec talento360_db pg_dump -U postgres -d talento360 -F c -b -v > "$DESTINO/talento360_$FECHA.dump"
   # Eliminar respaldos con más de 30 días de antigüedad
   find "$DESTINO" -type f -name "*.dump" -mtime +30 -delete
   ```
   Dale permisos de ejecución:
   ```bash
   chmod +x /home/admin-talento/backup_talento360.sh
   ```

3. Programa la tarea en `crontab`:
   ```bash
   crontab -e
   ```
   Agrega la siguiente línea al final para ejecutarlo todos los días a las 11:30 p. m.:
   ```cron
   30 23 * * * /home/admin-talento/backup_talento360.sh > /dev/null 2>&1
   ```

---

## 15. TABLA DE COMANDOS RÁPIDOS DE OPERACIÓN (CHEATSHEET)

| Acción | Comando (desde `/opt/talento360/web`) |
| :--- | :--- |
| **Iniciar todo el sistema** | `docker compose up -d` |
| **Detener el sistema completamente** | `docker compose down` |
| **Reiniciar un microservicio específico** | `docker compose restart viaticos-service` |
| **Verificar estado de los contenedores** | `docker compose ps` |
| **Ver logs en tiempo real** | `docker compose logs -f` |
| **Actualizar el sistema con cambios de Git** | `git pull origin main && docker compose up -d --build` |
| **Ver uso de CPU y Memoria RAM** | `docker stats` |
| **Reiniciar la máquina física del servidor** | `sudo reboot` |
| **Apagar la máquina física del servidor** | `sudo shutdown -h now` |

---
*Documento elaborado para la Gobernación de Boyacá — Dirección de Talento Humano.*  
*Versión: 1.0 — Noviembre 2026.*
