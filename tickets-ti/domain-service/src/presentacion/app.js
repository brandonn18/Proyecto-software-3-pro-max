// Capa de PRESENTACIÓN: aplicación Express. Recibe los servicios de negocio ya
// armados y solo los expone por HTTP; nunca habla con la capa de datos.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { crearVerificarToken } = require('./middlewares/autenticacion');
const { crearErrorHandler } = require('./middlewares/errorHandler');
const { crearRateLimiter } = require('./middlewares/rateLimiter');
const { crearTicketsController } = require('./controladores/tickets.controller');
const { crearReportesController } = require('./controladores/reportes.controller');
const { crearNotificacionesController } = require('./controladores/notificaciones.controller');
const { crearSLAController } = require('./controladores/sla.controller');
const { crearComentariosController } = require('./controladores/comentarios.controller');
const { crearRutasTickets } = require('./rutas/tickets');
const { crearRutasReportes, crearRutasSLA } = require('./rutas/reportes');
const { crearRutasNotificaciones } = require('./rutas/notificaciones');
const { crearRutasComentarios } = require('./rutas/comentarios');

const _montarRutas = (app, servicios, verificarToken, { comentarios }) => {
  const slaCtrl = crearSLAController(servicios.sla);
  app.use('/api/tickets', verificarToken, crearRutasTickets(crearTicketsController(servicios)));
  app.use('/api/reports', verificarToken, crearRutasReportes(crearReportesController(servicios.reportes), slaCtrl));
  app.use('/api/sla', verificarToken, crearRutasSLA(slaCtrl));
  app.use('/api/notifications', verificarToken, crearRutasNotificaciones(crearNotificacionesController(servicios.notificaciones)));
  if (comentarios) app.use('/api/v1/tickets', verificarToken, crearRutasComentarios(crearComentariosController(servicios.comentarios)));
};

// servicios: crearServicios() de negocio/ | modulos: { comentarios } (MODULO_COMENTARIOS)
// trustProxy: número de proxies delante (nginx/ALB). Sin él, req.ip es la IP
// del proxy y el rate limit se comparte entre todos los usuarios.
const crearApp = ({ servicios, modulos = {}, origenPermitido, esTest = false, logger = console, trustProxy = 0 }) => {
  const app = express();
  if (trustProxy > 0) app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: origenPermitido, credentials: true }));
  if (!esTest) app.use(morgan('combined'));
  app.use(express.json({ limit: '100kb' }));
  app.use(crearRateLimiter({ deshabilitado: esTest }));

  app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', servicio: 'domain-service' }, message: 'OK' }));
  _montarRutas(app, servicios, crearVerificarToken(servicios.sesion), modulos);
  app.use((req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada', errors: [] }));
  app.use(crearErrorHandler(logger));
  return app;
};

module.exports = { crearApp };
