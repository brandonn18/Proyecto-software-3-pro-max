const { politicaAsignacion } = require('../../domain');
const { TicketRepository, UserDirectoryPort, NotificationPort, RealtimePort } = require('../ports');
const { requerirDependencias, loggerPorDefecto } = require('../dependencias');
const { ErrorDirectorioNoDisponible } = require('../errores');
const mensajes = require('../mensajes');

// CP003: asigna al técnico activo con menor carga en la categoría.
class AsignarAutomaticamente {
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      userDirectory: UserDirectoryPort,
      notificaciones: NotificationPort,
      realtime: RealtimePort,
    });
    this.deps = { logger: loggerPorDefecto, ...deps };
  }

  // Devuelve el ticket asignado, o el mismo ticket si no hay técnicos o
  // authcore no responde: crear el ticket nunca falla por la asignación.
  async ejecutar(ticket) {
    const tecnicos = await this._tecnicosDisponibles();
    const elegido = politicaAsignacion.elegirTecnico(await this._cargasDe(tecnicos, ticket.categoria));
    if (!elegido) return ticket;

    const asignado = await this.deps.ticketRepository.actualizar(ticket.asignarA(elegido));
    await this.deps.notificaciones.notificar({
      usuarioId: elegido.id, ticketId: asignado.id, tipo: 'asignacion', mensaje: mensajes.asignacionAutomatica(asignado),
    });
    this.deps.realtime.emitirATecnico(elegido.id, 'ticket:nuevo', { ticketId: asignado.id, titulo: asignado.titulo });
    return asignado;
  }

  async _tecnicosDisponibles() {
    try {
      return await this.deps.userDirectory.listarTecnicosActivos();
    } catch (err) {
      if (!(err instanceof ErrorDirectorioNoDisponible)) throw err;
      this.deps.logger.error('[AsignarAutomaticamente]', 'authcore no disponible; el ticket queda abierto');
      return [];
    }
  }

  _cargasDe(tecnicos, categoria) {
    const { ticketRepository } = this.deps;
    return Promise.all(tecnicos.map(async (tecnico) => ({
      tecnico,
      cargaCategoria: await ticketRepository.contarCargaActiva({ tecnicoId: tecnico.id, categoria }),
      cargaGlobal: await ticketRepository.contarCargaActiva({ tecnicoId: tecnico.id }),
    })));
  }
}

module.exports = AsignarAutomaticamente;
