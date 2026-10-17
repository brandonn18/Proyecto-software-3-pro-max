// Capa de PRESENTACIÓN: traduce HTTP ↔ servicios de negocio de tickets.
const { manejar, ok, paginado } = require('./responder');
const { sanitizarTexto, presentarTicket, presentarDetalle } = require('../formato');

const _datosSanitizados = ({ titulo, descripcion, tipo, categoria, prioridad }) => ({
  titulo: sanitizarTexto(titulo), descripcion: sanitizarTexto(descripcion), tipo, categoria, prioridad,
});

// servicios: { tickets, asignacion, cicloDeVida }
const crearTicketsController = ({ tickets, asignacion, cicloDeVida }) => ({
  listar: manejar(async (req, res) => {
    const { items, meta } = await tickets.listar(req.query, req.actor);
    paginado(res, { items: items.map(presentarTicket), meta });
  }),

  obtener: manejar(async (req, res) => {
    ok(res, presentarDetalle(await tickets.obtener(req.params.id, req.actor)));
  }),

  crear: manejar(async (req, res) => {
    const ticket = await tickets.crear(_datosSanitizados(req.body), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket creado exitosamente', 201);
  }),

  cambiarEstado: manejar(async (req, res) => {
    const { estado, comentario } = req.body;
    const ticket = await cicloDeVida.cambiarEstado(req.params.id, { estado, comentario: sanitizarTexto(comentario) }, req.actor);
    ok(res, presentarTicket(ticket), 'Estado actualizado');
  }),

  actualizar: manejar(async (req, res) => {
    const cambios = Object.fromEntries(Object.entries(_datosSanitizados(req.body)).filter(([, v]) => v !== undefined));
    ok(res, presentarTicket(await tickets.actualizarDatos(req.params.id, cambios)), 'Ticket actualizado');
  }),

  asignar: manejar(async (req, res) => {
    const ticket = await asignacion.manual(req.params.id, Number(req.body.tecnicoId), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket asignado');
  }),

  reabrir: manejar(async (req, res) => {
    const ticket = await cicloDeVida.reabrir(req.params.id, sanitizarTexto(req.body.motivo_reapertura), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket reabierto');
  }),

  eliminar: manejar(async (req, res) => {
    await tickets.eliminar(req.params.id);
    ok(res, null, 'Ticket eliminado');
  }),
});

module.exports = { crearTicketsController };
