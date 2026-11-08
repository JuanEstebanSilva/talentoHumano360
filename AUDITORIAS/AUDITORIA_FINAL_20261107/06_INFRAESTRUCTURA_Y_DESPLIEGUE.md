# 06. INFRAESTRUCTURA, DOCKER, NGINX Y DESPLIEGUE
## Evaluación de Contenedores, Puertos, Redes y Recuperación Operativa

---

### 1. MAPA DE INFRAESTRUCTURA DE CONTENEDORES (DOCKER COMPOSE)

```
+-----------------------------------------------------------------------------------------+
|                                    GATEWAY PERIMETRAL                                   |
|                             talento360_frontend (Nginx 1.25)                            |
|                                    Puerto Host: 80 -> 80                                |
+-----------------------------------------------------------------------------------------+
                                             |
                      Red Interna Docker (bridge: talento_net)
                                             |
   +-------------------+-------------------+-------------------+-------------------+
   | talento360_auth   | talento360_emp    | talento360_hor    | talento360_viat   |
   | Puerto int: 3001  | Puerto int: 3002  | Puerto int: 3007  | Puerto int: 3005  |
   +-------------------+-------------------+-------------------+-------------------+
   | talento360_dash   | talento360_req    | talento360_areq   | talento360_sst    |
   | Puerto int: 3006  | Puerto int: 3003  | Puerto int: 3004  | Puerto int: 3008  |
   +-------------------+-------------------+-------------------+-------------------+
                                             |
                                  talento360_db (PostgreSQL 15)
                                Puerto Host: 5434 -> Puerto int: 5432
                                  Volumen: talento_pgdata
+-----------------------------------------------------------------------------------------+
```

---

### 2. EVALUACIÓN DE RESILIENCIA Y CONFIGURACIÓN

1. **Aislamiento de Puertos Internos:**
   - Únicamente el Gateway `talento360_frontend` (Puerto 80) y la base de datos `talento360_db` (Puerto 5434) exponen puertos al host.
   - Los 8 microservicios de Node.js operan de forma estrictamente privada dentro de la red Docker `talento_net`, haciendo imposible el acceso directo no autorizado desde el exterior sin pasar por las cabeceras de Nginx.
2. **Políticas de Reinicio y Healthchecks:**
   - Todos los contenedores declaran `restart: unless-stopped`.
   - El contenedor de base de datos implementa healthcheck con `pg_isready -U postgres`, y los microservicios dependen de él mediante la condición `service_healthy`.
3. **Variables de Entorno Productivas:**
   - El archivo `web/docker-compose.yml` fija de forma unificada `NODE_ENV: production` en todos los servicios de Node.js, deshabilitando la divulgación de trazas de pila (stack traces) en respuestas de error al cliente.

---

### 3. PROCEDIMIENTO DE DESPLIEGUE DESDE CERO (REPRODUCIBILIDAD)

Para desplegar la plataforma en un nuevo servidor de la Gobernación de Boyacá:

```bash
# 1. Clonar el repositorio oficial
git clone https://github.com/JuanEstebanSilva/talentoHumano360.git
cd talentoHumano360

# 2. Configurar el archivo .env de producción
# Definir DATABASE_URL, JWT_SECRET robusto, DB_PASSWORD

# 3. Levantar la infraestructura en contenedores
docker compose -f web/docker-compose.yml up -d --build

# 4. Verificar salud operativa de los contenedores
docker compose -f web/docker-compose.yml ps
```

El proceso de inicialización ejecuta automáticamente los scripts de esquema (`database/01_schema.sql` a `database/26_rbac_cross_module_read_and_permissions.sql`), dejando la plataforma operativa en menos de 3 minutos.

