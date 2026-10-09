/**
 * Caracterización del contrato de reportes del monolito.
 * Fija las claves de cada respuesta; varios reportes leen técnicos desde la
 * tabla users y en domain-service pasarán por UserDirectoryPort.
 */
const request = require('supertest');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');
const { crearAdmin, crearTecnico, crearUsuario, obtenerToken, crearTicket } = require('../helpers/factories');

let admin, tecnico, usuario;
let adminToken, tecnicoToken, usuarioToken;

const obtener = (ruta, token) => request(app).get(ruta).set('Authorization', `Bearer ${token}`);
const claves = (obj) => Object.keys(obj).sort();

beforeAll(async () => {
  await sequelize.sync({ force: true });
  admin = await crearAdmin();
  tecnico = await crearTecnico({ nombre: 'Ana Técnica' });
  await crearTecnico({ activo: false });
  usuario = await crearUsuario();
  await crearTicket({ usuarioId: usuario.id, tecnicoId: tecnico.id, estado: 'en_proceso' });
  await crearTicket({ usuarioId: usuario.id, tecnicoId: tecnico.id, estado: 'resuelto' });
  await crearTicket({ usuarioId: usuario.id, estado: 'abierto', sla_limite: new Date(Date.now() - 1000) });
  adminToken = await obtenerToken(admin.email, 'Admin123!');
  tecnicoToken = await obtenerToken(tecnico.email, 'Tecnico123!');
  usuarioToken = await obtenerToken(usuario.email, 'Usuario123!');
});

afterAll(async () => {
  await sequelize.close();
});

describe('Contrato GET /api/reports/summary', () => {
  it('debería devolver los KPIs y contar solo técnicos activos', async () => {
    const res = await obtener('/api/reports/summary', adminToken);
    expect(claves(res.body.data)).toEqual([
      'abiertos', 'asignados', 'cerrados', 'enEspera', 'enProceso', 'promedioResolucionHoras',
      'resueltos', 'slaCumplidos', 'slaVencidos', 'tecnicosActivos', 'ticketsPorCategoria',
      'ticketsPorPrioridad', 'totalTickets',
    ]);
    expect(res.body.data).toMatchObject({ totalTickets: 3, tecnicosActivos: 1, slaVencidos: 1 });
  });
});

describe('Contrato GET /api/reports/technician-performance', () => {
  it('debería listar a todos los técnicos, incluso inactivos, con sus métricas', async () => {
    const res = await obtener('/api/reports/technician-performance', adminToken);
    const ana = res.body.data.find((t) => t.tecnicoId === tecnico.id);
    expect(res.body.data).toHaveLength(2);
    expect(claves(ana)).toEqual([
      'email', 'nombre', 'promedioResolucionHoras', 'slasCumplidos', 'slasVencidos',
      'tecnicoId', 'ticketsAsignados', 'ticketsResueltos',
    ]);
    expect(ana).toMatchObject({ nombre: 'Ana Técnica', ticketsAsignados: 2, ticketsResueltos: 1 });
  });
});

describe('Contrato GET /api/reports/por-tecnico', () => {
  it('debería agrupar por tecnicoId con tecnico { nombre }', async () => {
    const res = await obtener('/api/reports/por-tecnico', adminToken);
    const fila = res.body.data.find((f) => f.tecnicoId === tecnico.id);
    expect(fila).toEqual({ tecnicoId: tecnico.id, total: '2', tecnico: { nombre: 'Ana Técnica' } });
  });
});

describe('Contrato de reportes sin datos de usuarios', () => {
  it('debería devolver { porCategoria, porPrioridad } en sla-compliance', async () => {
    const res = await obtener('/api/reports/sla-compliance', adminToken);
    expect(claves(res.body.data)).toEqual(['porCategoria', 'porPrioridad']);
  });

  it('debería devolver un arreglo { periodo, total } en tickets-by-period', async () => {
    const res = await obtener('/api/reports/tickets-by-period?period=week', adminToken);
    expect(claves(res.body.data[0])).toEqual(['periodo', 'total']);
  });

  it('debería devolver el dashboard del técnico', async () => {
    const res = await obtener('/api/reports/my-dashboard', tecnicoToken);
    expect(claves(res.body.data)).toEqual(['misTickets', 'porEstado', 'resueltoHoy', 'resueltosSemana', 'slaEnRiesgo', 'slaVencidos']);
    expect(res.body.data.misTickets).toBe(1);
  });

  it('debería devolver el resumen del usuario', async () => {
    const res = await obtener('/api/reports/my-tickets-summary', usuarioToken);
    expect(res.body.data).toMatchObject({ total: 3, abiertos: 2, enEspera: 0, resueltos: 1 });
  });

  it('debería devolver { total, porEstado, porPrioridad } en resumen', async () => {
    const res = await obtener('/api/reports/resumen', adminToken);
    expect(claves(res.body.data)).toEqual(['porEstado', 'porPrioridad', 'total']);
  });

  it('debería devolver { vencidos, enRiesgo } en sla', async () => {
    const res = await obtener('/api/reports/sla', adminToken);
    expect(res.body.data).toEqual({ vencidos: 1, enRiesgo: 0 });
  });

  it('debería responder 403 a un usuario en reportes de administrador', async () => {
    const res = await obtener('/api/reports/summary', usuarioToken);
    expect(res.status).toBe(403);
  });
});
