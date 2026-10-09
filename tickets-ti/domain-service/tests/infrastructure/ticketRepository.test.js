const { probarContratoTicketRepository } = require('../contratos/ticketRepository.contrato');
const { TicketRepositoryEnMemoria, RelojFijo } = require('../application/fakes');
const { SequelizeTicketRepository } = require('../../src/infrastructure');
const { abrirBdDePrueba } = require('./bdDePrueba');

// El reloj del doble avanza 1 ms por lectura para imitar el createdAt real
const relojQueAvanza = () => {
  const reloj = new RelojFijo(new Date('2026-10-08T12:00:00.000Z'));
  const ahora = reloj.ahora.bind(reloj);
  reloj.ahora = () => { reloj.fecha = new Date(reloj.fecha.getTime() + 1); return ahora(); };
  return reloj;
};

probarContratoTicketRepository('en memoria', async () => {
  const ctx = { repo: null };
  ctx.limpiar = async () => { ctx.repo = new TicketRepositoryEnMemoria({ clock: relojQueAvanza() }); };
  ctx.cerrar = async () => {};
  return ctx;
});

probarContratoTicketRepository('Sequelize (PostgreSQL)', async () => {
  const bd = await abrirBdDePrueba();
  return { repo: new SequelizeTicketRepository(bd.modelos), limpiar: bd.limpiar, cerrar: bd.cerrar };
});
