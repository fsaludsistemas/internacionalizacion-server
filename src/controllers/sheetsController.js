const { google } = require('googleapis');
const { Readable } = require('stream');
const { sheetRanges } = require('../config/sheetRanges');
const { jwtClient, ensureGoogleJwtAuth } = require('../config/google');
const {
  sendNuevoProcesoNotification,
  sendCambioActividadNotification,
  sendProcesoFinalizadoNotification,
} = require('../services/sendEmail');
require('dotenv').config();

function sheetValuesToObject(values = []) {
  if (!values.length) {
    return [];
  }

  const [headers, ...rows] = values;
  if (!headers || !headers.length) {
    return [];
  }

  return rows.map((row) => {
    return headers.reduce((rowObject, header, index) => {
      rowObject[header] = row[index] ?? '';
      return rowObject;
    }, {});
  });
}

async function getSheetsClient() {
  await ensureGoogleJwtAuth();
  return google.sheets({ version: 'v4', auth: jwtClient });
}

async function getDriveClient() {
  await ensureGoogleJwtAuth();
  return google.drive({ version: 'v3', auth: jwtClient });
}

function getDriveFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '';
}

function resolveUploadFileName(req, file) {
  const candidate =
    req.body?.nombre || req.body?.name || req.body?.filename || file?.originalname || 'documento';
  const normalized = String(candidate || '').trim();
  return normalized || 'documento';
}

function buildRange(sheetName, range) {
  if (range.includes('!')) {
    return range;
  }

  return `${sheetName}!${range}`;
}

function formatSolicitudFechaHora(rawFecha) {
  const now = new Date();

  if (!rawFecha) {
    return now.toLocaleString('es-CO');
  }

  const rawText = String(rawFecha).trim();
  if (!rawText) {
    return now.toLocaleString('es-CO');
  }

  const hasTime = /(\d{1,2}:\d{2})/.test(rawText) || /am|pm/i.test(rawText);
  if (hasTime) {
    return rawText;
  }

  return `${rawText} ${now.toLocaleTimeString('es-CO')}`;
}

async function getDatosInicialesBySolicitudId(sheets, spreadsheetId, idSolicitud) {
  const rows = await getSheetRows(sheets, spreadsheetId, 'DATOS_INICIALES_SOLICITUD');
  const datos = rowsToObjectsWithColumns(rows, SHEET_COLUMNS.DATOS_INICIALES_SOLICITUD);
  const targetId = String(idSolicitud ?? '').trim();

  return datos.find((item) => String(item.id_solicitud ?? '').trim() === targetId);
}

async function getProcesoNombreBySolicitudId(sheets, spreadsheetId, idSolicitud) {
  const [solicitudesRows, procesosRows] = await Promise.all([
    getSheetRows(sheets, spreadsheetId, 'SOLICITUDES'),
    getSheetRows(sheets, spreadsheetId, 'PROCESOS'),
  ]);

  const solicitudes = rowsToObjectsWithColumns(solicitudesRows, SHEET_COLUMNS.SOLICITUDES);
  const procesos = rowsToObjectsWithColumns(procesosRows, SHEET_COLUMNS.PROCESOS);
  const targetId = String(idSolicitud ?? '').trim();
  const solicitud = solicitudes.find((item) => String(item.id ?? '').trim() === targetId);
  const procesoId = String(solicitud?.id_proceso ?? '').trim();
  const proceso = procesos.find((item) => String(item.id ?? '').trim() === procesoId);

  return proceso?.nombre || (procesoId ? `ID ${procesoId}` : '');
}

async function getRegistroCorreoExtra(sheets, spreadsheetId, idSolicitud, idActividad) {
  const rows = await getSheetRows(sheets, spreadsheetId, 'REGISTROS');
  const registros = rowsToObjectsWithColumns(rows, SHEET_COLUMNS.REGISTROS, {
    idKey: 'id',
    skipEmpty: true,
  });

  const solicitudIdText = String(idSolicitud ?? '').trim();
  const actividadIdText = String(idActividad ?? '').trim();

  const registro = registros.find(
    (item) =>
      String(item.id ?? '').trim() === solicitudIdText &&
      String(item.id_actividad ?? '').trim() === actividadIdText
  );

  return registro?.correo_extra || '';
}

