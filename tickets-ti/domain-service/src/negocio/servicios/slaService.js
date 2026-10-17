// Capa de NEGOCIO: verificación periódica del SLA (CP010) y su configuración.
const { noEncontrado, errorValidacion } = require('../../comun/errores');
const politicaSLA = require('../reglas/politicaSLA');
const mensajes = require('../reglas/mensajes');
const { enSegundoPlano } = require('./apoyo');

const _enteroEnRango = (valor, campo, min, max) => {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw errorValidacion(`${campo} debe ser un entero entre ${min} y ${max}`);
  }
  return valor;
};

// Solo tiempo_horas y porcentaje_alerta son editables; la prioridad de una
// configuración no cambia (en el monolito se podía vía req.body).
const _cambiosPermitidos = ({ tiempo_horas, porcentaje_alerta }) => {
  const cambios = {};
  if (tiempo_horas !== undefined) cambios.tiempo_horas = _enteroEnRango(tiempo_horas, 'tiempo_horas', 1, 8760);
  if (porcentaje_alerta !== undefined) cambios.porcentaje_alerta = _enteroEnRango(porcentaje_alerta, 'porcentaje_alerta', 1, 100);
  return cambios;
};

class SLAService {
  // deps: { dao, directorio, correo, tiempoReal, notificaciones (servicio), reloj, logger }
  constructor(deps) {
    this.deps = deps;
    this.dao = deps.dao;
  }

  // Lo dispara el cron cada 15 min. Devuelve cuántas alertas se generaron
  async verificar() {
    const ahora = this.deps.reloj.ahora();
    const configs = new Map();
    let alertas = 0;
    for (const ticket of await this.dao.tickets.listarPendientesDeAlertaSLA()) {
      const config = await this._configDe(ticket.prioridad, configs);
      const { porcentaje, alertar } = politicaSLA.evaluar(ticket, {
        ahora, horas: politicaSLA.horasPara(ticket.prioridad, config), porcentajeAlerta: config?.porcentaje_alerta,
      });
      if (alertar) {
        await this._alertar(ticket, porcentaje);
        alertas++;
      }
    }
    return alertas;
  }

  async _configDe(prioridad, cache) {
    if (!cache.has(prioridad)) cache.set(prioridad, await this.dao.slaConfig.obtenerPorPrioridad(prioridad));
    return cache.get(prioridad);
  }

  async _alertar(ticket, porcentaje) {
    const { notificaciones, tiempoReal, correo, directorio, logger } = this.deps;
    const redondeado = Math.round(porcentaje);
    await notificaciones.notificar({
      usuarioId: ticket.tecnicoId, ticketId: ticket.id, tipo: 'sla_alerta', mensaje: mensajes.alertaSLA(ticket, porcentaje), push: true,
    });
    enSegundoPlano(logger, 'Email SLA', async () => {
      const tecnico = await directorio.obtenerUsuario(ticket.tecnicoId);
      if (tecnico) await correo.enviarAlertaSLA(tecnico, ticket, porcentaje);
    });
    tiempoReal.emitirATecnico(ticket.tecnicoId, 'ticket:sla_alerta', { ticketId: ticket.id, porcentaje: redondeado });
    tiempoReal.emitirAAdmins('ticket:sla_alerta', { ticketId: ticket.id, porcentaje: redondeado });
    await this.dao.tickets.actualizar(ticket.id, { sla_alerta_enviada: true });
  }

  listarConfig() {
    return this.dao.slaConfig.listar();
  }

  async actualizarConfig(id, datos) {
    const config = await this.dao.slaConfig.actualizar(id, _cambiosPermitidos(datos));
    if (!config) throw noEncontrado('Configuración SLA no encontrada');
    return config;
  }
}

module.exports = { SLAService };
