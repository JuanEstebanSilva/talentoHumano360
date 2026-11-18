# Guía de Diagnóstico y Solución de Problemas (Troubleshooting)
## Talento 360 — Gobernación de Boyacá

Esta guía proporciona soluciones paso a paso a las situaciones operativas y errores más frecuentes que pueden presentarse durante la instalación, actualización o uso diario de **Talento 360**.

---

## 1. Problemas de Inicio y Contenedores

### 1.1. Un contenedor se detiene inmediatamente o muestra estado `Exit 1`
- **Causa común:** Variable de entorno requerida no definida (por ejemplo, `JWT_SECRET` en blanco en producción) o fallo de conexión a la base de datos.
- **Diagnóstico:**
  ```bash
  cd /opt/talento360/web
  docker compose logs <nombre-servicio>
  ```
- **Solución:** Revisa el archivo `web/.env`. Asegúrate de que `JWT_SECRET` tenga al menos 64 caracteres y que las credenciales de PostgreSQL coincidan con las del contenedor de base de datos.

### 1.2. El puerto 80 ya está en uso por otro servicio en el servidor
- **Causa:** El servidor ya tiene instalado Apache, Nginx nativo u otro software escuchando en el puerto HTTP estándar.
- **Diagnóstico:**
  ```bash
  sudo ss -tulpn | grep :80
  ```
- **Solución:** Si se trata de un servicio Apache previo, deténlo (`sudo systemctl stop apache2 && sudo systemctl disable apache2`). Si requieres cambiar el puerto externo de Talento 360, modifica la línea de puertos de `frontend` en `web/docker-compose.yml` (e.g. `"8080:80"`).

---

## 2. Problemas de Base de Datos y Conexión

### 2.1. Error `ECONNREFUSED` al conectar con `postgres:5432`
- **Causa:** El contenedor de base de datos (`talento360_db`) aún se encuentra inicializando esquemas o recuperando el estado tras un apagón no planificado.
- **Diagnóstico:**
  ```bash
  docker compose ps postgres
  docker compose logs postgres
  ```
- **Solución:** Espera a que el healthcheck de PostgreSQL cambie a `(healthy)`. Los microservicios reintentarán la conexión automáticamente gracias a la directiva `depends_on: { condition: service_healthy }`.

### 2.2. Error `violates foreign key constraint ... on delete restrict`
- **Causa:** Se intentó eliminar una entidad padre (como una persona con horarios/viáticos o un paquete presupuestal con comisiones asociadas).
- **Explicación:** **No es un error del sistema, es un mecanismo de protección institucional.** El sistema previene intencionalmente la pérdida accidental de expedientes históricos y trazabilidad pública.
- **Solución:** Si la eliminación es legítima, primero deben reclasificarse o anularse los registros dependientes.

---

## 3. Problemas de Autenticación y Sesiones

### 3.1. Error `401: Credenciales inválidas` o token expirado
- **Causa 1:** El usuario ingresó una contraseña incorrecta o el usuario no existe.
- **Causa 2:** Desincronización de reloj en el servidor. Si el reloj del servidor está adelantado o atrasado respecto a los clientes, los tokens JWT se rechazan por no válidos en tiempo.
- **Solución:** Sincroniza la hora del servidor con el servidor horario nacional o NTP:
  ```bash
  sudo timedatectl set-ntp true
  timedatectl status
  ```

### 3.2. Error en el envío de correos de restablecimiento de contraseña
- **Causa:** Credenciales SMTP incorrectas o bloqueo de seguridad del proveedor (e.g. Gmail requiere Contraseña de Aplicación en lugar de la clave principal de la cuenta).
- **Diagnóstico:** Revisa los logs del microservicio de autenticación:
  ```bash
  cd /opt/talento360/web
  docker compose logs --tail=50 auth-service
  ```
- **Solución:** Verifica que `SMTP_USER` y `SMTP_PASS` en `web/.env` correspondan a una contraseña de aplicación válida y que el puerto sea `587`.

---

## 4. Problemas de Carga e Importación de Archivos Excel

### 4.1. Error: "Formato de archivo no soportado o encabezados faltantes"
- **Causa:** El archivo Excel cargado no utiliza las plantillas oficiales o las columnas fueron renombradas o reordenadas.
- **Solución:**
  1. Descarga la plantilla oficial directamente desde el botón **"Descargar Plantilla Oficial"** del módulo correspondiente (Horarios, Viáticos o Servidores Públicos).
  2. Diligencia los datos respetando los nombres exactos de las columnas.
  3. Asegúrate de guardar el archivo en formato `.xlsx` estándar.

### 4.2. Error: "Archivo excede el tamaño máximo permitido"
- **Causa:** El archivo de soporte o resolución supera el límite de 50MB.
- **Solución:** Nginx tiene configurado `client_max_body_size 50M;`. Si necesitas un límite mayor para archivos extraordinarios, edita `web/frontend/nginx.conf`, incrementa el valor a `100M` y reinicia el frontend (`docker compose restart frontend`).

---

## 5. Problemas del Actualizador Automático (`deploy/scripts/`)

### 5.1. El script indica: `Cambios sensibles detectados. NO se desplegó`
- **Causa:** El commit recibido en `origin/main` contiene alteraciones en archivos SQL de base de datos (`database/`), variables de entorno, Compose o dependencias de paquetes.
- **Explicación:** Por seguridad institucional, los cambios que afecten el modelo relacional o las variables de producción no se aplican de forma desatendida para evitar pérdida o duplicación de datos.
- **Solución:**
  1. Revisa los archivos modificados con `git diff origin/main`.
  2. Aplica manualmente las migraciones requeridas en PostgreSQL si corresponde.
  3. Despliega manualmente con `cd /opt/talento360/web && docker compose up -d --build`.