async function getProcesoYActividadesInfo(
  sheets,
  spreadsheetId,
  procesoId,
  actividadAnteriorId,
  actividadNuevaId
) {
  const [procesosRows, actividadesRows] = await Promise.all([
    getSheetRows(sheets, spreadsheetId, 'PROCESOS'),
    getSheetRows(sheets, spreadsheetId, 'ACTIVIDADES'),
  ]);

  const procesos = rowsToObjectsWithColumns(procesosRows, SHEET_COLUMNS.PROCESOS);
  const actividades = rowsToObjectsWithColumns(actividadesRows, SHEET_COLUMNS.ACTIVIDADES);
  const actividadesOrdenadas = sortActividadesByProcesoYOrden(actividades);

  const proceso = procesos.find((item) => String(item.id ?? '').trim() === procesoId);
  const actividadAnterior = actividades.find(
    (item) => String(item.id ?? '').trim() === actividadAnteriorId
  );
  const actividadNueva = actividades.find(
    (item) => String(item.id ?? '').trim() === actividadNuevaId
  );
  const actividadAnteriorIndex = actividadesOrdenadas.findIndex(
    (item) => String(item.id ?? '').trim() === actividadAnteriorId
  );
  const actividadSiguiente =
    actividadAnteriorIndex >= 0 ? actividadesOrdenadas[actividadAnteriorIndex + 1] : null;
  const actividadAnteriorProcesoId = String(actividadAnterior?.id_proceso ?? '').trim();
  const actividadSiguienteProcesoId = String(actividadSiguiente?.id_proceso ?? '').trim();
  const actividadAnteriorEsUltima =
    !actividadSiguiente || actividadSiguienteProcesoId !== actividadAnteriorProcesoId;

  return {
    procesoNombre: proceso?.nombre || (procesoId ? `ID ${procesoId}` : ''),
    actividadAnteriorNombre: actividadAnterior?.nombre || actividadAnteriorId,
    actividadNuevaNombre: actividadNueva?.nombre || actividadNuevaId,
    actividadNuevaArchivos: actividadNueva?.archivos || '',
    actividadAnteriorEsUltima,
  };
}


const SHEET_COLUMNS = {
  USUARIOS: {
    id: 0,
    correo: 1,
    nombres: 2,
    apellidos: 3,
    rol: 4,
  },
  REGISTROS: {
    id: 0,
    id_usuario: 1,
    id_actividad: 2,
    id_solicitud: 3,
    timestamp: 4,
    observacion: 5,
    aprobado: 6,
    url: 7,
    correo_extra: 8,
  },
  SOLICITUDES: {
    id: 0,
    id_usuario: 1,
    id_proceso: 2,
    actividad_actual: 3,
    fecha: 4,
  },
  ACTIVIDADES: {
    id: 0,
    id_proceso: 1,
    id_adjunto:2,
    nombre: 3,
    tiempo_max: 4,
    orden: 5,
    archivos:6,
    docente:7,
    adjuntos:8,
  },
  ADJUNTOS_ACTIVIDADES: {
    id: 0,
    id_actividad: 1,
    nombre: 2,
  },
    ACTIVIDAD_ACTOR:{
     id: 0,
     id_actividad: 1,
     nombre: 2, 
    },
    PROCESOS:{
      id: 0,
      nombre: 1,
    },
    DATOS_INICIALES_SOLICITUD:{
      id: 0,
      id_solicitud: 1,
      nombre: 2,
      correo: 3,
      programa: 4,
    },
    PROGRAMAS:{
      id: 0,
      nombre: 1,
    },
    DOCUMENTOS:{
      id: 0,
      id_registro: 1,
      url: 2,
      fecha_subida: 3,
    },
    VALIDACIONES_ACTIVIDAD:{
      id: 0,
      id_registro: 1,
      diligencia_doc:2,
    }
};

