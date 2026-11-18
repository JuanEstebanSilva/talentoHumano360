# Manual de usuario: Gestión Documental e Informes

Este manual explica cómo usar los módulos **Gestión Documental** e **Informes y Automatización** de Talento 360. Está escrito para los funcionarios de Talento Humano; no hace falta saber de programación.

Los dos módulos aparecen en el menú lateral para **todo usuario registrado**, por decisión de la entidad.

---

## 1. Gestión Documental

Guarda los documentos de los servidores públicos (hojas de vida, diplomas, actos administrativos, incapacidades, etc.) con sus versiones y un registro de quién los consulta o modifica.

El módulo tiene tres pestañas:

| Pestaña | Para qué sirve |
| :--- | :--- |
| **Repositorio** | Buscar y consultar todos los documentos clasificados. |
| **Bandeja de clasificación** | Documentos cargados que todavía no tienen servidor o tipo. El número junto al nombre indica cuántos hay pendientes. |
| **Expediente por servidor** | Ver todos los documentos de un servidor público en un solo lugar. |

### 1.1 Cargar documentos

1. Pulse **Cargar documentos**.
2. Si ya sabe a quién pertenecen, escriba el nombre o la cédula en **Servidor público** y elija el **Tipo de documento**. Ambos son opcionales.
3. Arrastre los archivos al recuadro o haga clic para buscarlos. Se aceptan **PDF, JPG, PNG, DOCX y XLSX**, de máximo **25 MB** cada uno.
4. Confirme la carga.

Qué pasa después:

- **Con servidor y tipo:** el documento queda clasificado y aparece en el Repositorio.
- **Sin alguno de los dos:** pasa a la **Bandeja de clasificación** con una sugerencia sacada del nombre del archivo.

> **Consejo:** nombre los archivos con el tipo y la cédula, por ejemplo `HOJA_DE_VIDA_1057123456.pdf`. Así el sistema sugiere el servidor y el tipo correctos y solo tiene que confirmar.

El sistema revisa que el contenido del archivo corresponda a su extensión. Un archivo renombrado (por ejemplo, un `.exe` llamado `.pdf`) se rechaza.

### 1.2 Clasificar desde la bandeja

1. Abra la pestaña **Bandeja de clasificación**.
2. En cada documento revise la sugerencia de servidor y tipo, corríjala si hace falta y pulse **Clasificar**.
3. Si muchas sugerencias están completas y son correctas, pulse **Confirmar sugerencias completas** para clasificarlas todas de una vez.

### 1.3 Buscar y consultar

- En el **Repositorio**, escriba en el buscador un título, nombre, cédula o nombre de archivo, y use los filtros de tipo, categoría y fecha. **Limpiar** quita los filtros.
- En **Expediente por servidor**, busque al servidor por nombre o cédula para ver todo lo suyo.
- En cada documento puede usar **Ver detalle**, **Vista previa** (PDF e imágenes) o **Descargar**. Los formatos sin vista previa (DOCX, XLSX) se descargan para abrirlos.

### 1.4 Versiones, edición y eliminación

- **Nueva versión:** en el detalle del documento, pulse **Subir versión**, elija el archivo y, si quiere, escriba una nota del cambio. Las versiones anteriores se conservan y se pueden descargar.
- **Editar:** cambia título, servidor, tipo, fecha o descripción.
- **Eliminar:** pide confirmación y un motivo opcional. Los documentos se conservan hasta que alguien los elimina a mano; el sistema no los borra solo.
- **Registro de accesos y cambios:** en el detalle se ve quién cargó, consultó, descargó, editó o eliminó el documento y cuándo.

### 1.5 Documentos sensibles

Algunos tipos, como los de salud, están marcados como **sensibles**. Solo los ven y clasifican el Administrador, el Coordinador o quien tenga el permiso `documents:sensitive`. Para los demás usuarios esos documentos no aparecen, ni en el repositorio ni en los informes.

Si un usuario sin ese permiso carga un documento que resulta sensible, el documento queda en una bandeja protegida hasta que lo clasifique alguien autorizado.

### 1.6 Tipos de documento

El Administrador y el Coordinador ven el botón **Tipos de documento**. Desde ahí se crean tipos nuevos (nombre, categoría, si es sensible y palabras clave para la sugerencia automática) o se desactivan los que ya no se usan.

### 1.7 Carpeta de entrada automática

Además de la pantalla, se pueden dejar archivos en una carpeta del servidor y el sistema los carga solos cada minuto:

- Los archivos admitidos pasan a la **Bandeja de clasificación**, con sugerencia de servidor y tipo, y se mueven a la subcarpeta `procesados/`.
- Los rechazados se mueven a `rechazados/`, con un archivo `.motivo.txt` que explica la causa.

