// Entidad Ticket: todo su estado es privado (#) y solo cambia a través de sus
// métodos, que hacen cumplir las reglas. Se compone de objetos de valor
// (IdTicket, DatosDeTicket, VentanaSLA) y de un EstadoDeTicket (patrón State).
const { ErrorDeValidacion, ErrorDeTransicion } = require('../errores');
const IdTicket = require('../valores/IdTicket');
const DatosDeTicket = require('../valores/DatosDeTicket');
const VentanaSLA = require('../valores/VentanaSLA');
const { EstadoDeTicket, Abierto, Asignado } = require('./estados');

// Snapshot { id, nombre } de una persona: se guarda para no consultar authcore después
const _snapshot = (persona, rol) => {
  if (!persona || !Number.isInteger(persona.id)) throw new ErrorDeValidacion(`${rol} inválido`);
  if (typeof persona.nombre !== 'string' || !persona.nombre.trim()) throw new ErrorDeValidacion(`Nombre del ${rol.toLowerCase()} requerido`);
  return Object.freeze({ id: persona.id, nombre: persona.nombre });
};

class Ticket {
  #id;
  #datos;
  #estado;
  #solicitante;
  #tecnico;
  #reabierto;
  #motivoReapertura;
  #ventanaSLA;
  #alertaSLAEnviada;
  #creadoEn;
  #actualizadoEn;

  // Privado en la práctica: usar Ticket.abrir() o Ticket.reconstruir()
  constructor(props) {
    this.#id = props.id;
    this.#datos = props.datos;
    this.#estado = props.estado;
    this.#solicitante = props.solicitante;
    this.#tecnico = props.tecnico;
    this.#reabierto = props.reabierto;
    this.#motivoReapertura = props.motivoReapertura;
    this.#ventanaSLA = props.ventanaSLA;
    this.#alertaSLAEnviada = props.alertaSLAEnviada;
    this.#creadoEn = props.creadoEn;
    this.#actualizadoEn = props.actualizadoEn;
  }

  // CP001: id IdTicket | datos DatosDeTicket | solicitante Actor | ventanaSLA VentanaSLA
  static abrir({ id, datos, solicitante, ventanaSLA }) {
    if (!(id instanceof IdTicket) || !(datos instanceof DatosDeTicket)) throw new TypeError('Ticket.abrir requiere IdTicket y DatosDeTicket');
    return new Ticket({
      id, datos, estado: new Abierto(), solicitante: _snapshot(solicitante, 'Usuario'), tecnico: null,
      reabierto: false, motivoReapertura: null, ventanaSLA, alertaSLAEnviada: false, creadoEn: null, actualizadoEn: null,
    });
  }

  // fila: lo que guarda la persistencia (misma forma que aInstantanea())
  static reconstruir(fila) {
    return new Ticket({
      id: new IdTicket(fila.id),
      datos: new DatosDeTicket(fila),
      estado: EstadoDeTicket.desde(fila.estado),
      solicitante: Object.freeze({ id: fila.usuarioId, nombre: fila.usuario_nombre }),
      tecnico: fila.tecnicoId ? Object.freeze({ id: fila.tecnicoId, nombre: fila.tecnico_nombre }) : null,
      reabierto: fila.reabierto, motivoReapertura: fila.motivo_reapertura,
      ventanaSLA: new VentanaSLA(fila.sla_limite), alertaSLAEnviada: fila.sla_alerta_enviada,
      creadoEn: fila.createdAt, actualizadoEn: fila.updatedAt,
    });
  }

  get id() { return this.#id.toString(); }

  get titulo() { return this.#datos.titulo; }

  get categoria() { return this.#datos.categoria; }

  get prioridad() { return this.#datos.prioridad; }

  get estado() { return this.#estado; }

  get solicitante() { return this.#solicitante; }

  get tecnico() { return this.#tecnico; }

  get ventanaSLA() { return this.#ventanaSLA; }

  get alertaSLAEnviada() { return this.#alertaSLAEnviada; }

  estaActivo() { return !this.#estado.esFinal(); }

  admiteComentarios() { return this.#estado.permiteComentar(); }

  asignarA(persona) {
    const tecnico = _snapshot(persona, 'Técnico');
    if (!this.#estado.permiteAsignar()) throw new ErrorDeTransicion(`No se puede asignar un ticket ${this.#estado}`);
    this.#tecnico = tecnico;
    this.#estado = new Asignado();
  }

  // CP004 / CP012: el estado actual decide si la transición vale
  cambiarEstadoA(nombre) {
    this.#estado = this.#estado.transicionarA(nombre);
  }

  // CP005: reinicia el SLA con la ventana nueva
  reabrir(motivo, ventanaSLA) {
    if (!this.#estado.permiteReabrir()) throw new ErrorDeTransicion('Solo se pueden reabrir tickets resueltos o cerrados');
    if (typeof motivo !== 'string' || !motivo.trim()) throw new ErrorDeValidacion('Motivo de reapertura requerido');
    this.#estado = new Abierto();
    this.#reabierto = true;
    this.#motivoReapertura = motivo;
    this.#ventanaSLA = ventanaSLA;
    this.#alertaSLAEnviada = false;
  }

  // Solo título, descripción, tipo, categoría y prioridad: el estado y el
  // técnico cambian por cambiarEstadoA y asignarA, nunca por edición directa.
  actualizarDatos(cambios) {
    this.#datos = this.#datos.con(cambios);
  }

  // CP010 → { porcentaje, vencido, alertar }
  evaluarSLA(ahora, horas, porcentajeAlerta = VentanaSLA.porcentajeAlertaPorDefecto) {
    const porcentaje = this.#ventanaSLA.porcentajeConsumido(ahora, horas);
    const alertar = this.estaActivo() && Boolean(this.#tecnico) && !this.#alertaSLAEnviada && porcentaje >= porcentajeAlerta;
    return { porcentaje, vencido: this.#ventanaSLA.vencidaEn(ahora), alertar };
  }

  marcarAlertaSLAEnviada() {
    this.#alertaSLAEnviada = true;
  }

  // Vista plana del estado: la usan la persistencia, el email y el presentador HTTP
  aInstantanea() {
    return {
      id: this.id, ...this.#datos.aObjeto(), estado: this.#estado.nombre,
      usuarioId: this.#solicitante.id, usuario_nombre: this.#solicitante.nombre,
      tecnicoId: this.#tecnico?.id ?? null, tecnico_nombre: this.#tecnico?.nombre ?? null,
      reabierto: this.#reabierto, motivo_reapertura: this.#motivoReapertura,
      sla_limite: this.#ventanaSLA.limite, sla_alerta_enviada: this.#alertaSLAEnviada,
      createdAt: this.#creadoEn, updatedAt: this.#actualizadoEn,
    };
  }
}

module.exports = Ticket;
