# ¿Qué es este sistema?

**internacionalizacion-server** es el backend del proyecto de internacionalización, encargado de gestionar y exponer una API REST para la administración de procesos, actividades, solicitudes y usuarios relacionados con la internacionalización académica. El sistema se conecta a hojas de cálculo de Google Sheets, que funcionan como base de datos, permitiendo la lectura y actualización de información relevante para los distintos actores del proceso.

# ¿Para qué sirve?

Este sistema permite:

- Consultar y actualizar información de procesos, actividades, solicitudes y registros de internacionalización.
- Gestionar usuarios, actores y adjuntos asociados a las actividades.
- Facilitar la integración con Google Sheets para mantener la información centralizada y accesible.
- Proveer endpoints seguros para que los usuarios autenticados puedan interactuar con los datos según su rol.

Es ideal para instituciones educativas que requieren digitalizar y automatizar el seguimiento de procesos de internacionalización, manteniendo trazabilidad y control sobre cada etapa y actor involucrado.

# internacionalizacion-server
Repositorio para la parte backend del proyecto.

## Endpoints (API)
Base: `/api/sheets`

### Lectura
- `GET /` -> Retorna todas las hojas segun `sheetRanges`.
- `GET /solicitudes/mias` -> Filtra solicitudes por el correo del usuario autenticado.
- `GET /actividades` -> Retorna actividades con sus actores y adjuntos.
- `GET /procesos` -> Retorna procesos con sus actividades (ordenadas por `orden`).
- `GET /procesos/:idProceso` -> Retorna un proceso con sus actividades.

### Actualizacion
- `PATCH /registros/:idSolicitud/etapas/:idEtapa/*` -> Rutas antiguas (compatibilidad).
- `PATCH /registros/:idSolicitud/actividades/:idActividad/*` -> Rutas nuevas.
	- `aprobado`, `observacion`, `url`
- `PATCH /solicitudes/:idSolicitud/etapa` -> Ruta antigua (compatibilidad).
- `PATCH /solicitudes/:idSolicitud/actividad` -> Ruta nueva.
- `PUT /:sheetName` -> Actualiza rango especifico.
- `POST /:sheetName/rows` -> Agrega filas.

## Respuesta de actividades
El endpoint `GET /actividades` devuelve:
- `actores`: lista de filas de `ACTIVIDAD_ACTOR` vinculadas por `id_actividad`.
- `adjuntos`: lista de filas de `ADJUNTOS_ACTIVIDADES` vinculadas por `id_actividad`.

## Respuesta de procesos
Los endpoints de procesos agregan `actividades` (con actores y adjuntos) y las ordenan por `orden`.
