const ControladorBase = require('./ControladorBase');
const PresentadorJSON = require('./PresentadorJSON');
const GestorDeTickets = require('../../servicios/GestorDeTickets');
const CicloDeVida = require('../../servicios/CicloDeVida');
const AsignadorDeTecnicos = require('../../servicios/AsignadorDeTecnicos');
const { Dependencias } = require('../../servicios/Dependencias');

class ControladorDeTickets extends ControladorBase {
  #gestor;
  #ciclo;
  #asignador;

  constructor(deps) {
    super();
    Dependencias.exigir(deps, { gestor: GestorDeTickets, ciclo: CicloDeVida, asignador: AsignadorDeTecnicos });
    this.#gestor = deps.gestor;
    this.#ciclo = deps.ciclo;
    this.#asignador = deps.asignador;
  }

  #datosSanitizados({ titulo, descripcion, tipo, categoria, prioridad }) {
    return { titulo: this.sanitizar(titulo), descripcion: this.sanitizar(descripcion), tipo, categoria, prioridad };
  }

  listar = this.accion(async (req, res) => {
    const { items, meta } = await this.#gestor.listar(req.query, req.actor);
    this.paginar(res, items.map(PresentadorJSON.ticket), meta);
  });

  obtener = this.accion(async (req, res) => {
    this.responder(res, PresentadorJSON.detalle(await this.#gestor.detalle(req.params.id, req.actor)));
  });

  crear = this.accion(async (req, res) => {
    const ticket = await this.#gestor.abrir(this.#datosSanitizados(req.body), req.actor);
    this.responder(res, PresentadorJSON.ticket(ticket), 'Ticket creado exitosamente', 201);
  });

  cambiarEstado = this.accion(async (req, res) => {
    const { estado, comentario } = req.body;
    const ticket = await this.#ciclo.cambiarEstado(req.params.id, { estado, comentario: this.sanitizar(comentario) }, req.actor);
    this.responder(res, PresentadorJSON.ticket(ticket), 'Estado actualizado');
  });

  actualizar = this.accion(async (req, res) => {
    const cambios = Object.fromEntries(Object.entries(this.#datosSanitizados(req.body)).filter(([, v]) => v !== undefined));
    this.responder(res, PresentadorJSON.ticket(await this.#gestor.actualizarDatos(req.params.id, cambios)), 'Ticket actualizado');
  });

  asignar = this.accion(async (req, res) => {
    const ticket = await this.#asignador.asignarManualmente(req.params.id, Number(req.body.tecnicoId), req.actor);
    this.responder(res, PresentadorJSON.ticket(ticket), 'Ticket asignado');
  });

  reabrir = this.accion(async (req, res) => {
    const ticket = await this.#ciclo.reabrir(req.params.id, this.sanitizar(req.body.motivo_reapertura), req.actor);
    this.responder(res, PresentadorJSON.ticket(ticket), 'Ticket reabierto');
  });

  eliminar = this.accion(async (req, res) => {
    await this.#gestor.eliminar(req.params.id);
    this.responder(res, null, 'Ticket eliminado');
  });
}

module.exports = ControladorDeTickets;
