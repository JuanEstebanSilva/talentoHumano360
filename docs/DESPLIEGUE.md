# GUÍA DEFINITIVA, PASO A PASO Y AMIGABLE
## Despliegue de Talento 360 en Servidor Local Linux (On-Premise)
### Sistema de Gestión de Talento Humano — Gobernación de Boyacá

---

## 🌟 BIENVENIDA Y PROPÓSITO DE ESTA GUÍA

¡Hola! Esta guía fue escrita especialmente para que **cualquier persona**, incluso sin experiencia previa en servidores ni en Linux, pueda tomar un computador físico de la Gobernación de Boyacá y transformarlo en el **Servidor Central de Talento 360**.

Al finalizar este procedimiento:
1. El computador seleccionado funcionará de forma autónoma como el servidor central en la oficina o centro de datos.
2. Todos los computadores de la entidad conectados a la red local (por cable o Wi-Fi) podrán usar el sistema abriendo su navegador web favorito (Google Chrome, Microsoft Edge, etc.) ingresando a una dirección como `http://192.168.1.100`.
3. Todos los datos, expedientes, resoluciones, horarios y viáticos estarán seguros, respaldados automáticamente y centralizados en un único lugar.

---

## 🧭 GLOSARIO AMIGABLE: 5 CONCEPTOS BÁSICOS

Para que te sientas completamente cómodo durante el proceso, aquí tienes las palabras clave explicadas de forma sencilla:

1. **Servidor Local (On-Premise):** Es simplemente un computador que se deja encendido en la oficina, conectado a la red, cuya única tarea es atender las solicitudes de los demás computadores.
2. **Linux / Ubuntu Server:** Es el sistema operativo (como Windows), pero diseñado específicamente para servidores. Es ultra-estable, no se satura con el tiempo, es gratuito y no gasta memoria en barras de tareas ni animaciones innecesarias.
3. **Docker:** Imagina que Docker es un barco de carga con contenedores marítimos estandarizados. Dentro de cada contenedor ya viene todo listo (Node.js, PostgreSQL, Nginx) exactamente igual a como funciona en desarrollo. No tienes que configurar librerías complicadas en el computador.
4. **IP Local (ej. `192.168.1.100`):** Es el "número telefónico" único que identifica a este computador dentro de la red interna de la Gobernación.
5. **SSH:** Es una forma segura de conectar tu teclado y pantalla desde tu computador habitual (con Windows) hacia el servidor Linux a través de la red, para que no tengas que estar físicamente sentado frente al servidor.

---

## 📋 CHECKLIST: ¿QUÉ NECESITAS ANTES DE EMPEZAR?

Asegúrate de tener a mano los siguientes elementos antes de comenzar:

- [ ] **1 Computador para el Servidor:** Equipo de escritorio (recomendado) o portátil, con su cargador o cable de poder.
- [ ] **1 Memoria USB:** De al menos **8 GB**, vacía o respaldada (se formateará por completo).
- [ ] **1 Cable de red Ethernet (RJ45):** Para conectar el servidor directamente al switch o router de la Gobernación.
- [ ] **Tu computador habitual de trabajo (con Windows e Internet):** Para preparar la USB y conectarte remotamente.
- [ ] **Un cuaderno o bloc de notas:** Para anotar las contraseñas e IPs que asignaremos.

---

## ⚙️ REQUISITOS DEL COMPUTADOR SERVIDOR Y SUS LÍMITES

Antes de instalar, revisemos qué capacidades debe tener el computador para que funcione rápido y sin caídas:

| Componente | Requisito Mínimo Absoluto | Requisito Recomendado (Ideal) | ¿Qué pasa si no se cumple? |
| :--- | :--- | :--- | :--- |
| **Procesador (CPU)** | 64 bits (x86_64), 2 núcleos (Intel Core i3 / AMD Ryzen 3) | 4 núcleos o más (Intel Core i5 / i7 / Xeon o AMD Ryzen 5) | Procesadores de 32 bits **no funcionan**. Menos de 2 núcleos hará lentos los reportes PDF. |
| **Memoria RAM** | **4 GB** (El sistema usa ~2 GB en reposo) | **8 GB a 16 GB** DDR4/DDR5 | ⚠️ **Con menos de 4 GB el sistema colapsará** cuando varios funcionarios consulten o registren al mismo tiempo. |
| **Disco Duro** | 60 GB libres en **Unidad de Estado Sólido (SSD)** | 120 GB a 250 GB (**SSD NVMe**) | ⚠️ **Evita a toda costa discos mecánicos antiguos (HDD)**: la base de datos se volverá lenta y pesada. |
| **Conexión de Red** | Tarjeta de red Gigabit por cable (RJ45) | Conexión directa al switch institucional | ⚠️ **No uses Wi-Fi en el servidor**: microcortes inalámbricos cerrarán la sesión de los usuarios. |
| **Energía** | Regulador de voltaje | **UPS (Batería ininterrumpida)** | Si se corta la luz mientras se escribe en la base de datos, un corte brusco puede corromper información. |
| **Tipo de Equipo** | Computador de escritorio o portátil | Torre de escritorio / Computador corporativo | Si usas un portátil, debes asegurarte de que no se suspenda al cerrar la pantalla. |

---

## 🌐 ENLACES DIRECTOS Y GRATUITOS DE DESCARGA

Descarga estos dos programas oficiales en tu computador habitual con Windows:

