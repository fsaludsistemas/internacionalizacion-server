const express = require('express');
const {
	getAllSheetsData,
	getMySolicitudes,
	getActividades,
	getProcesos,
	getProcesoById,
	updateRegistroAprobado,
	updateRegistroObservacion,
	updateRegistroUrl,
	updateSolicitudEtapa,
	updateSheetData,
	appendSheetRow,
} = require('../controllers/sheetsController');

const router = express.Router();

router.get('/', getAllSheetsData);
router.get('/solicitudes/mias', getMySolicitudes);
router.get('/actividades', getActividades);
router.get('/procesos', getProcesos);
router.get('/procesos/:idProceso', getProcesoById);
router.patch('/registros/:idSolicitud/etapas/:idEtapa/aprobado', updateRegistroAprobado);
router.patch('/registros/:idSolicitud/etapas/:idEtapa/observacion', updateRegistroObservacion);
router.patch('/registros/:idSolicitud/etapas/:idEtapa/url', updateRegistroUrl);
router.patch('/registros/:idSolicitud/actividades/:idActividad/aprobado', updateRegistroAprobado);
router.patch('/registros/:idSolicitud/actividades/:idActividad/observacion', updateRegistroObservacion);
router.patch('/registros/:idSolicitud/actividades/:idActividad/url', updateRegistroUrl);
router.patch('/solicitudes/:idSolicitud/etapa', updateSolicitudEtapa);
router.patch('/solicitudes/:idSolicitud/actividad', updateSolicitudEtapa);
router.put('/:sheetName', updateSheetData);
router.post('/:sheetName/rows', appendSheetRow);

module.exports = router;
