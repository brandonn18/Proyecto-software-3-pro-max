// Aplicación Express: conecta cada ruta con su controlador. Los controladores
// reciben los modelos ya definidos (models/index.js) y responden con vistas.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { crearVerificarToken } = require('./middlewares/autenticacion');
const { crearErrorHandler } = require('./middlewares/errorHandler');
const { crearRateLimiter } = require('./middlewares/rateLimiter');
const respuesta = require('./views/respuesta');
const { crearTicketsController } = require('./controllers/tickets.controller');
const { crearReportesController } = require('./controllers/reportes.controller');
const { crearNotificacionesController } = require('./controllers/notificaciones.controller');
const { crearSLAController } = require('./controllers/sla.controller');
const { crearComentariosController } = require('./controllers/comentarios.controller');
const { crearPanelComentariosController } = require('./controllers/panelComentarios.controller');
const { crearRutasTickets } = require('./routes/tickets');
const { crearRutasReportes, crearRutasSLA } = require('./routes/reportes');
const { crearRutasNotificaciones } = require('./routes/notificaciones');
const { crearRutasComentarios } = require('./routes/comentarios');
const { crearRutasPanelComentarios } = require('./routes/panelComentarios');

const _montarRutas = (app, modelos, verificarToken, modulos) => {
  const slaCtrl = crearSLAController(modelos);
  app.use('/api/tickets', verificarToken, crearRutasTickets(crearTicketsController(modelos)));
  app.use('/api/reports', verificarToken, crearRutasReportes(crearReportesController(modelos), slaCtrl));
  app.use('/api/sla', verificarToken, crearRutasSLA(slaCtrl));
  app.use('/api/notifications', verificarToken, crearRutasNotificaciones(crearNotificacionesController(modelos)));
  if (modulos.comentarios) app.use('/api/v1/tickets', verificarToken, crearRutasComentarios(crearComentariosController(modelos)));
  if (modulos.mvc) app.use('/api/v1/mvc/tickets', verificarToken, crearRutasPanelComentarios(crearPanelComentariosController(modelos)));
};

// modelos: definirModelos(sequelize) | modulos: { comentarios?, mvc? } (MODULO_COMENTARIOS, MODULO_MVC)
// trustProxy: número de proxies delante (nginx/ALB). Sin él, req.ip es la IP
// del proxy y el rate limit se comparte entre todos los usuarios.
const crearApp = ({ modelos, jwtSecret, modulos = {}, origenPermitido, esTest = false, logger = console, trustProxy = 0 }) => {
  const app = express();
  if (trustProxy > 0) app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: origenPermitido, credentials: true }));
  if (!esTest) app.use(morgan('combined'));
  app.use(express.json({ limit: '100kb' }));
  app.use(crearRateLimiter({ deshabilitado: esTest }));

  app.get('/api/health', (req, res) => res.json(respuesta.exito({ status: 'ok', servicio: 'domain-service' })));
  _montarRutas(app, modelos, crearVerificarToken(jwtSecret), modulos);
  app.use((req, res) => res.status(404).json(respuesta.error('Ruta no encontrada')));
  app.use(crearErrorHandler(logger));
  return app;
};

module.exports = { crearApp };
