// Capa de NEGOCIO: asignación de técnicos, automática (CP003) y manual (admin).
const { noEncontrado, ErrorDirectorioNoDisponible } = require('../../comun/errores');
const politicaAsignacion = require('../reglas/politicaAsignacion');
const { cambiosDeAsignacion } = require('../reglas/reglasTicket');
const mensajes = require('../reglas/mensajes');
const { enSegundoPlano, ticketOFallar } = require('./apoyo');

const _esTecnicoActivo = (persona) => Boolean(persona) && persona.rol === 'tecnico' && persona.activo;

class AsignacionService {
  // deps: { dao, directorio, correo, tiempoReal, notificaciones (servicio), logger }
  constructor(deps) {
    this.deps = deps;
  }

  async _tecnicosDisponibles() {
    try {
      return await this.deps.directorio.listarTecnicosActivos();
    } catch (err) {
      if (!(err instanceof ErrorDirectorioNoDisponible)) throw err;
      this.deps.logger.error('[AsignacionService]', 'authcore no disponible; el ticket queda abierto');
      return [];
    }
  }

  _cargasDe(tecnicos, categoria) {
    const { tickets } = this.deps.dao;
    return Promise.all(tecnicos.map(async (tecnico) => ({
      tecnico,
      cargaCategoria: await tickets.contarCargaActiva({ tecnicoId: tecnico.id, categoria }),
      cargaGlobal: await tickets.contarCargaActiva({ tecnicoId: tecnico.id }),
    })));
  }

  // Técnico activo con menor carga. Si no hay técnicos o authcore no responde,
  // devuelve el mismo ticket: crear el ticket nunca falla por la asignación.
  async automatica(ticket) {
    const elegido = politicaAsignacion.elegirTecnico(await this._cargasDe(await this._tecnicosDisponibles(), ticket.categoria));
    if (!elegido) return ticket;
    const asignado = await this.deps.dao.tickets.actualizar(ticket.id, cambiosDeAsignacion(ticket, elegido));
    await this.deps.notificaciones.notificar({
      usuarioId: elegido.id, ticketId: asignado.id, tipo: 'asignacion',
      mensaje: mensajes.asignacionAutomatica(asignado), push: false, // ya avisa ticket:nuevo
    });
    this.deps.tiempoReal.emitirATecnico(elegido.id, 'ticket:nuevo', { ticketId: asignado.id, titulo: asignado.titulo });
    return asignado;
  }

  async manual(ticketId, tecnicoId, actor) {
    const { dao, directorio } = this.deps;
    const ticket = await ticketOFallar(dao.tickets, ticketId);
    const tecnico = await directorio.obtenerUsuario(tecnicoId);
    if (!_esTecnicoActivo(tecnico)) throw noEncontrado('Técnico no encontrado o inactivo');
    const asignado = await dao.tickets.actualizar(ticket.id, cambiosDeAsignacion(ticket, tecnico));
    await this._registrarYAvisar(asignado, tecnico, actor);
    return asignado;
  }

  async _registrarYAvisar(ticket, tecnico, actor) {
    const { dao, notificaciones, correo, logger } = this.deps;
    await dao.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_ASIGNADO', detalle: { tecnicoId: tecnico.id, tecnicoNombre: tecnico.nombre },
    });
    await notificaciones.notificar({
      usuarioId: tecnico.id, ticketId: ticket.id, tipo: 'asignacion', mensaje: mensajes.asignacion(ticket), push: true,
    });
    enSegundoPlano(logger, 'Email asignación', () => correo.enviarTicketAsignado(tecnico, ticket));
  }
}

module.exports = { AsignacionService };
