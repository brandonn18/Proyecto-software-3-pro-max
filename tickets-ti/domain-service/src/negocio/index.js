// Fachada de la capa de NEGOCIO: arma los servicios sobre la capa de datos
// que recibe (DAO e integraciones concretos, sin interfaces de por medio).
const { NotificacionesService } = require('./servicios/notificacionesService');
const { AsignacionService } = require('./servicios/asignacionService');
const { TicketsService } = require('./servicios/ticketsService');
const { CicloDeVidaService } = require('./servicios/cicloDeVidaService');
const { SLAService } = require('./servicios/slaService');
const { ReportesService } = require('./servicios/reportesService');
const { ComentariosService } = require('./servicios/comentariosService');
const { SesionService } = require('./servicios/sesionService');
const { relojDelSistema, loggerPorDefecto } = require('./servicios/apoyo');

// datos: { dao, directorio, correo, tiempoReal } | jwtSecret | reloj? | logger?
const crearServicios = ({ dao, directorio, correo, tiempoReal, jwtSecret, reloj = relojDelSistema, logger = loggerPorDefecto }) => {
  const base = { dao, directorio, correo, tiempoReal, reloj, logger };
  const notificaciones = new NotificacionesService(base);
  const asignacion = new AsignacionService({ ...base, notificaciones });
  return {
    notificaciones,
    asignacion,
    tickets: new TicketsService({ ...base, asignacion, notificaciones }),
    cicloDeVida: new CicloDeVidaService({ ...base, notificaciones }),
    sla: new SLAService({ ...base, notificaciones }),
    reportes: new ReportesService(base),
    comentarios: new ComentariosService(base),
    sesion: new SesionService({ jwtSecret }),
  };
};

module.exports = { crearServicios };
