const { manejar, ok, paginado } = require('./manejar');
const { sanitizarTexto, presentarTicket, presentarDetalle } = require('../presentadores');

const _datosSanitizados = ({ titulo, descripcion, tipo, categoria, prioridad }) => ({
  titulo: sanitizarTexto(titulo), descripcion: sanitizarTexto(descripcion), tipo, categoria, prioridad,
});

// casos: { crear, asignar, cambiarEstado, reabrir, gestionar }
const crearTicketsController = (casos) => ({
  listar: manejar(async (req, res) => {
    const { items, meta } = await casos.gestionar.listar(req.query, req.actor);
    paginado(res, { items: items.map(presentarTicket), meta });
  }),

  obtener: manejar(async (req, res) => {
    ok(res, presentarDetalle(await casos.gestionar.obtener(req.params.id, req.actor)));
  }),

  crear: manejar(async (req, res) => {
    const ticket = await casos.crear.ejecutar(_datosSanitizados(req.body), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket creado exitosamente', 201);
  }),

  cambiarEstado: manejar(async (req, res) => {
    const { estado, comentario } = req.body;
    const ticket = await casos.cambiarEstado.ejecutar(req.params.id, { estado, comentario: sanitizarTexto(comentario) }, req.actor);
    ok(res, presentarTicket(ticket), 'Estado actualizado');
  }),

  actualizar: manejar(async (req, res) => {
    const cambios = Object.fromEntries(Object.entries(_datosSanitizados(req.body)).filter(([, v]) => v !== undefined));
    ok(res, presentarTicket(await casos.gestionar.actualizarDatos(req.params.id, cambios)), 'Ticket actualizado');
  }),

  asignar: manejar(async (req, res) => {
    const ticket = await casos.asignar.ejecutar(req.params.id, Number(req.body.tecnicoId), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket asignado');
  }),

  reabrir: manejar(async (req, res) => {
    const ticket = await casos.reabrir.ejecutar(req.params.id, sanitizarTexto(req.body.motivo_reapertura), req.actor);
    ok(res, presentarTicket(ticket), 'Ticket reabierto');
  }),

  eliminar: manejar(async (req, res) => {
    await casos.gestionar.eliminar(req.params.id);
    ok(res, null, 'Ticket eliminado');
  }),
});

module.exports = { crearTicketsController };