function columnIndexToLetter(index) {
  let result = '';
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

async function getSheetRows(sheets, spreadsheetId, sheetName) {
  const range = `${sheetName}!${sheetRanges[sheetName]}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

function rowsToObjectsWithColumns(rows = [], columns = {}, options = {}) {
  const { idKey = 'id', skipEmpty = true } = options;

  if (!rows.length) {
    return [];
  }

  const dataRows = rows.slice(1);

  return dataRows
    .map((row) => {
      return Object.entries(columns).reduce((rowObject, [key, index]) => {
        rowObject[key] = row[index] ?? '';
        return rowObject;
      }, {});
    })
    .filter((rowObject) => {
      if (!skipEmpty || !idKey) {
        return true;
      }

      const idValue = rowObject[idKey];
      return idValue !== '' && idValue !== undefined && idValue !== null;
    });
}

function groupByKey(items = [], key) {
  return items.reduce((acc, item) => {
    const groupKey = String(item[key] ?? '').trim();
    if (!groupKey) {
      return acc;
    }

    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }

    acc[groupKey].push(item);
    return acc;
  }, {});
}

function getOrdenValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortActividadesByProcesoYOrden(actividades = []) {
  return [...actividades].sort((a, b) => {
    const procesoA = String(a.id_proceso ?? '').trim();
    const procesoB = String(b.id_proceso ?? '').trim();

    if (procesoA < procesoB) {
      return -1;
    }

    if (procesoA > procesoB) {
      return 1;
    }

    return getOrdenValue(a.orden) - getOrdenValue(b.orden);
  });
}

function sortActividadesByOrden(actividades = []) {
  return [...actividades].sort((a, b) => getOrdenValue(a.orden) - getOrdenValue(b.orden));
}

function findRowNumber(rows, predicate) {
  const dataRows = rows.slice(1);
  const index = dataRows.findIndex(predicate);

  return index === -1 ? -1 : index + 2;
}

async function getActividadesConRelaciones(sheets, spreadsheetId) {
  const [actividadesRows, actoresRows, adjuntosRows] = await Promise.all([
    getSheetRows(sheets, spreadsheetId, 'ACTIVIDADES'),
    getSheetRows(sheets, spreadsheetId, 'ACTIVIDAD_ACTOR'),
    getSheetRows(sheets, spreadsheetId, 'ADJUNTOS_ACTIVIDADES'),
  ]);

  const actividades = rowsToObjectsWithColumns(actividadesRows, SHEET_COLUMNS.ACTIVIDADES);
  const actores = rowsToObjectsWithColumns(actoresRows, SHEET_COLUMNS.ACTIVIDAD_ACTOR);
  const adjuntos = rowsToObjectsWithColumns(adjuntosRows, SHEET_COLUMNS.ADJUNTOS_ACTIVIDADES);

  const actoresByActividad = groupByKey(actores, 'id_actividad');
  const adjuntosByActividad = groupByKey(adjuntos, 'id_actividad');

  return sortActividadesByProcesoYOrden(
    actividades.map((actividad) => {
      const actividadId = String(actividad.id ?? '').trim();

      return {
        ...actividad,
        actores: actoresByActividad[actividadId] || [],
        adjuntos: adjuntosByActividad[actividadId] || [],
      };
    })
  );
}

const getAllSheetsData = async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;

    const dataPromises = Object.entries(sheetRanges).map(async ([sheetName, range]) => {
      const fullRange = `${sheetName}!${range}`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange,
      });
      return { [sheetName]: response.data.values };
    });

    const allDataArray = await Promise.all(dataPromises);
    const allData = Object.assign({}, ...allDataArray);
    const allDataWithObjects = {};

    for (const [sheetName, values] of Object.entries(allData)) {
      allDataWithObjects[sheetName] = sheetValuesToObject(values);
    }

    return res.status(200).json({ status: true, data: allDataWithObjects });
  } catch (error) {
    console.error('Error obteniendo datos de todas las hojas:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const getMySolicitudes = async (req, res) => {
  try {
    const userEmail = (req.user?.email || '').toLowerCase();
    if (!userEmail) {
      return res.status(401).json({ status: false, message: 'Usuario no autenticado.' });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;
    const range = `SOLICITUDES!${sheetRanges.SOLICITUDES}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    if (!rows.length) {
      return res.status(200).json({ status: true, data: [] });
    }

    const [headers, ...dataRows] = rows;
    const lowerHeaders = headers.map((header) => String(header).toLowerCase());
    const candidateColumns = ['email', 'correo', 'correo_usuario', 'usuario_email'];
    const emailIndex = lowerHeaders.findIndex((header) => candidateColumns.includes(header));

    if (emailIndex === -1) {
      return res.status(400).json({
        status: false,
        message: 'La hoja SOLICITUDES no tiene una columna de email/correo.',
      });
    }

    const filteredRows = dataRows.filter((row) => {
      return String(row[emailIndex] || '').toLowerCase() === userEmail;
    });

    const values = [headers, ...filteredRows];
    return res.status(200).json({ status: true, data: sheetValuesToObject(values) });
  } catch (error) {
    console.error('Error obteniendo solicitudes del usuario:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const getActividades = async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;

    const actividades = await getActividadesConRelaciones(sheets, spreadsheetId);

    return res.status(200).json({ status: true, data: actividades });
  } catch (error) {
    console.error('Error obteniendo actividades:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const getProcesos = async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;

    const [procesosRows, actividades] = await Promise.all([
      getSheetRows(sheets, spreadsheetId, 'PROCESOS'),
      getActividadesConRelaciones(sheets, spreadsheetId),
    ]);

    const procesos = rowsToObjectsWithColumns(procesosRows, SHEET_COLUMNS.PROCESOS);
    const actividadesByProceso = groupByKey(actividades, 'id_proceso');

    const procesosConActividades = procesos.map((proceso) => {
      const procesoId = String(proceso.id ?? '').trim();
      return {
        ...proceso,
        actividades: sortActividadesByOrden(actividadesByProceso[procesoId] || []),
      };
    });

    return res.status(200).json({ status: true, data: procesosConActividades });
  } catch (error) {
    console.error('Error obteniendo procesos:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const getProcesoById = async (req, res) => {
  try {
    const { idProceso } = req.params;
    if (!idProceso) {
      return res.status(400).json({ status: false, message: 'Debes enviar idProceso.' });
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;

    const [procesosRows, actividades] = await Promise.all([
      getSheetRows(sheets, spreadsheetId, 'PROCESOS'),
      getActividadesConRelaciones(sheets, spreadsheetId),
    ]);

    const procesos = rowsToObjectsWithColumns(procesosRows, SHEET_COLUMNS.PROCESOS);
    const actividadesByProceso = groupByKey(actividades, 'id_proceso');
    const procesoId = String(idProceso).trim();

    const proceso = procesos.find((item) => String(item.id ?? '').trim() === procesoId);
    if (!proceso) {
      return res.status(404).json({ status: false, message: 'Proceso no encontrado.' });
    }

    const procesoConActividades = {
      ...proceso,
      actividades: sortActividadesByOrden(actividadesByProceso[procesoId] || []),
    };

    return res.status(200).json({ status: true, data: procesoConActividades });
  } catch (error) {
    console.error('Error obteniendo proceso:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const updateSheetData = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = String(req.params.sheetName || '').toUpperCase();
    const { range, values, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!sheetRanges[sheetName]) {
      return res.status(400).json({
        status: false,
        message: `Hoja invalida. Opciones: ${Object.keys(sheetRanges).join(', ')}`,
      });
    }

    if (!range || typeof range !== 'string') {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar range en el body, por ejemplo A2:C2.',
      });
    }

    if (!Array.isArray(values) || !values.every(Array.isArray)) {
      return res.status(400).json({
        status: false,
        message: 'values debe ser una matriz bidimensional. Ej: [["dato1", "dato2"]].',
      });
    }

    const sheets = await getSheetsClient();
    const fullRange = buildRange(sheetName, range);

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: fullRange,
      valueInputOption,
      requestBody: { values },
    });

    return res.status(200).json({
      status: true,
      message: 'Datos actualizados correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error actualizando datos en la hoja:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const appendSheetRow = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = String(req.params.sheetName || '').toUpperCase();
    const { values, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!sheetRanges[sheetName]) {
      return res.status(400).json({
        status: false,
        message: `Hoja invalida. Opciones: ${Object.keys(sheetRanges).join(', ')}`,
      });
    }

    if (!Array.isArray(values)) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar values como arreglo.',
      });
    }

    const normalizedValues = Array.isArray(values[0]) ? values : [values];

    if (Number.isInteger(req.body.userEmailColumnIndex) && req.user?.email) {
      const emailColumnIndex = req.body.userEmailColumnIndex;
      normalizedValues.forEach((row) => {
        row[emailColumnIndex] = req.user.email;
      });
    }

    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption,
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: normalizedValues },
    });

    if (sheetName === 'DATOS_INICIALES_SOLICITUD' && normalizedValues.length) {
      const solicitudRow = normalizedValues[0];
      const solicitudId = solicitudRow[SHEET_COLUMNS.DATOS_INICIALES_SOLICITUD.id_solicitud] || '';
      const userName = solicitudRow[SHEET_COLUMNS.DATOS_INICIALES_SOLICITUD.nombre] || '';
      const userEmail = solicitudRow[SHEET_COLUMNS.DATOS_INICIALES_SOLICITUD.correo] || '';
      const fechaHora = formatSolicitudFechaHora();

      if (userEmail) {
        try {
          const procesoNombre = await getProcesoNombreBySolicitudId(
            sheets,
            spreadsheetId,
            solicitudId
          );
          await sendNuevoProcesoNotification({
            to: userEmail,
            solicitudId,
            userName,
            userEmail,
            fechaHora,
            proceso: procesoNombre,
          });
        } catch (emailError) {
          console.error('Error enviando correo de nuevo proceso:', emailError);
        }
      }
    }

    return res.status(201).json({
      status: true,
      message: 'Fila agregada correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error agregando fila en la hoja:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};


const updateRegistroAprobado = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = 'REGISTROS';
    const { idSolicitud } = req.params;
    const idActividad = req.params.idActividad || req.params.idEtapa;
    const { aprobado, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!idSolicitud || !idActividad) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar idSolicitud e idActividad en la ruta.',
      });
    }

    if (aprobado === undefined) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar aprobado en el body.',
      });
    }

    const sheets = await getSheetsClient();
    const rows = await getSheetRows(sheets, spreadsheetId, sheetName);

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: 'La hoja REGISTROS no tiene datos.',
      });
    }

    const rowNumber = findRowNumber(rows, (row) => {
      return String(row[SHEET_COLUMNS.REGISTROS.id] || '') === String(idSolicitud) &&
        String(row[SHEET_COLUMNS.REGISTROS.id_actividad] || '') === String(idActividad);
    });

    if (rowNumber === -1) {
      return res.status(404).json({
        status: false,
        message: 'No se encontro el registro con idSolicitud y idActividad.',
      });
    }

    const columnLetter = columnIndexToLetter(SHEET_COLUMNS.REGISTROS.aprobado);
    const range = `${sheetName}!${columnLetter}${rowNumber}`;

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values: [[aprobado]] },
    });

    return res.status(200).json({
      status: true,
      message: 'Registro actualizado correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error actualizando aprobado en REGISTROS:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const updateRegistroObservacion = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = 'REGISTROS';
    const { idSolicitud } = req.params;
    const idActividad = req.params.idActividad || req.params.idEtapa;
    const { observacion, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!idSolicitud || !idActividad) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar idSolicitud e idActividad en la ruta.',
      });
    }

    if (observacion === undefined) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar observacion en el body.',
      });
    }

    const sheets = await getSheetsClient();
    const rows = await getSheetRows(sheets, spreadsheetId, sheetName);

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: 'La hoja REGISTROS no tiene datos.',
      });
    }

    const rowNumber = findRowNumber(rows, (row) => {
      return String(row[SHEET_COLUMNS.REGISTROS.id] || '') === String(idSolicitud) &&
        String(row[SHEET_COLUMNS.REGISTROS.id_actividad] || '') === String(idActividad);
    });

    if (rowNumber === -1) {
      return res.status(404).json({
        status: false,
        message: 'No se encontro el registro con idSolicitud y idActividad.',
      });
    }

    const columnLetter = columnIndexToLetter(SHEET_COLUMNS.REGISTROS.observacion);
    const range = `${sheetName}!${columnLetter}${rowNumber}`;

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values: [[observacion]] },
    });

    return res.status(200).json({
      status: true,
      message: 'Observacion actualizada correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error actualizando observacion en REGISTROS:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const updateRegistroUrl = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = 'REGISTROS';
    const { idSolicitud } = req.params;
    const idActividad = req.params.idActividad || req.params.idEtapa;
    const { url, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!idSolicitud || !idActividad) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar idSolicitud e idActividad en la ruta.',
      });
    }

    if (url === undefined) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar url en el body.',
      });
    }

    const sheets = await getSheetsClient();
    const rows = await getSheetRows(sheets, spreadsheetId, sheetName);

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: 'La hoja REGISTROS no tiene datos.',
      });
    }

    const rowNumber = findRowNumber(rows, (row) => {
      return String(row[SHEET_COLUMNS.REGISTROS.id] || '') === String(idSolicitud) &&
        String(row[SHEET_COLUMNS.REGISTROS.id_actividad] || '') === String(idActividad);
    });

    if (rowNumber === -1) {
      return res.status(404).json({
        status: false,
        message: 'No se encontro el registro con idSolicitud y idActividad.',
      });
    }

    const columnLetter = columnIndexToLetter(SHEET_COLUMNS.REGISTROS.url);
    const range = `${sheetName}!${columnLetter}${rowNumber}`;

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values: [[url]] },
    });

    return res.status(200).json({
      status: true,
      message: 'URL actualizada correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error actualizando url en REGISTROS:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const updateSolicitudEtapa = async (req, res) => {
  try {
    const spreadsheetId = process.env.spreadsheet;
    const sheetName = 'SOLICITUDES';
    const { idSolicitud } = req.params;
    const { actividad_actual, fecha, valueInputOption = 'USER_ENTERED' } = req.body;

    if (!idSolicitud) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar idSolicitud en la ruta.',
      });
    }

    if (actividad_actual === undefined && !fecha) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar actividad_actual y/o fecha en el body.',
      });
    }

    const sheets = await getSheetsClient();
    const rows = await getSheetRows(sheets, spreadsheetId, sheetName);

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: 'La hoja SOLICITUDES no tiene datos.',
      });
    }

    const rowNumber = findRowNumber(rows, (row) => {
      return String(row[SHEET_COLUMNS.SOLICITUDES.id] || '') === String(idSolicitud);
    });

    if (rowNumber === -1) {
      return res.status(404).json({
        status: false,
        message: 'No se encontro la solicitud con el id enviado.',
      });
    }

    const updates = [];
    const solicitudRow = rows[rowNumber - 1] || [];
    const actividadAnteriorId = String(
      solicitudRow[SHEET_COLUMNS.SOLICITUDES.actividad_actual] ?? ''
    ).trim();

    if (actividad_actual !== undefined) {
      const columnLetter = columnIndexToLetter(SHEET_COLUMNS.SOLICITUDES.actividad_actual);
      updates.push({
        range: `${sheetName}!${columnLetter}${rowNumber}`,
        values: [[actividad_actual]],
      });
    }

    if (fecha) {
      const columnLetter = columnIndexToLetter(SHEET_COLUMNS.SOLICITUDES.fecha);
      updates.push({
        range: `${sheetName}!${columnLetter}${rowNumber}`,
        values: [[fecha]],
      });
    }

    async function maybeSendCambioActividadEmail() {
      if (actividad_actual === undefined) {
        return;
      }

      const actividadNuevaId = String(actividad_actual ?? '').trim();
      if (!actividadNuevaId || actividadNuevaId === actividadAnteriorId) {
        return;
      }

      try {
        const datosIniciales = await getDatosInicialesBySolicitudId(
          sheets,
          spreadsheetId,
          idSolicitud
        );

        const userEmail = datosIniciales?.correo || '';
        if (!userEmail) {
          return;
        }

        const userName = datosIniciales?.nombre || '';
        const procesoId = String(solicitudRow[SHEET_COLUMNS.SOLICITUDES.id_proceso] ?? '').trim();
        const {
          procesoNombre,
          actividadAnteriorNombre,
          actividadNuevaNombre,
          actividadNuevaArchivos,
          actividadAnteriorEsUltima,
        } = await getProcesoYActividadesInfo(
          sheets,
          spreadsheetId,
          procesoId,
          actividadAnteriorId,
          actividadNuevaId
        );

        const fechaHoraNotificacion = formatSolicitudFechaHora(fecha);
        const isFinalActivityCompleted = actividadAnteriorId && actividadAnteriorEsUltima;

        if (isFinalActivityCompleted) {
          const correoExtra = await getRegistroCorreoExtra(
            sheets,
            spreadsheetId,
            idSolicitud,
            actividadAnteriorId
          );

          await sendProcesoFinalizadoNotification({
            to: userEmail,
            solicitudId: idSolicitud,
            userName,
            userEmail,
            proceso: procesoNombre,
            fechaHora: fechaHoraNotificacion,
            extraCc: correoExtra,
          });
        } else {
          await sendCambioActividadNotification({
            to: userEmail,
            solicitudId: idSolicitud,
            userName,
            userEmail,
            proceso: procesoNombre,
            actividadAnterior: actividadAnteriorNombre,
            actividadNueva: actividadNuevaNombre,
            actividadNuevaArchivos,
            fechaHora: fechaHoraNotificacion,
          });
        }
      } catch (emailError) {
        console.error('Error enviando correo de cambio de actividad:', emailError);
      }
    }

    if (updates.length === 1) {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updates[0].range,
        valueInputOption,
        requestBody: { values: updates[0].values },
      });

      await maybeSendCambioActividadEmail();

      return res.status(200).json({
        status: true,
        message: 'Solicitud actualizada correctamente.',
        data: response.data,
      });
    }

    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption,
        data: updates,
      },
    });

    await maybeSendCambioActividadEmail();

    return res.status(200).json({
      status: true,
      message: 'Solicitud actualizada correctamente.',
      data: response.data,
    });
  } catch (error) {
    console.error('Error actualizando SOLICITUDES:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

const uploadDocumentoDrive = async (req, res) => {
  try {
    const folderId = getDriveFolderId();
    if (!folderId) {
      return res.status(500).json({
        status: false,
        message: 'Falta GOOGLE_DRIVE_FOLDER_ID o DRIVE_FOLDER_ID en variables de entorno.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: 'Debes enviar un archivo en el campo "file".',
      });
    }

    const drive = await getDriveClient();
    const fileName = resolveUploadFileName(req, req.file);

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: req.file.mimetype || 'application/octet-stream',
        body: Readable.from(req.file.buffer),
      },
      fields: 'id,name,webViewLink,webContentLink,mimeType,thumbnailLink',
      supportsAllDrives: true,
    });

    const fileId = createResponse.data.id;

    if (fileId) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    }

    const url =
      createResponse.data.webViewLink ||
      createResponse.data.webContentLink ||
      (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

    return res.status(201).json({
      status: true,
      message: 'Archivo cargado correctamente.',
      data: {
        id: fileId,
        name: createResponse.data.name,
        url,
        mimeType: createResponse.data.mimeType,
        thumbnailLink: createResponse.data.thumbnailLink || '',
      },
    });
  } catch (error) {
    console.error('Error subiendo archivo a Drive:', error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

module.exports = {
  getAllSheetsData,
  getMySolicitudes,
  getActividades,
  getProcesos,
  getProcesoById,
  updateRegistroAprobado,
  updateRegistroObservacion,
  updateRegistroUrl,
  updateSolicitudEtapa,
  uploadDocumentoDrive,
  updateSheetData,
  appendSheetRow,
};

