const { google } = require('googleapis');
const { sheetRanges } = require('../config/sheetRanges');
const { jwtClient, ensureGoogleJwtAuth } = require('../config/google');
const { sendRecordatorioNotification } = require('../services/sendEmail');
require('dotenv').config();

const SHEET_COLUMNS = {
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
    id_adjunto: 2,
    nombre: 3,
    tiempo_max: 4,
    orden: 5,
  },
  PROCESOS: {
    id: 0,
    nombre: 1,
  },
  DATOS_INICIALES_SOLICITUD: {
    id: 0,
    id_solicitud: 1,
    nombre: 2,
    correo: 3,
  },
  RECORDATORIOS: {
    id_solicitud: 0,
    id_actividad: 1,
    fecha_ultimo_envio: 2,
  },
};

async function getSheetsClient() {
  await ensureGoogleJwtAuth();
  return google.sheets({ version: 'v4', auth: jwtClient });
}

async function getSheetRows(sheets, spreadsheetId, sheetName) {
  const range = `${sheetName}!${sheetRanges[sheetName]}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

function rowsToObjectsWithRowNumber(rows = [], columns = {}, options = {}) {
  const { idKey = 'id', skipEmpty = true } = options;
  if (!rows.length) {
    return [];
  }

  const dataRows = rows.slice(1);

  return dataRows
    .map((row, index) => {
      const rowObject = Object.entries(columns).reduce((acc, [key, colIndex]) => {
        acc[key] = row[colIndex] ?? '';
        return acc;
      }, {});

      rowObject.__rowNumber = index + 2;
      return rowObject;
    })
    .filter((rowObject) => {
      if (!skipEmpty || !idKey) {
        return true;
      }

      const idValue = rowObject[idKey];
      return idValue !== '' && idValue !== undefined && idValue !== null;
    });
}

function parseSheetDate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const text = String(rawValue).trim();
  if (!text) {
    return null;
  }

  const dmyMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmyMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = dmyMatch;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(
      hour
    ).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const ymdMatch = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (ymdMatch) {
    const [, year, month, day, hour = '0', minute = '0'] = ymdMatch;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(
      hour
    ).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNowBogota() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
}

function formatBogotaDateTime(date) {
  return date.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function buildRegistroKey(idSolicitud, idActividad) {
  return `${String(idSolicitud).trim()}::${String(idActividad).trim()}`;
}

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

function isCronAuthorized(req) {
  if (!process.env.CRON_SECRET) {
    return true;
  }

  const token = req.query?.token || req.headers['x-cron-secret'];
  return token && String(token) === String(process.env.CRON_SECRET);
}

async function runRecordatoriosCron(req, res) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ status: false, message: 'No autorizado.' });
  }

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.spreadsheet;
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();

    const [
      solicitudesRows,
      actividadesRows,
      procesosRows,
      datosRows,
      recordatoriosRows,
    ] = await Promise.all([
      getSheetRows(sheets, spreadsheetId, 'SOLICITUDES'),
      getSheetRows(sheets, spreadsheetId, 'ACTIVIDADES'),
      getSheetRows(sheets, spreadsheetId, 'PROCESOS'),
      getSheetRows(sheets, spreadsheetId, 'DATOS_INICIALES_SOLICITUD'),
      getSheetRows(sheets, spreadsheetId, 'RECORDATORIOS'),
    ]);

    const solicitudes = rowsToObjectsWithRowNumber(solicitudesRows, SHEET_COLUMNS.SOLICITUDES);
    const actividades = rowsToObjectsWithRowNumber(actividadesRows, SHEET_COLUMNS.ACTIVIDADES);
    const procesos = rowsToObjectsWithRowNumber(procesosRows, SHEET_COLUMNS.PROCESOS);
    const datosIniciales = rowsToObjectsWithRowNumber(
      datosRows,
      SHEET_COLUMNS.DATOS_INICIALES_SOLICITUD
    );
    const recordatorios = rowsToObjectsWithRowNumber(
      recordatoriosRows,
      SHEET_COLUMNS.RECORDATORIOS,
      {
        idKey: 'id_solicitud',
        skipEmpty: false,
      }
    );

    const actividadesMap = new Map(
      actividades.map((actividad) => [String(actividad.id ?? '').trim(), actividad])
    );
    const procesosMap = new Map(
      procesos.map((proceso) => [String(proceso.id ?? '').trim(), proceso])
    );
    const datosMap = new Map(
      datosIniciales.map((dato) => [String(dato.id_solicitud ?? '').trim(), dato])
    );

    const recordatoriosMap = new Map();
    recordatorios.forEach((recordatorio) => {
      const key = buildRegistroKey(recordatorio.id_solicitud, recordatorio.id_actividad);
      recordatoriosMap.set(key, recordatorio);
    });

    const now = getNowBogota();
    let enviados = 0;
    let omitidos = 0;

    for (const solicitud of solicitudes) {
      const idSolicitud = String(solicitud.id ?? '').trim();
      const actividadId = String(solicitud.actividad_actual ?? '').trim();
      const procesoId = String(solicitud.id_proceso ?? '').trim();
      const fechaInicio = parseSheetDate(solicitud.fecha);

      if (!idSolicitud || !actividadId || !fechaInicio) {
        omitidos += 1;
        continue;
      }

      const actividad = actividadesMap.get(actividadId);
      if (!actividad) {
        omitidos += 1;
        continue;
      }

      const maxDias = Number(actividad.tiempo_max);
      if (!Number.isFinite(maxDias) || maxDias <= 0) {
        omitidos += 1;
        continue;
      }

      const registroKey = buildRegistroKey(idSolicitud, actividadId);

      const vencimiento = addDays(fechaInicio, maxDias);
      const intervaloDias = maxDias === 1 ? 1 : 2;
      const recordatorio = recordatoriosMap.get(registroKey);
      const lastSent = recordatorio?.fecha_ultimo_envio
        ? parseSheetDate(recordatorio.fecha_ultimo_envio)
        : null;

      const siguienteEnvio = lastSent
        ? addDays(lastSent, intervaloDias)
        : addDays(vencimiento, intervaloDias);

      if (now < siguienteEnvio) {
        omitidos += 1;
        continue;
      }

      const datos = datosMap.get(idSolicitud);
      const userEmail = String(datos?.correo ?? '').trim();
      if (!userEmail) {
        omitidos += 1;
        continue;
      }

      if (!adminEmail) {
        omitidos += 1;
        continue;
      }

      const userName = String(datos?.nombre ?? '').trim();
      const procesoNombre = procesosMap.get(procesoId)?.nombre || (procesoId ? `ID ${procesoId}` : '');
      try {
        await sendRecordatorioNotification({
          to: adminEmail,
          solicitudId: idSolicitud,
          userName,
          userEmail,
          proceso: procesoNombre,
          actividad: actividad.nombre || actividadId,
          fechaHora: formatBogotaDateTime(now),
          fechaVencimiento: formatBogotaDateTime(vencimiento),
          maxDias,
        });

        const fechaEnvio = formatBogotaDateTime(now);

        if (recordatorio?.__rowNumber) {
          const columnLetter = columnIndexToLetter(
            SHEET_COLUMNS.RECORDATORIOS.fecha_ultimo_envio
          );
          const range = `RECORDATORIOS!${columnLetter}${recordatorio.__rowNumber}`;

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[fechaEnvio]] },
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'RECORDATORIOS!A1',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [[idSolicitud, actividadId, fechaEnvio]] },
          });
        }

        enviados += 1;
      } catch (error) {
        console.error('Error enviando recordatorio:', error);
        omitidos += 1;
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Recordatorios procesados.',
      data: {
        enviados,
        omitidos,
      },
    });
  } catch (error) {
    console.error('Error ejecutando cron de recordatorios:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}

module.exports = {
  runRecordatoriosCron,
};
