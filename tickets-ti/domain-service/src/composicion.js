// Raíz de composición: el ÚNICO lugar que conoce a la vez los casos de uso y
// los adaptadores concretos. Los tests la usan con dobles para authcore,
// email, tiempo real y reloj.
const app = require('./application');
const infra = require('./infrastructure');

const _repositorios = (modelos, sequelize) => ({
  ticketRepository: new infra.SequelizeTicketRepository(modelos),
  auditoria: new infra.SequelizeAuditoriaRepository(modelos),
  notificacionRepository: new infra.SequelizeNotificacionRepository(modelos),
  slaConfigRepository: new infra.SequelizeSLAConfigRepository(modelos),
  reportes: new infra.SequelizeReportesQuery(modelos, sequelize),
});

const _casosDeUso = (deps) => {
  const asignarAutomaticamente = new app.AsignarAutomaticamente(deps);
  const conAuto = { ...deps, asignarAutomaticamente };
  return {
    crear: new app.CrearTicket(conAuto),
    asignar: new app.AsignarTicket(deps),
    cambiarEstado: new app.CambiarEstadoTicket(deps),
    reabrir: new app.ReabrirTicket(deps),
    gestionar: new app.GestionarTicket(deps),
    verificarSLA: new app.VerificarSLA(deps),
    reportes: new app.ConsultarReportes(deps),
    publicarEstadisticas: new app.PublicarEstadisticas(deps),
    bandeja: new app.BandejaNotificaciones(deps),
    slaConfig: new app.GestionarSLAConfig(deps),
  };
};

// adaptadores: { userDirectory, email, realtime, clock?, logger? }
const componer = ({ sequelize, modelos, userDirectory, email, realtime, clock = new infra.SystemClock(), logger = console }) => {
  const repos = _repositorios(modelos, sequelize);
  const notificaciones = new infra.NotificacionInAppAdapter({ repositorio: repos.notificacionRepository, realtime });
  const deps = { ...repos, notificaciones, userDirectory, email, realtime, clock, logger };
  return { deps, casos: _casosDeUso(deps) };
};

module.exports = { componer };
