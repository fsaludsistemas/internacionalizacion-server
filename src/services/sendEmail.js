const nodemailer = require('nodemailer');
require('dotenv').config();
const path = require('path');

const CORREO_DRI=process.env.EMAIL_DRI;

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

const attachments = [{
	filename: 'imagen_firma.png',
	path: path.join(__dirname, '../assets/imagen_firma.png'), // Ajusta la ruta según tu estructura
	cid: 'logoUnivalle' // Debe coincidir con el src en el HTML
}];

async function sendEmail({ to, cc, subject, text, html, attachments }) {
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
		attachments,
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
		 Estimado profesor(a) ${safeUserName}, su solicitud de ${solicitudLabel} ha iniciado.`,
		`Para la Oficina de Asuntos Internacionales de la Facultad de Salud es grato apoyar los procesos orientados al establecimiento de nuevas alianzas de cooperación académica internacional con instituciones de gran prestigio, las cuales contribuyen al fortalecimiento de la formación académica, investigativa y de extensión de nuestra comunidad universitaria.
		 Adjuntamos documento donde se detalla el proceso para la suscripción de Convenios Internacionales (documento). 
		 Cualquier inquietud con gusto la atenderemos.
		 Cordialmente, `,

		

	].join('\n');

	const html = [
		`<p><strong>Solicitud:</strong> ${solicitudLabel}</p>`,
		`<p>Cordial saludo,</p>`,
		`<p>Estimado profesor(a) <strong>${safeUserName}</strong>, su solicitud de <strong>${solicitudLabel}</strong> ha iniciado.</p>`,
		`<p>Para la Oficina de Asuntos Internacionales de la Facultad de Salud es grato apoyar los procesos orientados al establecimiento de nuevas alianzas de cooperación académica internacional con instituciones de gran prestigio, las cuales contribuyen al fortalecimiento de la formación académica, investigativa y de extensión de nuestra comunidad universitaria.</p>`,
		`<p>A continuación lo invitamos a diligencias los siguientes documentos.</p>`,
		`<p>Adjuntamos documento donde se detalla el proceso para la suscripción de Convenios Internacionales <a href="https://drive.google.com/file/d/1zEjWFj-rg8uK_RkB_-4SGVavAyi6TdA-/view?usp=sharing">(documento)</a></p>`,
		`<p>Cualquier inquietud con gusto la atenderemos.</p>`,
		`<p>Cordialmente,</p>`,
		`<p style="margin:0px;" ><strong>Esther Cecilia Wilches Luna</strong></p>
		<p style="margin:0px;">Coordinadora</p>
		<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>

			<p style="margin-bottom:0px;"><strong>Mónica María Durán Salas</strong></p>
			<p style="margin:0px;">Profesional</p>
			<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>
			<p style="margin:0px;">Número telefónico: (57 - 602) 3212100 Ext. 4072</p>
			<p style="margin:0px;">https://internacionalessalud.univalle.edu.co/movilidad-internacional</p>
			`,
			`<img src="cid:logoUnivalle" alt="Logo Univalle" />`,
			`<p style="margin:0px;" >Horario de atención:</p>`,
			`<p style="margin:0px;" >Lunes a Viernes de 8:00 a.m. a 12:00 m. - 2:00 p.m. a 5:00 p.m.</p>`,
			`<p style="margin:0px;" > Hora Colombia, Bogotá GMT-5 </p>`,
			 `<p><strong>AVISO LEGAL:</strong> Este mensaje y/o sus anexos son confidenciales y para uso exclusivo de su destinatario intencional. Si usted no es el destinatario, le informamos que no podrá use, retener, imprimir, copiar, distribuir o hacer público su contenido. Cualquier retención, revisión no autorizada, distribución, divulgación, reenvío, copia, impresión, reproducción o uso indebido de este mensaje y/o anexos, esté estrictamente prohibida y sancionada de acuerdo con la Ley 1273 de enero del 2009. Si ha recibido este correo por error, por favor elimínelo e infórmenos al correo internasalud@correounivalle.edu.co Si usted es el destinatario, le solicitamos mantener reserva sobre el contenido, los datos o información de contacto del remitente y en general sobre la información de este documento y/o archivos adjuntos, a no ser que exista una autorización explícita</p>.
`,
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

	return sendEmail({ to, cc: getNotificationCc(cc), subject, text, html, attachments });
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
		`<p style="margin:0px;" ><strong>Esther Cecilia Wilches Luna</strong></p>
		<p style="margin:0px;">Coordinadora</p>
		<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>

			<p style="margin-bottom:0px;"><strong>Mónica María Durán Salas</strong></p>
			<p style="margin:0px;">Profesional</p>
			<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>
			<p style="margin:0px;">Número telefónico: (57 - 602) 3212100 Ext. 4072</p>
			<p style="margin:0px;">https://internacionalessalud.univalle.edu.co/movilidad-internacional</p>
			`,
		`<img src="cid:logoUnivalle" alt="Logo Univalle" />`,
			`<p style="margin:0px;" >Horario de atención:</p>`,
			`<p style="margin:0px;" >Lunes a Viernes de 8:00 a.m. a 12:00 m. - 2:00 p.m. a 5:00 p.m.</p>`,
			`<p style="margin:0px;" > Hora Colombia, Bogotá GMT-5 </p>`,
			 `<p><strong>AVISO LEGAL:</strong> Este mensaje y/o sus anexos son confidenciales y para uso exclusivo de su destinatario intencional. Si usted no es el destinatario, le informamos que no podrá use, retener, imprimir, copiar, distribuir o hacer público su contenido. Cualquier retención, revisión no autorizada, distribución, divulgación, reenvío, copia, impresión, reproducción o uso indebido de este mensaje y/o anexos, esté estrictamente prohibida y sancionada de acuerdo con la Ley 1273 de enero del 2009. Si ha recibido este correo por error, por favor elimínelo e infórmenos al correo internasalud@correounivalle.edu.co Si usted es el destinatario, le solicitamos mantener reserva sobre el contenido, los datos o información de contacto del remitente y en general sobre la información de este documento y/o archivos adjuntos, a no ser que exista una autorización explícita</p>.
`,
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

	return sendEmail({ to, cc: getNotificationCc(cc), subject, text, html,attachments });
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
		`<p style="margin:0px;" ><strong>Esther Cecilia Wilches Luna</strong></p>
		<p style="margin:0px;">Coordinadora</p>
		<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>

			<p style="margin-bottom:0px;"><strong>Mónica María Durán Salas</strong></p>
			<p style="margin:0px;">Profesional</p>
			<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>
			<p style="margin:0px;">Número telefónico: (57 - 602) 3212100 Ext. 4072</p>
			<p style="margin:0px;">https://internacionalessalud.univalle.edu.co/movilidad-internacional</p>
			`,
		`<img src="cid:logoUnivalle" alt="Logo Univalle" />`,
			`<p style="margin:0px;" >Horario de atención:</p>`,
			`<p style="margin:0px;" >Lunes a Viernes de 8:00 a.m. a 12:00 m. - 2:00 p.m. a 5:00 p.m.</p>`,
			`<p style="margin:0px;" > Hora Colombia, Bogotá GMT-5 </p>`,
			 `<p><strong>AVISO LEGAL:</strong> Este mensaje y/o sus anexos son confidenciales y para uso exclusivo de su destinatario intencional. Si usted no es el destinatario, le informamos que no podrá use, retener, imprimir, copiar, distribuir o hacer público su contenido. Cualquier retención, revisión no autorizada, distribución, divulgación, reenvío, copia, impresión, reproducción o uso indebido de este mensaje y/o anexos, esté estrictamente prohibida y sancionada de acuerdo con la Ley 1273 de enero del 2009. Si ha recibido este correo por error, por favor elimínelo e infórmenos al correo internasalud@correounivalle.edu.co Si usted es el destinatario, le solicitamos mantener reserva sobre el contenido, los datos o información de contacto del remitente y en general sobre la información de este documento y/o archivos adjuntos, a no ser que exista una autorización explícita</p>.
`,
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

	return sendEmail({ to, cc: ccValue, subject, text, html, attachments });
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
		`<p style="margin:0px;" ><strong>Esther Cecilia Wilches Luna</strong></p>
		<p style="margin:0px;">Coordinadora</p>
		<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>

			<p style="margin-bottom:0px;"><strong>Mónica María Durán Salas</strong></p>
			<p style="margin:0px;">Profesional</p>
			<p style="margin:0px;">Oficina de Asuntos Internacionales - Facultad de Salud</p>
			<p style="margin:0px;">Número telefónico: (57 - 602) 3212100 Ext. 4072</p>
			<p style="margin:0px;">https://internacionalessalud.univalle.edu.co/movilidad-internacional</p>
			`,
		`<img src="cid:logoUnivalle" alt="Logo Univalle" />`,
			`<p style="margin:0px;" >Horario de atención:</p>`,
			`<p style="margin:0px;" >Lunes a Viernes de 8:00 a.m. a 12:00 m. - 2:00 p.m. a 5:00 p.m.</p>`,
			`<p style="margin:0px;" > Hora Colombia, Bogotá GMT-5 </p>`,
			 `<p><strong>AVISO LEGAL:</strong> Este mensaje y/o sus anexos son confidenciales y para uso exclusivo de su destinatario intencional. Si usted no es el destinatario, le informamos que no podrá use, retener, imprimir, copiar, distribuir o hacer público su contenido. Cualquier retención, revisión no autorizada, distribución, divulgación, reenvío, copia, impresión, reproducción o uso indebido de este mensaje y/o anexos, esté estrictamente prohibida y sancionada de acuerdo con la Ley 1273 de enero del 2009. Si ha recibido este correo por error, por favor elimínelo e infórmenos al correo internasalud@correounivalle.edu.co Si usted es el destinatario, le solicitamos mantener reserva sobre el contenido, los datos o información de contacto del remitente y en general sobre la información de este documento y/o archivos adjuntos, a no ser que exista una autorización explícita</p>.
`,
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

	return sendEmail({ to, cc, subject, text, html, attachments });
}

module.exports = {
	sendEmail,
	sendNuevoProcesoNotification,
	sendCambioActividadNotification,
	sendProcesoFinalizadoNotification,
	sendRecordatorioNotification,
};
