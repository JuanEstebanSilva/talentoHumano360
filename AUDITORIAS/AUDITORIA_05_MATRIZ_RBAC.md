# AUDITORÍA 05: MATRIZ DE CONTROL DE ACCESO (RBAC) COMPROBADA
## Evidencia Experimental de Permisos en Tiempo de Ejecución — Gobernación de Boyacá

---

### 1. MATRIZ INSTITUCIONAL DEFINITIVA Y RESULTADOS DE AUDITORÍA

A continuación se resume el estado comprobado para cada uno de los 5 usuarios institucionales contra los tres módulos operativos y la administración global:

| Usuario | Perfil / Cargo | Servidores Públicos | Horarios Laborales | Viáticos Institucionales | Administración Global |
|---|---|:---:|:---:|:---:|:---:|
| **`admin`** | Administrador Técnico | **CRUD (200)** | **CRUD (200)** | **CRUD (200)** | **TOTAL (200)** |
| **`angela.ussa`** | Dirección Talento Humano | **CRUD (200)** | **VER (200)** | **VER (200)** | **DENEGADO (403)** |
| **`blanca.soler`** | Gestión Planta / Servidores | **CRUD (200)** | **VER (200)** | **VER (200)** | **DENEGADO (403)** |
| **`doris.canon`** | Gestión de Horarios | **VER (200)** | **CRUD (200)** | **VER (200)** | **DENEGADO (403)** |
| **`bergenet.gutierrez`** | Gestión de Viáticos | **VER (200)** | **VER (200)** | **CRUD (200)** | **DENEGADO (403)** |
| **`Anónimo / No Auth`** | Sin Autenticación | **DENEGADO (401)** | **DENEGADO (401)** | **DENEGADO (401)** | **DENEGADO (401)** |

---

### 2. REGISTRO DETALLADO DE PRUEBAS CONTROLADAS (CASO POR CASO)

#### 2.1. Usuario: `admin` (Administrador General)
| Módulo | Operación Probada | Endpoint / Método | Código HTTP | Resultado Esperado | Resultado Real | Estado |
|---|---|---|:---:|:---:|:---:|:---:|
| Autenticación | Inicio de sesión | `POST /api/auth/login` | 200 OK | Retornar token JWT | Token emitido con `*` | **CONFORME** |
| Servidores | Lectura de listado | `GET /api/employees` | 200 OK | Listar funcionarios | 678 registros retornados | **CONFORME** |
| Servidores | Creación / Escritura | `POST /api/employees` | 400 Bad Req | Permitir (valida body) | Acceso concedido (400 por payload sintético) | **CONFORME** |
| Horarios | Lectura de listado | `GET /api/horarios` | 200 OK | Listar acuerdos | 136 acuerdos retornados | **CONFORME** |
| Horarios | Creación / Escritura | `POST /api/horarios` | 400 Bad Req | Permitir (valida body) | Acceso concedido (400 por payload sintético) | **CONFORME** |
| Viáticos | Lectura de listado | `GET /api/viaticos` | 200 OK | Listar comisiones | 6,556 viáticos retornados | **CONFORME** |
| Viáticos | Creación / Escritura | `POST /api/viaticos` | 400 Bad Req | Permitir (valida body) | Acceso concedido (400 por payload sintético) | **CONFORME** |
| Administración | Copias de seguridad | `GET /api/admin/backups` | 200 OK | Acceso completo | Listado de respaldos retornado | **CONFORME** |
| Administración | Consola de errores | `GET /api/admin/errors` | 200 OK | Acceso completo | Incidentes retornados | **CONFORME** |

---

#### 2.2. Usuario: `angela.ussa@boyaca.gov.co` (Dirección de Talento Humano)
| Módulo | Operación Probada | Endpoint / Método | Código HTTP | Resultado Esperado | Resultado Real | Estado |
|---|---|---|:---:|:---:|:---:|:---:|
| Autenticación | Inicio de sesión | `POST /api/auth/login` | 200 OK | Token con permisos | Emitido con 4 módulos | **CONFORME** |
| Servidores | Lectura de listado | `GET /api/employees` | 200 OK | Listar funcionarios | Retornó datos (200) | **CONFORME** |
| Servidores | Creación / Escritura | `POST /api/employees` | 400 Bad Req | Permitir (valida body) | Concedido (400 por campos requeridos) | **CONFORME** |
| Horarios | **Lectura transversal** | `GET /api/horarios` | **200 OK** | **Permitir lectura** | **Retornó acuerdos (200)** | **RESUELTO** |
| Horarios | Intento de escritura | `POST /api/horarios` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Viáticos | **Lectura transversal** | `GET /api/viaticos` | **200 OK** | **Permitir lectura** | **Retornó viáticos (200)** | **RESUELTO** |
| Viáticos | Intento de escritura | `POST /api/viaticos` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Viáticos | Intento de eliminación| `DELETE /api/viaticos/1` | **403 Forbidden** | Denegar eliminación | Bloqueado con 403 | **CONFORME** |
| Administración | Copias de seguridad | `GET /api/admin/backups` | **403 Forbidden** | Denegar acceso técnico| Bloqueado con 403 | **CONFORME** |
| Administración | Consola de errores | `GET /api/admin/errors` | **403 Forbidden** | Denegar acceso técnico| Bloqueado con 403 | **CONFORME** |

---

