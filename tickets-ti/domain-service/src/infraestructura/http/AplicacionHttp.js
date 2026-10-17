// Aplicación Express armada como objeto: recibe los servicios ya construidos y
// crea un controlador por recurso. No conoce Sequelize ni authcore.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const Autenticacion = require('./Autenticacion');
const ManejadorDeErrores = require('./ManejadorDeErrores');
const LimitadorDePeticiones = require('./LimitadorDePeticiones');
const PresentadorJSON = require('./PresentadorJSON');
const ControladorDeTickets = require('./ControladorDeTickets');
const ControladorDeReportes = require('./ControladorDeReportes');
const ControladorDeNotificaciones = require('./ControladorDeNotificaciones');
const ControladorDeSLA = require('./ControladorDeSLA');
const ControladorDeComentarios = require('./ControladorDeComentarios');
const RutasDeTickets = require('./rutas/RutasDeTickets');
const RutasDeReportes = require('./rutas/RutasDeReportes');
const RutasDeNotificaciones = require('./rutas/RutasDeNotificaciones');
const RutasDeComentarios = require('./rutas/RutasDeComentarios');

class AplicacionHttp {
  #opciones;

  // servicios: Aplicacion#servicios | verificador: VerificadorDeTokens | modulos: { comentarios? }
  // trustProxy: número de proxies delante (nginx/ALB). Sin él, req.ip es la IP
  // del proxy y el rate limit se comparte entre todos los usuarios.
  constructor({ servicios, verificador, modulos = {}, origenPermitido, esTest = false, logger = console, trustProxy = 0 }) {
    this.#opciones = { servicios, verificador, modulos, origenPermitido, esTest, logger, trustProxy };
  }

  #montarRutas(app, verificarToken) {
    const { servicios, modulos } = this.#opciones;
    const sla = new ControladorDeSLA(servicios.configuracionSLA);
    const tickets = new ControladorDeTickets({ gestor: servicios.tickets, ciclo: servicios.cicloDeVida, asignador: servicios.asignador });
    app.use('/api/tickets', verificarToken, RutasDeTickets.crear(tickets));
    app.use('/api/reports', verificarToken, RutasDeReportes.crear(new ControladorDeReportes(servicios.reportes), sla));
    app.use('/api/sla', verificarToken, RutasDeReportes.crearSLA(sla));
    app.use('/api/notifications', verificarToken, RutasDeNotificaciones.crear(new ControladorDeNotificaciones(servicios.notificador)));
    if (modulos.comentarios) app.use('/api/v1/tickets', verificarToken, RutasDeComentarios.crear(new ControladorDeComentarios(servicios.comentarios)));
  }

  construir() {
    const { verificador, origenPermitido, esTest, logger, trustProxy } = this.#opciones;
    const app = express();
    if (trustProxy > 0) app.set('trust proxy', trustProxy);
    app.use(helmet());
    app.use(cors({ origin: origenPermitido, credentials: true }));
    if (!esTest) app.use(morgan('combined'));
    app.use(express.json({ limit: '100kb' }));
    app.use(LimitadorDePeticiones.crear({ deshabilitado: esTest }));
    app.get('/api/health', (req, res) => res.json(PresentadorJSON.exito({ status: 'ok', servicio: 'domain-service' })));
    this.#montarRutas(app, new Autenticacion(verificador).verificarToken);
    app.use((req, res) => res.status(404).json(PresentadorJSON.error('Ruta no encontrada')));
    app.use(new ManejadorDeErrores(logger).middleware);
    return app;
  }
}

module.exports = AplicacionHttp;
