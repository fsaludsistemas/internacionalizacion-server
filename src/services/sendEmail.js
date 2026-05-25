const nodemailer = require('nodemailer');
require('dotenv').config();

const CORREO_DRI="samuel.ramirez@correounivalle.edu.co"

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

function getFromAddress() {
	const baseEmail = process.env.EMAIL;
	const displayName = String(process.env.EMAIL_FROM_NAME || '').trim();

	if (!displayName) {
		return baseEmail;
	}

	return `${displayName} <${baseEmail}>`;
}

async function sendEmail({ to, cc, subject, text, html }) {
	const transporter = getTransporter();
	const mergedCc = mergeEmailLists(cc, CORREO_DRI);
	const ccValue = mergedCc.length ? mergedCc : undefined;

	return transporter.sendMail({
		from: getFromAddress(),
		to,
		cc: ccValue,
		subject,
		text,
		html,
	});
}

function getNotificationCc(explicitCc) {
	return explicitCc || process.env.NOTIFICATIONS_CC;
}

function normalizeEmailList(value) {
	if (!value) {
		return [];
	}

	const entries = Array.isArray(value) ? value : [value];
	const emails = entries.flatMap((entry) => String(entry).split(','));
	const unique = new Set();

	emails.forEach((email) => {
		const trimmed = String(email).trim();
		if (trimmed) {
			unique.add(trimmed);
		}
	});

	return Array.from(unique);
}

function mergeEmailLists(...values) {
	const merged = new Set();
	values.forEach((value) => {
		normalizeEmailList(value).forEach((email) => merged.add(email));
	});

	return Array.from(merged);
}

function normalizeArchivos(value) {
	if (!value) {
		return [];
	}

	const entries = Array.isArray(value) ? value : [value];
	const items = entries.flatMap((entry) => String(entry).split(/[,;\n]/));
	const unique = new Set();

	items.forEach((item) => {
		const trimmed = String(item).trim();
		if (trimmed) {
			unique.add(trimmed);
		}
	});

	return Array.from(unique);
}

function buildArchivosBlocks(archivos = []) {
	if (!archivos.length) {
		return { text: '', html: '' };
	}

	const text = ['Archivos:', ...archivos.map((item) => `- ${item}`)].join('\n');
	const html = [
		'<p><strong>Archivos:</strong></p>',
		'<ul>',
		...archivos.map((item) => `<li><a href="${item}">${item}</a></li>`),
		'</ul>',
	].join('');

	return { text, html };
}


function buildNuevoProcesoEmail({ solicitudId, userName, userEmail, fechaHora, proceso }) {
	const safeSolicitudId = solicitudId ? String(solicitudId).trim() : '';
	const safeProceso = proceso ? String(proceso).trim() : '';
	const subjectParts = ['Solicitud', safeProceso, safeSolicitudId].filter(Boolean);
	const subject = subjectParts.length
		? `${subjectParts.join(' ')} - Proceso iniciado`
		: 'Proceso iniciado';
	const safeUserName = userName || 'Usuario';
	const safeUserEmail = userEmail || 'No informado';
	const safeFechaHora = fechaHora || 'No informada';
	const solicitudLabel = safeSolicitudId || 'No informada';

	const text = [
		`Solicitud: ${solicitudLabel}`,
		`Cordial saludo,
		Estimado docente ${safeUserName}, su solicitud de ${solicitudLabel} ha iniciado.`,
		`Correo registrado: ${safeUserEmail}`,
		`A continuación lo invitamos a diligencias los siguientes documentos.`,
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Cordial saludo,</p>`,
		`<p>Estimado docente <strong>${safeUserName}</strong>, su solicitud de <strong>${solicitudLabel}</strong> ha iniciado.</p>`,
		`<p><strong>Correo registrado:</strong> ${safeUserEmail}</p>`,
		`<p>A continuación lo invitamos a diligencias los siguientes documentos.</p>`,
		`<p><strong>Acta de reunión:</strong> <a href="https://docs.google.com/document/d/1Dw82JtNge-nBHCRHwexpv-XR9-6fTnbc/edit?usp=sharing&ouid=108217996348122292118&rtpof=true&sd=true">Acta de reunión</a></p>`,
		`<p><strong>Formulario de solicitud:</strong> <a href="https://docs.google.com/forms/d/e/1FAIpQLSdecwwM8VglB1NCrWCirJ54APkkfikHqcHLeUE-UlsOf1hJRQ/viewform">Formulario de solicitud</a></p>`,
		`<p>Quedamos en espera de la documentación debidamente diligenciada para continuar con el proceso.</p>`,
	].join('');

	return { subject, text, html };
}

async function sendNuevoProcesoNotification({
	to,
	cc,
	solicitudId,
	userName,
	userEmail,
	fechaHora,
	proceso,
}) {
	const { subject, text, html } = buildNuevoProcesoEmail({
		solicitudId,
		userName,
		userEmail,
		fechaHora,
		proceso,
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
	actividadNuevaArchivos,
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
	const archivosList = normalizeArchivos(actividadNuevaArchivos);
	const archivosBlocks = buildArchivosBlocks(archivosList);

	const textLines = [
		`Solicitud: ${solicitudLabel}`,
		`Cordial saludo,
		Estimado docente ${safeUserName}, su solicitud avanzo de actividad.`,
		`Correo registrado: ${safeUserEmail}`,
		`Proceso: ${safeProceso}`,
		`Actividad anterior: ${safeAnterior}`,
		`Actividad nueva: ${safeNueva}`,
		
	];

	if (archivosBlocks.text) {
		textLines.push(archivosBlocks.text);
	}

	const text = textLines.join('\n');

	const htmlBlocks = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Cordial saludo, </p>`,
		`<p>Estimado docente <strong>${safeUserName}</strong>, su solicitud avanzo de actividad.</p>`,
		`<p><strong>Correo registrado:</strong> ${safeUserEmail}</p>`,
		`<p><strong>Proceso:</strong> ${safeProceso}</p>`,
		`<p><strong>Actividad anterior:</strong> ${safeAnterior}</p>`,
		`<p><strong>Actividad nueva:</strong> ${safeNueva}</p>`,
	];

	if (archivosBlocks.html) {
		htmlBlocks.push(archivosBlocks.html);
	}

	const html = htmlBlocks.join('');

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
	actividadNuevaArchivos,
	fechaHora,
}) {
	const { subject, text, html } = buildCambioActividadEmail({
		solicitudId,
		userName,
		userEmail,
		proceso,
		actividadAnterior,
		actividadNueva,
		actividadNuevaArchivos,
		fechaHora,
	});

	return sendEmail({ to, cc: getNotificationCc(cc), subject, text, html });
}

