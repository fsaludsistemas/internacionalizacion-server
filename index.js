const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const sheetRoutes = require('./src/routes/sheet.route');
const authRoutes = require('./src/routes/auth.route');
const { runRecordatoriosCron } = require('./src/controllers/cronController');
const { requireAuth } = require('./src/middlewares/authMiddleware');
const app = express();

const allowedOrigins = [
  'https://internacionalizacion-salud.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin(origin, callback) {
    // Permite solicitudes sin Origin (curl, cron y llamadas servidor a servidor).
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.get('/api/cron/recordatorios', runRecordatoriosCron);
app.use('/api/sheets', requireAuth, sheetRoutes);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('¡Servidor Express funcionando!');
});

// Vercel usa el export como handler serverless. Solo levantamos un servidor
// cuando se ejecuta localmente con `npm start`.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
