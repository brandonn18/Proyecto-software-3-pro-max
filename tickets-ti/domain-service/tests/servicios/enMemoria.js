// Implementaciones en memoria de los repositorios: extienden las mismas
// interfaces que las de Sequelize, así los servicios se prueban sin base de
// datos (polimorfismo / LSP).
const {
  RepositorioDeTickets, RepositorioDeAuditoria, RepositorioDeNotificaciones, RepositorioDeConfiguracionSLA, RepositorioDeComentarios, ConsultaDeReportes,
} = require('../../src/interfaces');
const { ErrorIdDuplicado } = require('../../src/errores');
const Ticket = require('../../src/entidades/Ticket');
const Notificacion = require('../../src/entidades/Notificacion');
const ConfiguracionSLA = require('../../src/entidades/ConfiguracionSLA');

const IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];

const _cumple = (fila, filtros) => IGUALDAD.every((c) => filtros[c] === undefined || String(fila[c]) === String(filtros[c]))
  && (!filtros.search || `${fila.titulo} ${fila.id}`.toLowerCase().includes(String(filtros.search).toLowerCase()));

// Guarda instantáneas (no las entidades) para que cada lectura devuelva un objeto nuevo
class TicketsEnMemoria extends RepositorioDeTickets {
  constructor(reloj) { super(); this.filas = new Map(); this.eliminados = new Set(); this.reloj = reloj; }

  _vivas() { return [...this.filas.values()].filter((f) => !this.eliminados.has(f.id)); }

  async buscarPorId(id) { return this.eliminados.has(id) || !this.filas.has(id) ? null : Ticket.reconstruir(this.filas.get(id)); }

  async contarDelAnio(anio) { return [...this.filas.keys()].filter((id) => id.startsWith(`TKT-${anio}-`)).length; }

  async guardarNuevo(ticket) {
    if (this.filas.has(ticket.id)) throw new ErrorIdDuplicado(ticket.id);
    const ahora = this.reloj.ahora();
    this.filas.set(ticket.id, { ...ticket.aInstantanea(), createdAt: ahora, updatedAt: ahora });
    return this.buscarPorId(ticket.id);
  }

  async actualizar(ticket) {
    this.filas.set(ticket.id, { ...ticket.aInstantanea(), createdAt: this.filas.get(ticket.id).createdAt, updatedAt: this.reloj.ahora() });
    return this.buscarPorId(ticket.id);
  }

  async eliminar(id) { this.eliminados.add(id); }

  async listar({ filtros = {}, paginacion }) {
    const todas = this._vivas().filter((f) => _cumple(f, filtros)).sort((a, b) => (b.createdAt - a.createdAt) || b.id.localeCompare(a.id));
    return { items: todas.slice(paginacion.offset, paginacion.offset + paginacion.limit).map((f) => Ticket.reconstruir(f)), total: todas.length };
  }

  async contarCargaActiva({ tecnicoId, categoria }) {
    return this._vivas().filter((f) => f.tecnicoId === tecnicoId && (!categoria || f.categoria === categoria) && !['resuelto', 'cerrado'].includes(f.estado)).length;
  }

  async listarPendientesDeAlertaSLA() {
    return this._vivas().map((f) => Ticket.reconstruir(f)).filter((t) => t.estaActivo() && t.tecnico && t.ventanaSLA.limite && !t.alertaSLAEnviada);
  }

  // Helper de test: siembra una fila tal cual, sin pasar por el servicio
  sembrar(fila) {
    const base = { titulo: 'Sembrado', descripcion: 'x', tipo: 'incidente', categoria: 'hardware', prioridad: 'media', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis Usuario', tecnicoId: null, tecnico_nombre: null, reabierto: false, motivo_reapertura: null, sla_limite: this.reloj.ahora(), sla_alerta_enviada: false };
    this.filas.set(fila.id, { ...base, createdAt: this.reloj.ahora(), ...fila });
  }
}

class AuditoriaEnMemoria extends RepositorioDeAuditoria {
  constructor() { super(); this.eventos = []; }

  async registrar(evento) { this.eventos.push(evento); }

  async listarPorTicket(ticketId) { return this.eventos.filter((e) => e.ticketId === ticketId); }

  de(accion) { return this.eventos.filter((e) => e.accion === accion); }
}

class NotificacionesEnMemoria extends RepositorioDeNotificaciones {
  constructor() { super(); this.filas = []; }

  async guardar(datos) {
    const fila = { id: this.filas.length + 1, leida: false, createdAt: null, ...datos };
    this.filas.push(fila);
    return new Notificacion(fila);
  }

  async listarDe(usuarioId, { tipo, paginacion }) {
    const propias = this.filas.filter((n) => n.usuarioId === usuarioId && (!tipo || n.tipo === tipo));
    return { items: propias.slice(paginacion.offset, paginacion.offset + paginacion.limit).map((n) => new Notificacion(n)), total: propias.length };
  }

  async contarNoLeidas(usuarioId) { return this.filas.filter((n) => n.usuarioId === usuarioId && !n.leida).length; }

  async marcarLeida(id, usuarioId) {
    const fila = this.filas.find((n) => n.id === Number(id) && n.usuarioId === usuarioId);
    if (!fila) return null;
    fila.leida = true;
    return new Notificacion(fila);
  }

  async marcarTodasLeidas(usuarioId) { this.filas.filter((n) => n.usuarioId === usuarioId).forEach((n) => { n.leida = true; }); }

  para(usuarioId) { return this.filas.filter((n) => n.usuarioId === usuarioId); }
}

class ConfiguracionSLAEnMemoria extends RepositorioDeConfiguracionSLA {
  constructor(filas = []) { super(); this.filas = filas.map((f, i) => ({ id: i + 1, porcentaje_alerta: 80, ...f })); }

  async obtenerPorPrioridad(prioridad) { const f = this.filas.find((x) => x.prioridad === prioridad); return f ? new ConfiguracionSLA(f) : null; }

  async buscarPorId(id) { const f = this.filas.find((x) => x.id === Number(id)); return f ? new ConfiguracionSLA(f) : null; }

  async listar() { return [...this.filas].sort((a, b) => a.tiempo_horas - b.tiempo_horas).map((f) => new ConfiguracionSLA(f)); }

  async guardar(configuracion) {
    Object.assign(this.filas.find((x) => x.id === configuracion.id), configuracion.aJSON());
    return this.buscarPorId(configuracion.id);
  }
}

class ComentariosEnMemoria extends RepositorioDeComentarios {
  constructor() { super(); this.guardados = []; }

  async guardar(comentario) {
    const guardado = comentario.persistido(this.guardados.length + 1, new Date(0));
    this.guardados.push(guardado);
    return guardado;
  }

  async listarPorTicket(ticketId) { return this.guardados.filter((c) => c.ticketId === ticketId); }
}

// Espía: cada método de la interfaz responde lo que se le indique
class ConsultaDeReportesEspia extends ConsultaDeReportes {
  constructor(respuestas = {}) {
    super();
    ['conteosGenerales', 'ticketsPorPeriodo', 'metricasTecnico', 'cumplimientoSLA', 'dashboardTecnico', 'resumenUsuario',
      'resumenGeneral', 'estadoSLA', 'conteoPorTecnico', 'estadisticasTiempoReal'].forEach((m) => { this[m] = jest.fn().mockResolvedValue(respuestas[m]); });
  }
}

module.exports = {
  TicketsEnMemoria, AuditoriaEnMemoria, NotificacionesEnMemoria, ConfiguracionSLAEnMemoria, ComentariosEnMemoria, ConsultaDeReportesEspia,
};
