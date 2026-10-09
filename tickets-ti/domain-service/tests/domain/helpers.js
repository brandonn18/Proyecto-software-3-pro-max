const { Ticket } = require('../../src/domain');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 60 * 60 * 1000;
const CREADOR = Object.freeze({ id: 10, nombre: 'Luis Usuario' });
const TECNICO = Object.freeze({ id: 20, nombre: 'Ana Técnica' });

const datosValidos = (overrides = {}) => ({
  id: 'TKT-2026-0001',
  titulo: 'Impresora sin conexión',
  descripcion: 'No imprime desde ayer',
  tipo: 'incidente',
  categoria: 'hardware',
  prioridad: 'alta',
  creador: CREADOR,
  ...overrides,
});

const crearTicket = (overrides = {}, sla = { ahora: AHORA, horas: 8 }) => Ticket.crear(datosValidos(overrides), sla);

// Ticket ya existente en un estado dado, como si viniera del repositorio
const ticketEn = (estado, overrides = {}) =>
  Ticket.desdePersistencia({ ...crearTicket().aPrimitivos(), estado, tecnicoId: TECNICO.id, tecnico_nombre: TECNICO.nombre, ...overrides });

module.exports = { AHORA, HORA, CREADOR, TECNICO, datosValidos, crearTicket, ticketEn };
