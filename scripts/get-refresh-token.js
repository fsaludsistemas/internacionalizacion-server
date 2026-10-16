const http = require('http');
const url = require('url');
const { google } = require('googleapis');
require('dotenv').config();

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
const clientSecret = process.env.secret_client;

if (!clientId || !clientSecret) {
  console.error('\n==================================================');
  console.error('Error: Faltan variables de entorno para autenticar.');
  console.error('Por favor, asegúrate de tener en tu .env:');
  console.error('GOOGLE_WEB_CLIENT_ID="..."');
  console.error('secret_client="..."');
  console.error('==================================================\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Crucial para recibir el refresh token
  scope: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ],
  prompt: 'consent' // Fuerza a Google a mostrar el consentimiento y entregar el refresh token
});

console.log('\n==================================================');
console.log('1. Abre este enlace en tu navegador para autorizar la aplicación:');
console.log('\x1b[36m%s\x1b[0m', authUrl);
console.log('==================================================\n');

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const query = url.parse(req.url, true).query;
      const code = query.code;

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>¡Autenticación exitosa!</h1><p>Puedes cerrar esta pestaña y regresar a la terminal o consola.</p>');

        const { tokens } = await oauth2Client.getToken(code);
        console.log('\n==================================================');
        console.log('¡Tus tokens de Google han sido obtenidos con éxito!');
        console.log('==================================================\n');
        console.log('Copia y agrega la siguiente variable a tu archivo .env:\n');
        console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
        console.log('\n==================================================');
        
        server.close();
        process.exit(0);
      }
    }
  } catch (e) {
    console.error('Error obteniendo tokens:', e);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error al procesar el código de autenticación.');
  }
});

server.listen(PORT, () => {
  console.log(`Escuchando redirección en http://localhost:${PORT}/oauth2callback...`);
});
