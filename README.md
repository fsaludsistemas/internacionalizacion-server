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
