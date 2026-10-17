// Servicio MonitorDeSLA (CP010): lo dispara el cron cada 15 min. Alerta al
// técnico cuando un ticket activo consumió el porcentaje configurado de su SLA.
const {
  RepositorioDeTickets, RepositorioDeConfiguracionSLA, CanalEnTiempoReal, ServicioDeCorreo, DirectorioDeUsuarios, Reloj,
} = require('../interfaces');
const Notificador = require('./Notificador');
const MensajesDeNotificacion = require('./MensajesDeNotificacion');
const { Dependencias, TareasEnSegundoPlano } = require('./Dependencias');

class MonitorDeSLA {
  #deps;
  #segundoPlano;

  // deps: { tickets, configuracionSLA, notificador, canal, correo, directorio, reloj, logger? }
  constructor(deps) {
    this.#deps = Dependencias.exigir(deps, {
      tickets: RepositorioDeTickets, configuracionSLA: RepositorioDeConfiguracionSLA, notificador: Notificador,
      canal: CanalEnTiempoReal, correo: ServicioDeCorreo, directorio: DirectorioDeUsuarios, reloj: Reloj,
    });
    this.#segundoPlano = new TareasEnSegundoPlano(deps.logger);
  }

  // Devuelve cuántas alertas se generaron
  async verificar() {
    const ahora = this.#deps.reloj.ahora();
    const configuraciones = new Map();
    let alertas = 0;
    for (const ticket of await this.#deps.tickets.listarPendientesDeAlertaSLA()) {
      const configuracion = await this.#configuracionDe(ticket.prioridad.nombre, configuraciones);
      const { porcentaje, alertar } = ticket.evaluarSLA(ahora, ticket.prioridad.horasDeSLA(configuracion), configuracion?.porcentajeAlerta);
      if (alertar) {
        await this.#alertar(ticket, porcentaje);
        alertas++;
      }
    }
    return alertas;
  }

  async #configuracionDe(prioridad, cache) {
    if (!cache.has(prioridad)) cache.set(prioridad, await this.#deps.configuracionSLA.obtenerPorPrioridad(prioridad));
    return cache.get(prioridad);
  }

  async #alertar(ticket, porcentaje) {
    const { notificador, canal, directorio, correo, tickets } = this.#deps;
    const tecnicoId = ticket.tecnico.id;
    const datos = { ticketId: ticket.id, porcentaje: Math.round(porcentaje) };
    await notificador.notificar({ usuarioId: tecnicoId, ticketId: ticket.id, tipo: 'sla_alerta', mensaje: MensajesDeNotificacion.alertaSLA(ticket, porcentaje), push: true });
    this.#segundoPlano.lanzar('Email SLA', async () => {
      const tecnico = await directorio.obtenerUsuario(tecnicoId);
      if (tecnico) await correo.enviarAlertaSLA(tecnico, ticket, porcentaje);
    });
    canal.emitirATecnico(tecnicoId, 'ticket:sla_alerta', datos);
    canal.emitirAAdmins('ticket:sla_alerta', datos);
    ticket.marcarAlertaSLAEnviada();
    await tickets.actualizar(ticket);
  }
}

module.exports = MonitorDeSLA;
