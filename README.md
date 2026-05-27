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

## Como funciona (flujo general)
- La app usa Google Sheets como fuente de datos. Cada hoja (SOLICITUDES, ACTIVIDADES, REGISTROS, etc.) se lee y actualiza via la API de Google.
- El login se realiza con Google ID Token y se emite un JWT propio para consumir los endpoints protegidos.
- Las actualizaciones de `SOLICITUDES.actividad_actual` disparan correos automaticos (cambio de actividad o finalizacion de proceso).
- Un cron permite enviar recordatorios cuando una solicitud no avanza dentro del tiempo maximo configurado en la actividad.

## Autenticacion
- `POST /api/auth/google` recibe `credential` (Google ID token) y responde con un JWT de la app.
- Los endpoints de `/api/sheets/*` requieren `Authorization: Bearer <token>`.
- El secreto del JWT se configura en `APP_JWT_SECRET`.

## Correos: cuando se envian y a quien
- **Inicio de solicitud**: al agregar una fila en `DATOS_INICIALES_SOLICITUD`.
	- Para: correo del solicitante (columna `correo`).
	- Copia: `NOTIFICATIONS_CC` (si existe) y siempre `EMAIL_DRI`.
- **Cambio de actividad**: al actualizar `SOLICITUDES.actividad_actual` y el valor cambia.
	- Para: correo del solicitante.
	- Copia: `NOTIFICATIONS_CC` (si existe) y siempre `EMAIL_DRI`.
	- Incluye `archivos` de la actividad nueva (links desde `ACTIVIDADES.archivos`).
- **Finalizacion de proceso**: se envia cuando la actividad anterior era la ultima del proceso (la siguiente actividad pertenece a otro `id_proceso`).
	- Para: correo del solicitante.
	- Copia: `NOTIFICATIONS_CC` + `REGISTROS.correo_extra` (si existe) + siempre `EMAIL_DRI`.
- **Recordatorios** (cron): cuando una solicitud no avanza y se supera el tiempo maximo (`ACTIVIDADES.tiempo_max`).
	- Para: `ADMIN_EMAIL`.
	- Copia: siempre `EMAIL_DRI`.

## Cron de recordatorios
- Endpoint: `GET /api/cron/recordatorios`.
- Si `CRON_SECRET` esta definido, se requiere `?token=...` o header `x-cron-secret`.

## Variables de entorno principales
- `PORT`: puerto del servidor (por defecto 3000).
- `spreadsheet`: ID de la hoja de calculo.
- `GOOGLE_SERVICE_ACCOUNT_KEY` o `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de la cuenta de servicio.
- `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`: alternativas si no se usa JSON completo.
- `GOOGLE_WEB_CLIENT_ID`: client ID para validar el ID token del login con Google.
- `APP_JWT_SECRET`: firma del JWT interno.
- `EMAIL`, `EMAIL_PASSWORD`: cuenta de Gmail usada para enviar correos.
- `EMAIL_FROM_NAME`: nombre visible del remitente.
- `EMAIL_DRI`: correo que siempre va en copia (CC).
- `NOTIFICATIONS_CC`: copia adicional para notificaciones (si existe).
- `ADMIN_EMAIL`: correo que recibe los recordatorios del cron.
- `CRON_SECRET`: secreto para proteger el endpoint de cron (opcional).