1. **Imagen de Ubuntu Server 24.04 LTS (Archivo ISO):**  
   🔗 [https://ubuntu.com/download/server](https://ubuntu.com/download/server)  
   *(Haz clic en el botón verde "Download Ubuntu Server 24.04 LTS". Descargará un archivo `.iso` de unos 2.6 GB).*

2. **Rufus (Programa para grabar la ISO en la memoria USB):**  
   🔗 [https://rufus.ie/](https://rufus.ie/)  
   *(Baja un poco en la página y descarga la versión estándar "Rufus portátil / portable").*

---

# 🚀 PASO A PASO: GUÍA DE IMPLEMENTACIÓN COMPLETA

---

## FASE 1: CREAR LA MEMORIA USB BOOTEABLE (EN TU PC CON WINDOWS)

1. Conecta tu memoria USB (mínimo 8 GB) a tu computador con Windows.
2. Abre el programa **Rufus** que descargaste.
3. Configúralo exactamente así:
   - **Dispositivo:** Selecciona tu memoria USB.
   - **Elección de arranque:** Clic en el botón **SELECCIONAR** y busca el archivo ISO de Ubuntu Server que descargaste.
   - **Esquema de partición:** Déjalo en **GPT**.
   - **Sistema de destino:** Déjalo en **UEFI (no CSM)**.
   - Las demás opciones déjalas tal como están.
4. Haz clic abajo en el botón **EMPEZAR**.
5. Si te aparece una ventana preguntando cómo escribir la imagen, selecciona **"Escribir en modo Imagen ISO (Recomendado)"** y pulsa **OK**.
6. Aparecerá una advertencia indicando que se borrarán los datos de la USB. Confirma pulsando **Aceptar**.
7. Verás una barra de progreso verde. Cuando llegue al final y diga **PREPARADO**, haz clic en **Cerrar**.
8. Expulsa la memoria USB de tu computador de forma segura. ¡Tu USB de instalación está lista!

---

## FASE 2: INSTALAR UBUNTU SERVER EN EL COMPUTADOR DESTINO

1. Conecta el computador que será el servidor al cable de red Ethernet (RJ45).
2. Conecta la memoria USB booteable en cualquier puerto USB del equipo.
3. Conéctale una pantalla y un teclado temporalmente para la instalación.
4. Enciende el equipo y, apenas presiones el botón de encendido, **presiona repetidamente la tecla del menú de arranque (Boot Menu)**:
   - **HP:** Presiona repetidamente `F9` (o `Esc` y luego `F9`).
   - **Dell:** Presiona repetidamente `F12`.
   - **Lenovo:** Presiona repetidamente `F12`.
   - **Asus / Acer / Otras marcas:** Presiona `F8`, `F11` o `F12`.
5. Aparecerá un menú con fondo azul o negro. Con las flechas del teclado, selecciona la opción que contenga el nombre de tu memoria USB con la palabra **UEFI** y presiona `Enter`.
6. Verás una pantalla negra con letras blancas que dice `Try or Install Ubuntu Server`. Presiona `Enter`.

### Asistente de Instalación (Paso a Paso con el Teclado):

> [!NOTE]
> En este instalador no se usa el ratón. Te mueves con las **flechas del teclado**, cambias de opción con la tecla **Tab** (tabulador), marcas opciones con la **Barra Espaciadora** y confirmas con **Enter**.

1. **Language:** Selecciona **Español** (o *English*) y presiona `Enter`.
2. **Keyboard configuration:** 
   - En *Layout* selecciona `Spanish (Latin American)` y presiona `Enter` sobre **Hecho (Done)**.
3. **Choose type of install:**
   - Deja marcada la opción por defecto: `Ubuntu Server`.
   - Baja con la flecha hasta **Hecho (Done)** y presiona `Enter`.
4. **Network connections:**
   - El sistema detectará automáticamente tu cable de red y te mostrará una dirección IP (por ejemplo `192.168.1.45/24`).
   - **¡IMPORTANTE!** Toma una foto con tu celular o anota esa dirección IP en tu cuaderno. Esa es la dirección provisional del servidor.
   - Baja a **Hecho (Done)** y presiona `Enter`.
5. **Configure proxy:**
   - Déjalo completamente en blanco a menos que en la Gobernación te den un proxy específico.
   - Presiona `Enter` en **Hecho (Done)**.
6. **Configure Ubuntu archive mirror:**
   - Déjalo con la dirección por defecto que aparece (`http://co.archive.ubuntu.com/ubuntu`).
   - Presiona `Enter` en **Hecho (Done)**.
7. **Guided storage configuration (Disco duro):**
   - Asegúrate de que esté seleccionada la opción: **[X] Use an entire disk** (Usar todo el disco).
   - *Consejo amigable:* Desmarca la casilla que dice "Set up this disk as an LVM group" para que la partición sea sencilla y directa.
   - Baja a **Hecho (Done)** y presiona `Enter`.
   - Te mostrará un resumen del disco. Baja a **Hecho (Done)** y presiona `Enter`.
   - Aparecerá un aviso en rojo advirtiendo que se borrará el disco. Selecciona **Continuar (Continue)** y presiona `Enter`.
8. **Profile setup (Tus datos de acceso):**
   Completa los campos con las flechas:
   - *Su nombre:* `Administrador Talento 360`
   - *Nombre de su servidor:* `servidor-talento360`
   - *Nombre de usuario:* `admin-talento` *(¡Anota este usuario!)*
   - *Contraseña:* Escribe una contraseña segura que recuerdes *(¡Anótala!)*
   - *Confirme su contraseña:* Escríbela nuevamente.
   - Baja a **Hecho (Done)** y presiona `Enter`.
9. **Ubuntu Pro:**
   - Selecciona **Skip for now** (Omitir por ahora) y presiona `Enter`.
10. **Configuración SSH (¡EL PASO MÁS IMPORTANTE!):**
    - Verás una opción que dice `Install OpenSSH server`.
    - Presiona la **BARRA ESPACIADORA** para que quede marcada con una cruz:  
      `[*] Install OpenSSH server`
    - Baja a **Hecho (Done)** y presiona `Enter`.  
    *(Esto es lo que nos permitirá controlar el servidor desde tu propio computador Windows sin cables).*
11. **Featured Server Snaps:**
    - No selecciones ninguno. Baja directo a **Hecho (Done)** y presiona `Enter`.
12. **Instalación:**
    - Verás que el sistema comienza a instalarse. Espera unos 5 a 10 minutos mientras copia los archivos.
    - Cuando termine, abajo cambiará el mensaje y dirá **Reboot Now** (Reiniciar ahora). Presiona `Enter`.
13. **Retirar la USB:**
    - La pantalla dirá: *"Please remove the installation medium, then press ENTER"*.
    - Desconecta la memoria USB del computador y presiona `Enter`.

El computador se reiniciará y se quedará en una pantalla negra pidiendo login:  
`servidor-talento360 login:`  

¡Felicitaciones! Linux Ubuntu Server ya está 100% instalado en el equipo.

---

## FASE 3: CONECTARTE AL SERVIDOR DESDE TU PROPIO COMPUTADOR CON WINDOWS

A partir de este momento, **ya no necesitas monitor ni teclado en el servidor**. Puedes dejar la torre en un rincón ventilado o en el rack, conectada a su cable de red y corriente.

Todo lo demás lo haremos cómodamente desde tu computador con Windows:

1. En tu computador con Windows, presiona la tecla `Windows` y escribe **PowerShell**. Ábrelo.
2. Escribe el siguiente comando (usando la IP que anotaste en el paso 4 de la Fase 2, por ejemplo `192.168.1.45`):
   ```powershell
   ssh admin-talento@192.168.1.45
   ```
3. La primera vez que te conectes, te saldrá un mensaje en inglés preguntando si confías en este equipo:
   `Are you sure you want to continue connecting (yes/no/[fingerprint])?`
   Escribe **`yes`** y presiona `Enter`.
4. Te pedirá tu contraseña:
   > [!IMPORTANT]
   > **En Linux, cuando escribes una contraseña en la terminal, NO se ven asteriscos ni puntos.** Esto es normal por motivos de seguridad. Escribe tu contraseña calmadamente y presiona `Enter`.

Verás que tu terminal de PowerShell cambia de aspecto y muestra un saludo verde:
`admin-talento@servidor-talento360:~$`

¡Ya estás dentro del servidor!

---

## FASE 4: CONFIGURACIÓN BÁSICA DEL SISTEMA OPERATIVO

Copia y pega estos comandos uno a uno en la terminal:

### 1. Establecer la hora oficial de Colombia:
```bash
sudo timedatectl set-timezone America/Bogota
```
*(Si te pide contraseña, ingrésala y presiona Enter).*

### 2. Actualizar el sistema a la última versión:
```bash
sudo apt update && sudo apt upgrade -y
```
*(Esto descargará los últimos parches de seguridad de Ubuntu. Tardará un par de minutos).*

---

## FASE 5: INSTALAR DOCKER Y DOCKER COMPOSE EN LINUX

Para que Talento 360 funcione con todos sus contenedores, necesitamos instalar Docker. Copia y pega este bloque de comandos tal cual:

```bash
# 1. Instalar utilidades necesarias
sudo apt install -y ca-certificates curl gnupg git

# 2. Agregar la clave oficial de seguridad de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Registrar el repositorio oficial de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Instalar Docker Engine y Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Dar permisos a tu usuario para usar Docker sin escribir sudo todo el tiempo
sudo usermod -aG docker $USER

# 6. Activar Docker para que siempre arranque solo si se reinicia la máquina
sudo systemctl enable docker
sudo systemctl start docker
```

Para que los permisos de Docker se activen, sal de la sesión escribiendo:
```bash
exit
```
Y vuelve a ingresar por SSH desde PowerShell:
```powershell
ssh admin-talento@192.168.1.45
```

Comprueba que Docker esté listo ejecutando:
```bash
docker --version
docker compose version
```
*(Deberás ver que responde con las versiones de Docker y Docker Compose).*

---

## FASE 6: LLEVAR EL PROYECTO TALENTO 360 AL SERVIDOR

Como tu proyecto ya está completamente subido a GitHub en la rama principal (`main`), traerlo al servidor es increíblemente sencillo.

Ejecuta estos tres comandos en la terminal de Linux:

```bash
# 1. Crear la carpeta oficial de aplicaciones
sudo mkdir -p /opt/talento360
sudo chown -R $USER:$USER /opt/talento360

# 2. Descargar todo el proyecto desde GitHub
git clone https://github.com/JuanEstebanSilva/talentoHumano360.git /opt/talento360

# 3. Entrar a la carpeta web del proyecto
cd /opt/talento360/web
```

> **¿Qué archivos llegaron?**
> Todo el proyecto oficial:
> - `database/` (con los 27 scripts SQL que crean la base de datos y cargan los catálogos).
> - `web/` (con los 8 microservicios, el frontend Nginx y el archivo `docker-compose.yml`).
> - Las carpetas pesadas como `node_modules` no hacen falta porque Docker las creará de forma limpia dentro de Linux.

---

## FASE 7: CONFIGURAR EL ARCHIVO `.env` EN EL SERVIDOR

El archivo `.env` guarda la contraseña de la base de datos y las claves de seguridad.

Estando dentro de `/opt/talento360/web`, abre el editor de texto:
```bash
nano .env
```

> **¿Cómo usar el editor `nano`?**
> - Es un bloc de notas dentro de la terminal. Te mueves con las flechas del teclado.
> - Para guardar: Presionas `Ctrl + O` y luego `Enter`.
> - Para salir: Presionas `Ctrl + X`.

Pega o ajusta el contenido para que quede así (puedes inventar tu propia contraseña segura):

```env
# Entorno de Producción
NODE_ENV=production

# Base de Datos PostgreSQL
POSTGRES_DB=talento360
POSTGRES_USER=postgres
POSTGRES_PASSWORD=GobernacionBoyaca2026_Segura!

# Puerto seguro interno
POSTGRES_PORT=127.0.0.1:5432:5432

# Token de seguridad JWT
JWT_SECRET=Talento360_SuperSecreto_Produccion_Boyaca_2026_Key
JWT_EXPIRES_IN=8h

# CORS
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
```

Presiona `Ctrl + O`, pulsa `Enter` para confirmar y luego sal con `Ctrl + X`.

---

## FASE 8: EL GRAN DESPLIEGUE (LEVANTAR LOS CONTENEDORES)

¡Llegó el momento cumbre! Estando en `/opt/talento360/web`, ejecuta el comando maestro:

```bash
docker compose up -d --build
```

### ¿Qué significa cada parte de este comando?
- `docker compose up`: Ordena encender todos los servicios del proyecto.
- `-d` (*detached*): Hace que todo corra en segundo plano, para que tu consola quede libre.
- `--build`: Le dice a Docker que compile y arme las imágenes asegurando que tomen todo el código actualizado.

Verás que Docker empieza a descargar las bases y a compilar cada servicio. Esto tardará entre **3 y 6 minutos** la primera vez.

### ¿Cómo saber si todo quedó funcionando bien?
Ejecuta:
```bash
docker compose ps
```

Deberás ver los **10 contenedores** con el estado `Up` o `healthy`:
1. `talento360_db` (PostgreSQL 16)
2. `talento360_auth` (Servicio de Login y Usuarios)
3. `talento360_employees` (Gestión de Planta y Servidores)
4. `talento360_requests` (Vacaciones y Permisos)
5. `talento360_admin_requests` (Aprobaciones de Solicitudes)
6. `talento360_viaticos` (Módulo de Viáticos y Comisiones)
7. `talento360_dashboard` (Estadísticas y Auditoría)
8. `talento360_horarios` (Acuerdos Laborales y Horarios)
9. `talento360_sst` (Seguridad y Salud en el Trabajo)
10. `talento360_frontend` (Nginx Gateway en el puerto 80)

---

## FASE 9: ABRIR EL FIREWALL DEL SERVIDOR

Para asegurarnos de que el cortafuegos de Linux permita la entrada de los demás computadores de la Gobernación, ejecuta:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```
*(Si te pregunta `Command may disrupt existing ssh connections. Proceed with operation (y|n)?`, presiona `y` y luego `Enter`).*

---

## FASE 10: ¡PRUEBA FINAL DESDE CUALQUIER COMPUTADOR!

1. Ve a cualquier computador de la oficina (o a tu propio computador habitual).
2. Asegúrate de estar conectado a la red de la Gobernación (por cable o a la red Wi-Fi de la oficina).
3. Abre Google Chrome o Edge.
4. En la barra de direcciones escribe la IP de tu servidor:
   ```
   http://192.168.1.45
   ```
   *(Cambia `192.168.1.45` por la IP real de tu servidor).*

¡Inmediatamente se abrirá la pantalla de **Talento 360**!
Podrás iniciar sesión con cualquiera de los perfiles institucionales:
- **Ángela Ussa** (Talento Humano / Servidores)
- **Blanca Guerrero** (Talento Humano / Planta)
- **Doris Gómez** (Horarios y Acuerdos Laborales)
- **Belgenet** (Viáticos y Comisiones)
- **Administrador General**

---

## 🛡️ COPIAS DE SEGURIDAD AUTOMÁTICAS TODAS LAS NOCHES

Para que nunca tengas que preocuparte por perder datos, programaremos una copia de seguridad automática que se ejecutará todos los días a las **11:30 p.m.**:

1. En la terminal de Linux, crea la carpeta donde se guardarán los respaldos:
   ```bash
   sudo mkdir -p /var/backups/talento360
   sudo chown -R $USER:$USER /var/backups/talento360
   ```

2. Crea el archivo de respaldo automático:
   ```bash
   nano /home/admin-talento/backup_diario.sh
   ```

3. Pega este texto:
   ```bash
   #!/bin/bash
   FECHA=$(date +'%Y%m%d_%H%M%S')
   DESTINO="/var/backups/talento360"
   docker exec talento360_db pg_dump -U postgres -d talento360 -F c -b -v > "$DESTINO/backup_$FECHA.dump"
   # Borrar respaldos de mas de 30 dias para no llenar el disco
   find "$DESTINO" -type f -name "*.dump" -mtime +30 -delete
   ```
   Guarda con `Ctrl + O`, `Enter` y sal con `Ctrl + X`.

4. Dale permisos de ejecución:
   ```bash
   chmod +x /home/admin-talento/backup_diario.sh
   ```

5. Agrégalo al reloj del sistema (*crontab*):
   ```bash
   crontab -e
   ```
   *(Si te pregunta qué editor usar, elige el número que corresponda a `nano`, usualmente el 1).*  
   Ve hasta el final del archivo y agrega esta línea:
   ```cron
   30 23 * * * /home/admin-talento/backup_diario.sh > /dev/null 2>&1
   ```
   Guarda con `Ctrl + O`, `Enter` y sal con `Ctrl + X`.

¡A partir de hoy, todos los días a las 11:30 p.m. el servidor guardará un respaldo completo de la base de datos!

---

## 🔧 GUÍA DE SOLUCIÓN DE PROBLEMAS (¿QUÉ HAGO SI...?)

### 1. ¿Qué hago si entro a la IP y el navegador dice "No se puede conectar"?
- Verifica que el computador desde el que intentas entrar esté en la **misma red** que el servidor (mismo Wi-Fi o red por cable).
- Verifica que el contenedor del frontend esté corriendo ejecutando en el servidor:
  ```bash
  docker compose ps
  ```
- Comprueba que el firewall tenga abierto el puerto 80 ejecutando:
  ```bash
  sudo ufw status
  ```

### 2. ¿Qué pasa si se corta la luz en la oficina?
- Cuando regrese la luz y el computador se encienda, **Docker y los 10 contenedores arrancarán solos automáticamente**, sin que tengas que tocar nada, gracias a la regla `restart: unless-stopped` que ya dejamos configurada.

### 3. ¿Cómo apago o reinicio el servidor de forma segura?
- Para reiniciar:
  ```bash
  sudo reboot
  ```
- Para apagar completamente el equipo sin dañar la base de datos:
  ```bash
  sudo shutdown -h now
  ```

### 4. Hice cambios o mejoras en el código en mi computador y los subí a GitHub, ¿cómo los aplico en el servidor?
Simplemente conéctate por SSH al servidor y corre estos dos comandos:
```bash
cd /opt/talento360
git pull origin main
cd web && docker compose up -d --build
```
¡En menos de un minuto el servidor estará actualizado con los últimos cambios sin perder ningún dato de la base de datos!

---

## 📑 RESUMEN DE COMANDOS ÚTILES PARA TENER A MANO

| Lo que quieres hacer | Comando a escribir |
| :--- | :--- |
| Conectarte al servidor desde Windows | `ssh admin-talento@IP_DEL_SERVIDOR` |
| Ver si los 10 contenedores están funcionando | `cd /opt/talento360/web && docker compose ps` |
| Ver qué está pasando en tiempo real (logs) | `cd /opt/talento360/web && docker compose logs -f` |
| Reiniciar los contenedores | `cd /opt/talento360/web && docker compose restart` |
| Detener todo el sistema temporalmente | `cd /opt/talento360/web && docker compose down` |
| Ver cuánta memoria RAM y CPU está usando Docker | `docker stats` |
| Reiniciar el computador servidor | `sudo reboot` |
| Apagar el computador servidor | `sudo shutdown -h now` |

---
*Gobernación de Boyacá — Dirección de Talento Humano.*  
*Manual de Puesta en Producción Local — Talento 360.*