#### 2.3. Usuario: `blanca.soler@boyaca.gov.co` (Gestión de Servidores Públicos)
| Módulo | Operación Probada | Endpoint / Método | Código HTTP | Resultado Esperado | Resultado Real | Estado |
|---|---|---|:---:|:---:|:---:|:---:|
| Autenticación | Inicio de sesión | `POST /api/auth/login` | 200 OK | Token con permisos | Emitido con 4 módulos | **CONFORME** |
| Servidores | Lectura de listado | `GET /api/employees` | 200 OK | Listar funcionarios | Retornó datos (200) | **CONFORME** |
| Servidores | Creación / Escritura | `POST /api/employees` | 400 Bad Req | Permitir (valida body) | Concedido (400 por campos requeridos) | **CONFORME** |
| Horarios | **Lectura transversal** | `GET /api/horarios` | **200 OK** | **Permitir lectura** | **Retornó acuerdos (200)** | **RESUELTO** |
| Horarios | Intento de eliminación| `DELETE /api/horarios/1` | **403 Forbidden** | Denegar eliminación | Bloqueado con 403 | **CONFORME** |
| Viáticos | **Lectura transversal** | `GET /api/viaticos` | **200 OK** | **Permitir lectura** | **Retornó viáticos (200)** | **RESUELTO** |
| Viáticos | Intento de escritura | `POST /api/viaticos` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Administración | Copias de seguridad | `GET /api/admin/backups` | **403 Forbidden** | Denegar acceso técnico| Bloqueado con 403 | **CONFORME** |

---

#### 2.4. Usuario: `doris.canon@boyaca.gov.co` (Gestión de Horarios y Modalidades)
| Módulo | Operación Probada | Endpoint / Método | Código HTTP | Resultado Esperado | Resultado Real | Estado |
|---|---|---|:---:|:---:|:---:|:---:|
| Autenticación | Inicio de sesión | `POST /api/auth/login` | 200 OK | Token con permisos | Emitido con 4 módulos | **CONFORME** |
| Servidores | **Lectura transversal** | `GET /api/employees` | **200 OK** | **Permitir lectura** | **Retornó funcionarios (200)**| **RESUELTO** |
| Servidores | Intento de edición | `PUT /api/employees/1` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Servidores | Intento de creación | `POST /api/employees` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Horarios | Lectura de listado | `GET /api/horarios` | 200 OK | Listar acuerdos | Retornó acuerdos (200) | **CONFORME** |
| Horarios | Creación / Edición | `POST /api/horarios` | 400 Bad Req | Permitir (valida body) | Concedido (400 por campos requeridos) | **CONFORME** |
| Viáticos | **Lectura transversal** | `GET /api/viaticos` | **200 OK** | **Permitir lectura** | **Retornó viáticos (200)** | **RESUELTO** |
| Viáticos | Intento de eliminación| `DELETE /api/viaticos/1` | **403 Forbidden** | Denegar eliminación | Bloqueado con 403 | **CONFORME** |
| Administración | Copias de seguridad | `GET /api/admin/backups` | **403 Forbidden** | Denegar acceso técnico| Bloqueado con 403 | **CONFORME** |

---

#### 2.5. Usuario: `bergenet.gutierrez@boyaca.gov.co` (Gestión de Viáticos)
| Módulo | Operación Probada | Endpoint / Método | Código HTTP | Resultado Esperado | Resultado Real | Estado |
|---|---|---|:---:|:---:|:---:|:---:|
| Autenticación | Inicio de sesión | `POST /api/auth/login` | 200 OK | Token con permisos | Emitido con 4 módulos | **CONFORME** |
| Servidores | **Lectura transversal** | `GET /api/employees` | **200 OK** | **Permitir lectura** | **Retornó funcionarios (200)**| **RESUELTO** |
| Servidores | Intento de creación | `POST /api/employees` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Horarios | **Lectura transversal** | `GET /api/horarios` | **200 OK** | **Permitir lectura** | **Retornó acuerdos (200)** | **RESUELTO** |
| Horarios | Intento de creación | `POST /api/horarios` | **403 Forbidden** | Denegar mutación | Bloqueado con 403 | **CONFORME** |
| Horarios | Intento de eliminación| `DELETE /api/horarios/1` | **403 Forbidden** | Denegar eliminación | Bloqueado con 403 | **CONFORME** |
| Viáticos | Lectura de listado | `GET /api/viaticos` | 200 OK | Listar comisiones | Retornó viáticos (200) | **CONFORME** |
| Viáticos | Creación / Carga | `POST /api/viaticos` | 400 Bad Req | Permitir (valida body) | Concedido (400 por campos requeridos) | **CONFORME** |
| Administración | Copias de seguridad | `GET /api/admin/backups` | **403 Forbidden** | Denegar acceso técnico| Bloqueado con 403 | **CONFORME** |

---

#### 2.6. Peticiones Anónimas / Sin Autenticación
| Endpoint Consultado | Método | Token Enviado | Código HTTP Recibido | Dictamen de Seguridad |
|---|:---:|:---:|:---:|:---:|
| `/api/employees` | GET | Ninguno | **401 Unauthorized** | **CONFORME (Protegido)** |
| `/api/horarios` | GET | Ninguno | **401 Unauthorized** | **CONFORME (Protegido)** |
| `/api/viaticos` | GET | Ninguno | **401 Unauthorized** | **CONFORME (Protegido)** |
| `/api/admin/backups` | GET | Ninguno | **401 Unauthorized** | **CONFORME (Protegido)** |
| `/api/auth/verify` | POST | Inválido | **401 Unauthorized** | **CONFORME (Protegido)** |

