// CONTROLADOR de tickets: lee la petición, llama al modelo Ticket y elige la
// vista. No contiene reglas de negocio ni consultas.
const { manejar, sanitizarTexto } = require('./apoyo');
const respuesta = require('../views/respuesta');
const ticketView = require('../views/ticketView');

const _datosSanitizados = ({ titulo, descripcion, tipo, categoria, prioridad }) => ({
  titulo: sanitizarTexto(titulo), descripcion: sanitizarTexto(descripcion), tipo, categoria, prioridad,
});

const _sinIndefinidos = (objeto) => Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined));

// modelos: los de models/index.js (usa Ticket)
const crearTicketsController = ({ Ticket }) => ({
  listar: manejar(async (req, res) => {
    const pagina = await Ticket.listarPara(req.actor, req.query);
    res.json(respuesta.paginado(pagina.items.map(ticketView.ticket), pagina));
  }),

  obtener: manejar(async (req, res) => {
    const ticket = await Ticket.buscarOFallar(req.params.id);
    ticket.exigirVer(req.actor);
    res.json(respuesta.exito(ticketView.detalle(ticket, await ticket.historial())));
  }),

  crear: manejar(async (req, res) => {
    const ticket = await Ticket.abrir(_datosSanitizados(req.body), req.actor);
    res.status(201).json(respuesta.exito(ticketView.ticket(ticket), 'Ticket creado exitosamente'));
  }),

  cambiarEstado: manejar(async (req, res) => {
    const ticket = await Ticket.buscarOFallar(req.params.id);
    await ticket.cambiarEstado(req.body.estado, sanitizarTexto(req.body.comentario), req.actor);
    res.json(respuesta.exito(ticketView.ticket(ticket), 'Estado actualizado'));
  }),

  actualizar: manejar(async (req, res) => {
    const ticket = await Ticket.buscarOFallar(req.params.id);
    await ticket.actualizarDatos(_sinIndefinidos(_datosSanitizados(req.body)));
    res.json(respuesta.exito(ticketView.ticket(ticket), 'Ticket actualizado'));
  }),

  asignar: manejar(async (req, res) => {
    const ticket = await Ticket.buscarOFallar(req.params.id);
    await ticket.asignarManual(Number(req.body.tecnicoId), req.actor);
    res.json(respuesta.exito(ticketView.ticket(ticket), 'Ticket asignado'));
  }),

  reabrir: manejar(async (req, res) => {
    const ticket = await Ticket.buscarOFallar(req.params.id);
    await ticket.reabrir(sanitizarTexto(req.body.motivo_reapertura), req.actor);
    res.json(respuesta.exito(ticketView.ticket(ticket), 'Ticket reabierto'));
  }),

  // Borrado lógico (paranoid)
  eliminar: manejar(async (req, res) => {
    await (await Ticket.buscarOFallar(req.params.id)).destroy();
    res.json(respuesta.exito(null, 'Ticket eliminado'));
  }),
});

module.exports = { crearTicketsController };