function buildProcesoFinalizadoEmail({ solicitudId, userName, userEmail, proceso, fechaHora }) {
	const safeSolicitudId = solicitudId ? String(solicitudId).trim() : '';
	const safeProceso = proceso ? String(proceso).trim() : '';
	const subjectParts = ['Solicitud', safeProceso, safeSolicitudId].filter(Boolean);
	const subject = subjectParts.length
		? `${subjectParts.join(' ')} - Proceso finalizado`
		: 'Proceso finalizado';
	const safeUserName = userName || 'Usuario';
	const safeUserEmail = userEmail || 'No informado';
	const safeFechaHora = fechaHora || 'No informada';
	const solicitudLabel = safeSolicitudId || 'No informada';
	const procesoLabel = safeProceso || 'No informado';

	const text = [
		`Solicitud: ${solicitudLabel}`,
		`Cordial Saludo,
		 Felicitaciones ${safeUserName}, su solicitud del proceso ${procesoLabel} ha finalizado satisfactoriamente y ya fue revisada por todas las partes.`,
		`Correo registrado: ${safeUserEmail}`,
		`Proceso: ${procesoLabel}`,
		
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Cordial Saludo,
		 <strong> Felicitaciones ${safeUserName}</strong>, su solicitud del proceso <strong>${procesoLabel}</strong> ha finalizado satisfactoriamente y ya fue revisada por todas las partes.</p>`,
		`<p><strong>Correo registrado:</strong> ${safeUserEmail}</p>`,
		`<p><strong>Proceso:</strong> ${procesoLabel}</p>`,
	].join('');

	return { subject, text, html };
}

async function sendProcesoFinalizadoNotification({
	to,
	cc,
	extraCc,
	solicitudId,
	userName,
	userEmail,
	proceso,
	fechaHora,
}) {
	const { subject, text, html } = buildProcesoFinalizadoEmail({
		solicitudId,
		userName,
		userEmail,
		proceso,
		fechaHora,
	});
	const mergedCc = mergeEmailLists(getNotificationCc(cc), extraCc);
	const ccValue = mergedCc.length ? mergedCc : undefined;

	return sendEmail({ to, cc: ccValue, subject, text, html });
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
		
	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>La solicitud del usuario <strong>${usuarioLabel}</strong> no ha avanzado a la siguiente actividad.</p>`,
		`<p><strong>Proceso:</strong> ${safeProceso}</p>`,
		`<p><strong>Actividad actual:</strong> ${safeActividad}</p>`,
		`<p><strong>Tiempo maximo (dias):</strong> ${safeMaxDias}</p>`,
		`<p><strong>Fecha de vencimiento:</strong> ${safeVencimiento}</p>`,
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
	sendProcesoFinalizadoNotification,
	sendRecordatorioNotification,
};
