# Suite de Pruebas de Regresión y Validación Técnica
## Talento 360 — Gobernación de Boyacá

Este directorio contiene las suites de pruebas automatizadas y de regresión para verificar la integridad del sistema, controles RBAC, algoritmos de cálculo de viáticos y validaciones de datos institucionales.

---

## 📋 Pruebas Disponibles

| Script de Prueba | Descripción | Cobertura |
| :--- | :--- | :--- |
| **`rbac_matrix.test.js`** | Matriz de 15 operaciones CRUD transversales para roles autorizados y no autorizados en Servidores Públicos, Horarios y Viáticos. | 15/15 operaciones verificadas |
| **`viaticos_dates.test.js`** | Validación exhaustiva del algoritmo de parsing de fechas de resolución (formatos texto, seriales Excel, años invertidos) y 12 casos de cálculo de duración de comisiones. | 12/12 casos de duración + parsers |

---

## 🚀 Ejecución de las Pruebas

Para ejecutar las pruebas en un entorno donde los contenedores de Docker estén activos:

```bash
# 1. Ejecutar prueba de matriz RBAC transversal
node tests/rbac_matrix.test.js

# 2. Ejecutar prueba de fechas y duración de viáticos
node tests/viaticos_dates.test.js
```

> **Nota:** Las pruebas se conectan al API en `http://localhost` (puerto 80) y a la base de datos PostgreSQL local en el puerto `5434` (mapeo por defecto de desarrollo) o `5432` en el contenedor.
