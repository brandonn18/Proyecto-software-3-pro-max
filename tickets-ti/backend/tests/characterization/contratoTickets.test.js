/**
 * Caracterización del contrato HTTP de tickets del monolito.
 * Fija la forma de las respuestas (incluidos los datos de usuario/técnico que
 * hoy salen de includes contra la tabla users) para que domain-service la
 * reproduzca con snapshots y UserDirectoryPort.
 */
const request = require('supertest');
const app = require('../../src/app');
const { sequelize, Ticket, AuditLog } = require('../../src/models');
const { crearAdmin, crearTecnico, crearUsuario, obtenerToken } = require('../helpers/factories');

let admin, tecnico, otroTecnico, usuario, otroUsuario;
let adminToken, tecnicoToken, otroTecnicoToken, usuarioToken, otroUsuarioToken;

const nuevoTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime desde ayer',
  tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

const crearPorHttp = async (token, overrides) => {
  const res = await request(app).post('/api/tickets').set('Authorization', `Bearer ${token}`).send(nuevoTicket(overrides));
  return res.body.data;
};

const crearAsignadoA = async (tecnicoDestino) => {
  const ticket = await crearPorHttp(usuarioToken);
  await request(app).post(`/api/tickets/${ticket.id}/assign`)
    .set('Authorization', `Bearer ${adminToken}`).send({ tecnicoId: tecnicoDestino.id });
  return ticket;
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
  admin = await crearAdmin();
  tecnico = await crearTecnico({ nombre: 'Ana Técnica' });
  otroTecnico = await crearTecnico();
  usuario = await crearUsuario({ nombre: 'Luis Usuario' });
  otroUsuario = await crearUsuario();
  adminToken = await obtenerToken(admin.email, 'Admin123!');
  tecnicoToken = await obtenerToken(tecnico.email, 'Tecnico123!');
  otroTecnicoToken = await obtenerToken(otroTecnico.email, 'Tecnico123!');
  usuarioToken = await obtenerToken(usuario.email, 'Usuario123!');
  otroUsuarioToken = await obtenerToken(otroUsuario.email, 'Usuario123!');
});

afterAll(async () => {
  await sequelize.close();
});

describe('Contrato POST /api/tickets', () => {
  it('debería autoasignar a un técnico activo y responder 201 con estado asignado', async () => {
    const res = await request(app).post('/api/tickets').set('Authorization', `Bearer ${usuarioToken}`).send(nuevoTicket());
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Ticket creado exitosamente');
    expect(res.body.data).toMatchObject({ estado: 'asignado', usuarioId: usuario.id, reabierto: false });
    expect([tecnico.id, otroTecnico.id]).toContain(res.body.data.tecnicoId);
    expect(res.body.data.id).toMatch(/^TKT-\d{4}-\d{4}$/);
  });

  it('debería sanitizar HTML en título y descripción', async () => {
    const ticket = await crearPorHttp(usuarioToken, { titulo: '<b>Monitor</b><script>x()</script>', descripcion: '<i>roto</i>' });
    expect(ticket.titulo).toBe('Monitor');
    expect(ticket.descripcion).toBe('roto');
  });
});

describe('Contrato GET /api/tickets', () => {
  it('debería incluir usuario y técnico como { id, nombre, email }', async () => {
    const creado = await crearAsignadoA(tecnico);
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`);
    const ticket = res.body.data.find((t) => t.id === creado.id);
    expect(ticket.usuario).toEqual({ id: usuario.id, nombre: 'Luis Usuario', email: usuario.email });
    expect(ticket.tecnico).toEqual({ id: tecnico.id, nombre: 'Ana Técnica', email: tecnico.email });
  });

  it('debería devolver meta { total, page, limit, totalPages } con limit 20 por defecto', async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(Object.keys(res.body.meta).sort()).toEqual(['limit', 'page', 'total', 'totalPages']);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('debería mostrar al técnico solo los tickets asignados a él', async () => {
    await crearAsignadoA(otroTecnico);
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${otroTecnicoToken}`);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((t) => expect(t.tecnicoId).toBe(otroTecnico.id));
  });

  it('debería devolver tecnico null en tickets sin asignar', async () => {
    const sinAsignar = await Ticket.create({ ...nuevoTicket(), id: 'TKT-1999-0001', usuarioId: usuario.id });
    const res = await request(app).get(`/api/tickets/${sinAsignar.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.tecnico).toBeNull();
  });
});

describe('Contrato GET /api/tickets/:id', () => {
  it('debería incluir auditorias ordenadas con usuario { id, nombre }', async () => {
    const creado = await crearPorHttp(usuarioToken);
    const res = await request(app).get(`/api/tickets/${creado.id}`).set('Authorization', `Bearer ${usuarioToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditorias[0]).toMatchObject({ accion: 'TICKET_CREADO', usuario: { id: usuario.id, nombre: 'Luis Usuario' } });
  });

  it('debería responder 403 si un usuario pide un ticket ajeno', async () => {
    const creado = await crearPorHttp(usuarioToken);
    const res = await request(app).get(`/api/tickets/${creado.id}`).set('Authorization', `Bearer ${otroUsuarioToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Sin acceso a este ticket' });
  });
});

describe('Contrato POST /api/tickets/:id/assign', () => {
  it('debería reasignar y auditar tecnicoNombre', async () => {
    const creado = await crearAsignadoA(tecnico);
    const res = await request(app).post(`/api/tickets/${creado.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`).send({ tecnicoId: otroTecnico.id });
    const audit = await AuditLog.findOne({
      where: { ticketId: creado.id, accion: 'TICKET_ASIGNADO' }, order: [['id', 'DESC']],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ estado: 'asignado', tecnicoId: otroTecnico.id });
    expect(audit.detalle).toEqual({ tecnicoId: otroTecnico.id, tecnicoNombre: otroTecnico.nombre });
  });

  it('debería responder 404 si el técnico no existe o no es técnico', async () => {
    const creado = await crearPorHttp(usuarioToken);
    const res = await request(app).post(`/api/tickets/${creado.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`).send({ tecnicoId: usuario.id });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Técnico no encontrado o inactivo' });
  });
});

describe('Contrato PATCH /api/tickets/:id/status', () => {
  it('debería responder 403 si el técnico no es el asignado', async () => {
    const creado = await crearAsignadoA(tecnico);
    const res = await request(app).patch(`/api/tickets/${creado.id}/status`)
      .set('Authorization', `Bearer ${otroTecnicoToken}`).send({ estado: 'en_proceso' });
    expect(res.status).toBe(403);
  });

  it('debería responder 400 con el mensaje de transición inválida', async () => {
    const creado = await crearAsignadoA(tecnico);
    const res = await request(app).patch(`/api/tickets/${creado.id}/status`)
      .set('Authorization', `Bearer ${tecnicoToken}`).send({ estado: 'cerrado' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Transición inválida: 'asignado' → 'cerrado'. Permitidos: en_proceso");
  });
});

describe('Contrato DELETE /api/tickets/:id', () => {
  it('debería hacer borrado lógico (paranoid)', async () => {
    const creado = await crearPorHttp(usuarioToken);
    const res = await request(app).delete(`/api/tickets/${creado.id}`).set('Authorization', `Bearer ${adminToken}`);
    const enBD = await Ticket.findByPk(creado.id, { paranoid: false });
    expect(res.body).toEqual({ success: true, data: null, message: 'Ticket eliminado' });
    expect(enBD.deletedAt).not.toBeNull();
  });
});
