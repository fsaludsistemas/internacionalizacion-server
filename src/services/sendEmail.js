const nodemailer = require('nodemailer');
require('dotenv').config();

let cachedTransporter;

function getTransporter() {
	if (cachedTransporter) {
		return cachedTransporter;
	}

	if (!process.env.EMAIL || !process.env.EMAIL_PASSWORD) {
		throw new Error('Faltan variables EMAIL y/o EMAIL_PASSWORD en el entorno.');
	}

	cachedTransporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: process.env.EMAIL,
			pass: process.env.EMAIL_PASSWORD,
		},
	});

	return cachedTransporter;
}

async function sendEmail({ to, cc, subject, text, html }) {
	const transporter = getTransporter();

	return transporter.sendMail({
		from: process.env.EMAIL,
		to,
		cc,
		subject,
		text,
		html,
	});
}

function getNotificationCc(explicitCc) {
	return explicitCc || process.env.NOTIFICATIONS_CC;
}


function buildNuevoProcesoEmail({ solicitudId, userName, userEmail, fechaHora }) {
	const safeSolicitudId = solicitudId ? `#${solicitudId}` : '';
	const subject = safeSolicitudId
		? `Solicitud ${safeSolicitudId} - Proceso iniciado`
		: 'Proceso iniciado';
	const safeUserName = userName || 'Usuario';
	const safeUserEmail = userEmail || 'No informado';
	const safeFechaHora = fechaHora || 'No informada';
	const solicitudLabel = safeSolicitudId || 'No informada';

	const text = [
		`Solicitud: ${solicitudLabel}`,
		`Hola ${safeUserName}, tu solicitud ha iniciado un nuevo proceso.`,
		`Correo registrado: ${safeUserEmail}`,
		`Fecha y hora: ${safeFechaHora}`,
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Hola <strong>${safeUserName}</strong>, tu solicitud ha iniciado un nuevo proceso.</p>`,
		`<p><strong>Correo registrado:</strong> ${safeUserEmail}</p>`,
		`<p><strong>Acta de reunión:</strong> <a href="https://docs.google.com/document/d/1Dw82JtNge-nBHCRHwexpv-XR9-6fTnbc/edit?usp=sharing&ouid=108217996348122292118&rtpof=true&sd=true">Acta de reunión</a></p>`,
		`<p><strong>Formulario de solicitud:</strong> <a href="https://docs.google.com/forms/d/e/1FAIpQLSdecwwM8VglB1NCrWCirJ54APkkfikHqcHLeUE-UlsOf1hJRQ/viewform">Formulario de solicitud</a></p>`,
		`<p><strong>Fecha y hora:</strong> ${safeFechaHora}</p>`,
		`<p>Por favor, no respondas a este correo, es una notificación automática.</p>`,
	].join('');

	return { subject, text, html };
}

async function sendNuevoProcesoNotification({ to, cc, solicitudId, userName, userEmail, fechaHora }) {
	const { subject, text, html } = buildNuevoProcesoEmail({
		solicitudId,
		userName,
		userEmail,
		fechaHora,
	});

	return sendEmail({ to, cc: getNotificationCc(cc), subject, text, html });
}

function buildCambioActividadEmail({
	solicitudId,
	userName,
	userEmail,
	proceso,
	actividadAnterior,
	actividadNueva,
	fechaHora,
}) {
	const safeSolicitudId = solicitudId ? `#${solicitudId}` : '';
	const subject = safeSolicitudId
		? `Solicitud ${safeSolicitudId} - Cambio de actividad`
		: 'Cambio de actividad';
	const safeUserName = userName || 'Usuario';
	const safeUserEmail = userEmail || 'No informado';
	const safeProceso = proceso || 'No informado';
	const safeAnterior = actividadAnterior || 'No informado';
	const safeNueva = actividadNueva || 'No informado';
	const safeFechaHora = fechaHora || 'No informada';
	const solicitudLabel = safeSolicitudId || 'No informada';

	const text = [
		`Solicitud: ${solicitudLabel}`,
		`Hola ${safeUserName}, tu solicitud avanzo de actividad.`,
		`Correo registrado: ${safeUserEmail}`,
		`Proceso: ${safeProceso}`,
		`Actividad anterior: ${safeAnterior}`,
		`Actividad nueva: ${safeNueva}`,
		`Fecha y hora: ${safeFechaHora}`,
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Hola <strong>${safeUserName}</strong>, tu solicitud avanzo de actividad.</p>`,
		`<p><strong>Correo registrado:</strong> ${safeUserEmail}</p>`,
		`<p><strong>Proceso:</strong> ${safeProceso}</p>`,
		`<p><strong>Actividad anterior:</strong> ${safeAnterior}</p>`,
		`<p><strong>Actividad nueva:</strong> ${safeNueva}</p>`,
		`<p><strong>Fecha y hora:</strong> ${safeFechaHora}</p>`,
	].join('');

	return { subject, text, html };
}

async function sendCambioActividadNotification({
	to,
	cc,
	solicitudId,
	userName,
	userEmail,
	proceso,
	actividadAnterior,
	actividadNueva,
	fechaHora,
}) {
	const { subject, text, html } = buildCambioActividadEmail({
		solicitudId,
		userName,
		userEmail,
		proceso,
		actividadAnterior,
		actividadNueva,
		fechaHora,
	});

	return sendEmail({ to, cc: getNotificationCc(cc), subject, text, html });
}

function buildRecordatorioEmail({
	solicitudId,
	userName,
	userEmail,
	proceso,
	actividad,
	fechaHora,
	fechaVencimiento,
	maxDias,
}) {
	const safeSolicitudId = solicitudId ? `#${solicitudId}` : '';
	const subject = safeSolicitudId
		? `Solicitud ${safeSolicitudId} - Recordatorio de avance de actividad`
		: 'Recordatorio de avance de actividad';
	const safeUserName = userName || 'Usuario';
	const safeUserEmail = userEmail || 'No informado';
	const safeProceso = proceso || 'No informado';
	const safeActividad = actividad || 'No informado';
	const safeFechaHora = fechaHora || 'No informada';
	const safeVencimiento = fechaVencimiento || 'No informado';
	const safeMaxDias = Number.isFinite(maxDias) ? String(maxDias) : 'No informado';
	const solicitudLabel = safeSolicitudId || 'No informada';
	const usuarioLabel = `${safeUserName} (${safeUserEmail})`;

	const text = [
		`Solicitud: ${solicitudLabel}`,
		`La solicitud del usuario ${usuarioLabel} no ha avanzado a la siguiente actividad.`,
		`Proceso: ${safeProceso}`,
		`Actividad actual: ${safeActividad}`,
		`Tiempo maximo (dias): ${safeMaxDias}`,
		`Fecha de vencimiento: ${safeVencimiento}`,
		`Fecha y hora del recordatorio: ${safeFechaHora}`,
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>La solicitud del usuario <strong>${usuarioLabel}</strong> no ha avanzado a la siguiente actividad.</p>`,
		`<p><strong>Proceso:</strong> ${safeProceso}</p>`,
		`<p><strong>Actividad actual:</strong> ${safeActividad}</p>`,
		`<p><strong>Tiempo maximo (dias):</strong> ${safeMaxDias}</p>`,
		`<p><strong>Fecha de vencimiento:</strong> ${safeVencimiento}</p>`,
		`<p><strong>Fecha y hora del recordatorio:</strong> ${safeFechaHora}</p>`,
	].join('');

	return { subject, text, html };
}

async function sendRecordatorioNotification({
	to,
	cc,
	solicitudId,
	userName,
	userEmail,
	proceso,
	actividad,
	fechaHora,
	fechaVencimiento,
	maxDias,
}) {
	const { subject, text, html } = buildRecordatorioEmail({
		solicitudId,
		userName,
		userEmail,
		proceso,
		actividad,
		fechaHora,
		fechaVencimiento,
		maxDias,
	});

	return sendEmail({ to, cc, subject, text, html });
}

module.exports = {
	sendEmail,
	sendNuevoProcesoNotification,
	sendCambioActividadNotification,
	sendRecordatorioNotification,
};
