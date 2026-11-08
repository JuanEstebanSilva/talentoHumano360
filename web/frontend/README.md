# Frontend y Gateway Inverso (Nginx)
## Sistema de Gestión de Talento Humano — Talento 360
### Gobernación de Boyacá

Este directorio contiene la interfaz web (Single Page Application - SPA) y el servidor **Nginx**, el cual actúa simultáneamente como servidor estático web y como **API Gateway** enrutando el tráfico hacia los microservicios.

---

## 🏗️ Estructura del Frontend

```
frontend/
├── Dockerfile              # Imagen ligera basada en nginx:alpine
├── nginx.conf              # Configuración del Gateway, proxies, rate-limiting y seguridad
├── README.md               # Este documento explicativo
└── src/                    # Código fuente del cliente web
    ├── index.html          # Punto de entrada principal SPA
    ├── css/                # Hojas de estilo institucional (main, components, animations, admin)
    ├── imgs/               # Logotipos oficiales, fondos de Boyacá y favicons
    └── js/
        ├── api.js          # Cliente HTTP centralizado con manejo de tokens y errores
        ├── app.js          # Orquestador del ciclo de vida y enrutamiento visual
        ├── auth.js         # Manejo de sesiones, roles y permisos en memoria/localStorage
        ├── libs/           # Librerías estáticas optimizadas (jspdf, jszip, flatpickr)
        └── modules/        # Controladores por módulo (dashboard, employees, viaticos, horarios, sst)
```

---

## 🛡️ Políticas de Seguridad en Nginx (`nginx.conf`)
- **Cabeceras OWASP ASVS:** `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`.
- **Protección contra Fuerza Bruta:** Rate Limiting estricto en `/api/auth/login` (máximo 120 peticiones por minuto por IP con ráfaga nodelay).
- **Protección DoS:** Rate Limiting general para la API institucional (60 peticiones por segundo).
- **Hardening:** `server_tokens off` para no revelar la versión de Nginx.

