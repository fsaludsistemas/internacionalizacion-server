const { google } = require('googleapis');
require('dotenv').config();

const GOOGLE_SCOPES = [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive',
];

const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
const clientSecret = process.env.secret_client;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
	throw new Error(
		'Faltan variables de entorno para la autenticación OAuth2 de Google (GOOGLE_WEB_CLIENT_ID / secret_client / GOOGLE_REFRESH_TOKEN).'
	);
}

const oauth2Client = new google.auth.OAuth2(
	clientId,
	clientSecret,
	'http://localhost:3000/oauth2callback'
);

oauth2Client.setCredentials({
	refresh_token: refreshToken,
});

async function ensureGoogleJwtAuth() {
	// Google's OAuth2 client refreshes tokens automatically when needed, so we simply return it.
	return oauth2Client;
}

module.exports = {
	jwtClient: oauth2Client,
	ensureGoogleJwtAuth,
};
