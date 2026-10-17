// Objeto raíz: el ÚNICO que instancia clases concretas y las conecta
// (composición e inyección de dependencias). Los tests lo construyen con
// dobles del directorio, el correo, el canal en tiempo real y el reloj.
const RepositorioDeTicketsSequelize = require('./infraestructura/persistencia/RepositorioDeTicketsSequelize');
const RepositorioDeAuditoriaSequelize = require('./infraestructura/persistencia/RepositorioDeAuditoriaSequelize');
const RepositorioDeNotificacionesSequelize = require('./infraestructura/persistencia/RepositorioDeNotificacionesSequelize');
const RepositorioDeConfiguracionSLASequelize = require('./infraestructura/persistencia/RepositorioDeConfiguracionSLASequelize');
const RepositorioDeComentariosSequelize = require('./infraestructura/persistencia/RepositorioDeComentariosSequelize');
const ConsultaDeReportesSequelize = require('./infraestructura/persistencia/ConsultaDeReportesSequelize');
const RelojDelSistema = require('./infraestructura/RelojDelSistema');
const VerificadorDeTokens = require('./infraestructura/authcore/VerificadorDeTokens');
const AplicacionHttp = require('./infraestructura/http/AplicacionHttp');
const ProgramadorDeTareas = require('./infraestructura/ProgramadorDeTareas');
const Notificador = require('./servicios/Notificador');
const EstrategiaMenorCarga = require('./servicios/EstrategiaMenorCarga');
const AsignadorDeTecnicos = require('./servicios/AsignadorDeTecnicos');
const GestorDeTickets = require('./servicios/GestorDeTickets');
const CicloDeVida = require('./servicios/CicloDeVida');
const MonitorDeSLA = require('./servicios/MonitorDeSLA');
const GestorDeConfiguracionSLA = require('./servicios/GestorDeConfiguracionSLA');
const GeneradorDeReportes = require('./servicios/GeneradorDeReportes');
const GestorDeComentarios = require('./servicios/GestorDeComentarios');

class Aplicacion {
  #servicios;
  #logger;

  // modelos: Sequelize de infraestructura | directorio, correo, canal, reloj?: implementaciones de las interfaces
  // repositorios?: otras implementaciones de las interfaces de persistencia (los tests pasan unas en memoria)
  constructor({ sequelize, modelos, repositorios, directorio, correo, canal, reloj = new RelojDelSistema(), logger = console }) {
    this.#logger = logger;
    const repos = repositorios ?? Aplicacion.#repositorios(modelos, sequelize);
    const notificador = new Notificador({ repositorio: repos.notificaciones, canal });
    const base = { tickets: repos.tickets, directorio, correo, canal, reloj, logger, notificador, auditoria: repos.auditoria, configuracionSLA: repos.configuracionSLA };
    const asignador = new AsignadorDeTecnicos({ ...base, estrategia: new EstrategiaMenorCarga() });
    this.#servicios = Object.freeze({
      notificador,
      asignador,
      tickets: new GestorDeTickets({ ...base, asignador }),
      cicloDeVida: new CicloDeVida(base),
      monitorSLA: new MonitorDeSLA(base),
      configuracionSLA: new GestorDeConfiguracionSLA({ repositorio: repos.configuracionSLA }),
      reportes: new GeneradorDeReportes({ consulta: repos.reportes, directorio, canal, reloj }),
      comentarios: new GestorDeComentarios({ tickets: repos.tickets, comentarios: repos.comentarios }),
    });
  }

  static #repositorios(modelos, sequelize) {
    return {
      tickets: new RepositorioDeTicketsSequelize(modelos),
      auditoria: new RepositorioDeAuditoriaSequelize(modelos),
      notificaciones: new RepositorioDeNotificacionesSequelize(modelos),
      configuracionSLA: new RepositorioDeConfiguracionSLASequelize(modelos),
      comentarios: new RepositorioDeComentariosSequelize(modelos),
      reportes: new ConsultaDeReportesSequelize(modelos, sequelize),
    };
  }

  get servicios() { return this.#servicios; }

  // opciones: { jwtSecret, modulos?, origenPermitido, esTest?, trustProxy? } → app de Express
  crearHttp({ jwtSecret, ...opciones }) {
    return new AplicacionHttp({ ...opciones, servicios: this.#servicios, verificador: new VerificadorDeTokens(jwtSecret), logger: this.#logger }).construir();
  }

  crearProgramador({ cron } = {}) {
    const tareas = {
      verificarSLA: () => this.#servicios.monitorSLA.verificar(),
      publicarEstadisticas: () => this.#servicios.reportes.publicarEstadisticas(),
    };
    return new ProgramadorDeTareas({ tareas, logger: this.#logger, cron });
  }
}

module.exports = Aplicacion;
