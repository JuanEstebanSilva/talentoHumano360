# 07. HALLAZGOS Y PLAN PENDIENTE DE CIERRE TÉCNICO
## Catálogo Residual de Observaciones y Recomendaciones Operativas

---

### 1. ESTADO DE DEFECTOS FUNCIONALES O DE SEGURIDAD

> ### **DECLARACIÓN OFICIAL DEL PANEL DE AUDITORÍA:**
> Tras la ejecución exhaustiva de las pruebas de regresión, análisis estático y dinámico, **NO EXISTEN DEFECTOS CRÍTICOS, ALTOS NI MEDIOS PENDIENTES** dentro del alcance contractual e institucional de Talento 360.
>
> Todos los hallazgos de las auditorías previas (`AUD2-001` a `AUD2-014`, `AUD-NUEVO-001` a `AUD-NUEVO-010`, `AUD-4-001` y `AUD-4-002`) fueron remediados y verificados con pruebas automatizadas en vivo.

---

### 2. OBSERVACIONES INFORMATIVAS Y MEJORAS RECOMENDADAS (NO BLOQUEANTES)

Las siguientes observaciones corresponden a recomendaciones de buenas prácticas de administración de infraestructura para la etapa post-entrega y **no impiden la recepción técnica del proyecto**:

| ID | Observación Técnica | Severidad | Módulo / Componente | Acción Recomendada | Prioridad Sugerida |
|---|---|:---:|---|---|:---:|
| **OBS-01** | Empaquetamiento Offline de Recursos Estáticos | BAJA | Frontend / Assets | Descargar fuentes Google Fonts (Roboto, Montserrat) e iconos FontAwesome en `web/frontend/public/assets/` si la Gobernación decide desplegar el servidor en una intranet sin acceso a Internet. | BAJA |
| **OBS-02** | Tarea Programada de Copias de Seguridad (Cron) | INFORMATIVA | Administración / Backups | Configurar en el servidor host un trabajo de cron que invoque semanalmente `POST /api/admin/backups/generate` con el token de superadministrador para automatizar la rotación de respaldos. | MEDIA |
| **OBS-03** | Monitoreo de Tasa de Crecimiento de Logs | INFORMATIVA | Dashboard / Errores | Supervisar mensualmente el tamaño de la tabla `system_errors` y depurar incidentes resueltos con más de 180 días de antigüedad. | BAJA |

---

### 3. PLAN DE TRABAJO SUGERIDO PARA EL EQUIPO DE TALENTO HUMANO

1. **Jornada de Socialización Operativa:**
   - Presentar a Ángela Ussa, Blanca Soler, Doris Cañón y Bergenet Gutiérrez la interfaz con lectura cruzada compartida, explicando que pueden consultar información entre dependencias sin temor a alterar los datos de sus compañeras.
2. **Custodia de Credenciales de Superadministrador:**
   - Asegurar que la contraseña de la cuenta `admin` sea resguardada por el Área de Sistemas de la Gobernación de Boyacá, reservando su uso exclusivamente para mantenimiento técnico, gestión de respaldos e incidentes.