En el servidor, la carpeta es el volumen de Docker `documents_inbox`. Su ruta exacta se consulta con:

```bash
docker volume inspect --format '{{ .Mountpoint }}' web_documents_inbox
```

(`web` es el nombre del proyecto de Docker Compose; si se instaló con otro nombre, cámbielo.)

---

## 2. Informes y Automatización

Genera informes con filtros sobre la información de Talento 360, los descarga en Excel y permite programarlos para que se generen solos.

Cada usuario solo ve datos de los módulos a los que ya tiene acceso. Por ejemplo, quien no tiene acceso a Viáticos no puede sacar informes de viáticos.

### 2.1 Generar un informe

1. Abra **Informes y Automatización** y la pestaña **Generar informe**.
2. En **Selecciona qué información quieres consultar**, elija la fuente: servidores públicos, vacaciones, permisos e incapacidades, viáticos, horarios, novedades para nómina, SST o documentos.
3. Agregue los filtros que necesite (dependencia, estado, fechas, valores mínimo y máximo, etc.). Sin filtros, el informe incluye todos los registros.
4. En **Columnas del informe**, marque las columnas que quiere ver.
5. Revise la vista previa. En pantalla se muestran 100 registros; el archivo exportado los trae todos.
6. Pulse **Excel** para descargarlo. El archivo incluye hojas de resumen.

Para fechas puede usar periodos como "Este mes" o "Mes anterior", calculados con la hora de Colombia, o un **Rango personalizado**.

### 2.2 Programar un informe

1. Con el informe configurado, pulse **Programar**.
2. Escriba un **Nombre** (por ejemplo, "Informe mensual de planta").
3. Elija la **Frecuencia** (diaria, semanal, mensual o personalizada con **Repetir cada**), la **Primera ejecución** y la **Hora (Colombia)**.
4. Guarde.

> Si programa un informe, use periodos relativos como "Mes anterior". Un rango de fechas fijo repetiría siempre los mismos datos; el formulario lo advierte.

### 2.3 Administrar las automatizaciones

- En **Automatizaciones** puede **Editar**, pausar, reanudar, **Ejecutar** ahora o **Eliminar** cada informe programado. Se ven la **Última ejecución** y la **Próxima ejecución**.
- En **Historial de ejecuciones** está el resultado de cada ejecución; pulse **Ver resultado** para consultarlo o descargarlo.
- Se guardan las últimas 30 ejecuciones de cada automatización. Al eliminar una automatización se borra también su historial.
- Si el servidor estuvo apagado, al volver ejecuta una sola vez lo que quedó pendiente.

### 2.4 Historial de importaciones

La pestaña **Historial de importaciones** muestra cada carga masiva de Excel hecha en cualquier módulo (vacaciones, solicitudes, viáticos, horarios, SST, servidores públicos): archivo, usuario, fecha y cuántas filas fueron **Nuevos**, **Actualizados**, **Ya existían** u **Omitidos**.

- **Ver errores** muestra las filas con problema, con su hoja y número de fila.
- Las cargas rechazadas también quedan registradas, con el motivo.
- Cada usuario ve sus cargas; el Administrador y el Coordinador ven todas.

Volver a subir el mismo archivo de vacaciones, solicitudes o SST no duplica los registros: el sistema compara cédula, fechas y tipo, y los cuenta como "Ya existían".

---

## 3. Preguntas frecuentes

**No veo el módulo en el menú.** Cierre sesión y vuelva a entrar. Si sigue sin aparecer, pida al administrador que revise su usuario.

**El archivo no se deja cargar.** Revise que sea PDF, JPG, PNG, DOCX o XLSX, que pese menos de 25 MB y que no esté dañado o renombrado.

**No encuentro un documento que otra persona cargó.** Puede estar en la **Bandeja de clasificación** porque le falta servidor o tipo, o ser de un tipo sensible que su usuario no puede ver.

**Un informe programado aparece con error.** Revise en el historial el mensaje. Lo más común es que a quien lo creó se le retiró el acceso al módulo de esos datos.

**¿Dónde se guardan los documentos y se hacen copias?** Los archivos quedan en el servidor, en el volumen `documents_data`, y la base de datos tiene copia diaria. Ver [`COPIAS_DE_SEGURIDAD.md`](COPIAS_DE_SEGURIDAD.md).

---

Detalle técnico de los informes (fuentes, permisos y cómo agregar filtros): [`INFORMES_Y_AUTOMATIZACION.md`](INFORMES_Y_AUTOMATIZACION.md).
