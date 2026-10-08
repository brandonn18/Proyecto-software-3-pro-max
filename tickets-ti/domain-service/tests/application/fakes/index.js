// Dobles en memoria de los puertos. Sin base de datos, sin red, sin sockets.
const ports = require('../../../src/application/ports');
const { ErrorDirectorioNoDisponible } = require('../../../src/application/errores');
const TicketRepositoryEnMemoria = require('./TicketRepositoryEnMemoria');

class RelojFijo extends ports.Clock {
  constructor(fecha = new Date('2026-10-08T12:00:00.000Z')) { super(); this.fecha = fecha; }

  ahora() { return new Date(this.fecha); }

  avanzarHoras(horas) { this.fecha = new Date(this.fecha.getTime() + horas * 60 * 60 * 1000); }
}

class AuditoriaEnMemoria extends ports.AuditoriaRepository {
  constructor() { super(); this.registros = []; }

  async registrar({ ticketId, actor, accion, detalle }) {
    this.registros.push({ id: this.registros.length + 1, ticketId, accion, detalle, usuario: actor ? { id: actor.id, nombre: actor.nombre } : null });
  }

  async listarPorTicket(ticketId) { return this.registros.filter((r) => r.ticketId === ticketId); }

  de(accion) { return this.registros.filter((r) => r.accion === accion); }
}

// Implementa NotificationPort (entrega) y NotificacionRepository (bandeja) sobre la misma lista
class NotificacionesEnMemoria extends ports.NotificationPort {
  constructor() { super(); this.enviadas = []; }

  async notificar(n) { this.enviadas.push({ id: this.enviadas.length + 1, leida: false, ...n }); }

  async listarDe(usuarioId, { tipo, page, limit }) {
    const propias = this.enviadas.filter((n) => n.usuarioId === usuarioId && (!tipo || n.tipo === tipo));
    return { items: propias.slice((page - 1) * limit, page * limit), total: propias.length };
  }

  async contarNoLeidas(usuarioId) { return this.enviadas.filter((n) => n.usuarioId === usuarioId && !n.leida).length; }

  async marcarLeida(id, usuarioId) {
    const n = this.enviadas.find((x) => x.id === Number(id) && x.usuarioId === usuarioId);
    if (n) n.leida = true;
    return n || null;
  }

  async marcarTodasLeidas(usuarioId) { this.enviadas.filter((n) => n.usuarioId === usuarioId).forEach((n) => { n.leida = true; }); }

  para(usuarioId) { return this.enviadas.filter((n) => n.usuarioId === usuarioId); }
}

class RealtimeEspia extends ports.RealtimePort {
  constructor() { super(); this.eventos = []; }

  emitirAUsuario(id, evento, datos) { this.eventos.push({ destino: `usuario:${id}`, evento, datos }); }

  emitirATecnico(id, evento, datos) { this.eventos.push({ destino: `tecnico:${id}`, evento, datos }); }

  emitirAAdmins(evento, datos) { this.eventos.push({ destino: 'admins', evento, datos }); }
}

class EmailEspia extends ports.EmailPort {
  constructor() {
    super();
    this.enviarTicketAsignado = jest.fn().mockResolvedValue();
    this.enviarTicketResuelto = jest.fn().mockResolvedValue();
    this.enviarAlertaSLA = jest.fn().mockResolvedValue();
  }
}

class DirectorioEnMemoria extends ports.UserDirectoryPort {
  constructor(usuarios = []) { super(); this.usuarios = usuarios; this.caido = false; }

  _verificar() { if (this.caido) throw new ErrorDirectorioNoDisponible(new Error('ECONNREFUSED')); }

  async obtenerUsuario(id) { this._verificar(); return this.usuarios.find((u) => u.id === Number(id)) || null; }

  async listarTecnicosActivos() {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && u.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(({ id, nombre, email }) => ({ id, nombre, email }));
  }

  async listarTecnicos({ incluirInactivos = false } = {}) {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && (incluirInactivos || u.activo));
  }
}

class SLAConfigEnMemoria extends ports.SLAConfigRepository {
  constructor(configs = []) { super(); this.configs = configs.map((c, i) => ({ id: i + 1, porcentaje_alerta: 80, ...c })); }

  async obtenerPorPrioridad(prioridad) { return this.configs.find((c) => c.prioridad === prioridad) || null; }

  async listar() { return [...this.configs].sort((a, b) => a.tiempo_horas - b.tiempo_horas); }

  async actualizar(id, cambios) {
    const c = this.configs.find((x) => x.id === Number(id));
    if (!c) return null;
    Object.assign(c, cambios);
    return c;
  }
}

const crearReportesEspia = (respuestas = {}) => {
  const espia = Object.fromEntries(ports.ReportesQueryPort.metodos.map((m) => [m, jest.fn().mockResolvedValue(respuestas[m])]));
  return espia;
};

module.exports = {
  TicketRepositoryEnMemoria, RelojFijo, AuditoriaEnMemoria, NotificacionesEnMemoria, RealtimeEspia,
  EmailEspia, DirectorioEnMemoria, SLAConfigEnMemoria, crearReportesEspia,
};
