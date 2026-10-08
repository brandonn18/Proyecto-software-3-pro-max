const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { crearVerificarToken } = require('./middlewares/autenticacion');
const { crearErrorHandler } = require('./middlewares/errorHandler');
const { crearRateLimiter } = require('./middlewares/rateLimiter');
const { crearTicketsController } = require('./controllers/tickets.controller');
const { crearReportesController } = require('./controllers/reportes.controller');
const { crearNotificacionesController } = require('./controllers/notificaciones.controller');
const { crearSLAController } = require('./controllers/sla.controller');
const { crearRutasTickets } = require('./rutas/tickets');
const { crearRutasReportes, crearRutasSLA } = require('./rutas/reportes');
const { crearRutasNotificaciones } = require('./rutas/notificaciones');

const _montarRutas = (app, casos, verificarToken) => {
  const slaCtrl = crearSLAController(casos.slaConfig);
  app.use('/api/tickets', verificarToken, crearRutasTickets(crearTicketsController(casos)));
  app.use('/api/reports', verificarToken, crearRutasReportes(crearReportesController(casos.reportes), slaCtrl));
  app.use('/api/sla', verificarToken, crearRutasSLA(slaCtrl));
  app.use('/api/notifications', verificarToken, crearRutasNotificaciones(crearNotificacionesController(casos.bandeja)));
};

// Adaptador de entrada HTTP. Recibe los casos de uso ya construidos (no
// conoce Sequelize ni authcore): ver src/composicion.js.
const crearApp = ({ casos, jwtSecret, origenPermitido, esTest = false, logger = console }) => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: origenPermitido, credentials: true }));
  if (!esTest) app.use(morgan('combined'));
  app.use(express.json({ limit: '100kb' }));
  app.use(crearRateLimiter({ deshabilitado: esTest }));

  app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', servicio: 'domain-service' }, message: 'OK' }));
  _montarRutas(app, casos, crearVerificarToken(jwtSecret));
  app.use((req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada', errors: [] }));
  app.use(crearErrorHandler(logger));
  return app;
};

module.exports = { crearApp };
