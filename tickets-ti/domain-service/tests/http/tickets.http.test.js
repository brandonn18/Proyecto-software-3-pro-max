/**
 * Port de tests/tickets.test.js, tests/unit/tickets.test.js (partes HTTP),
 * tests/integration/ticketLifecycle.test.js y
 * tests/characterization/contratoTickets.test.js del monolito.
 */
const { abrirServidorDePrueba, USUARIOS, datosTicket } = require('./servidorDePrueba');

const { admin, ana, beto, luis, maria } = USUARIOS;
let s;

beforeAll(async () => { s = await abrirServidorDePrueba(); });
beforeEach(async () => { await s.reiniciar(); });
afterAll(async () => { await s.cerrar(); });

const crear = async (usuario = luis, overrides) => (await s.como(usuario).post('/api/tickets').send(datosTicket(overrides))).body.data;
const asignarA = (id, tecnico) => s.como(admin).post(`/api/tickets/${id}/assign`).send({ tecnicoId: tecnico.id });
const cambiar = (usuario, id, estado, comentario) => s.como(usuario).patch(`/api/tickets/${id}/status`).send({ estado, comentario });

describe('POST /api/tickets', () => {
  it('CP001 - debería crear con ID TKT-YYYY-NNNN, 201 y autoasignar', async () => {
    const res = await s.como(luis).post('/api/tickets').send(datosTicket());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: 'Ticket creado exitosamente' });
    expect(res.body.data.id).toMatch(new RegExp(`^TKT-${new Date().getFullYear()}-\\d{4}$`));
    expect(res.body.data).toMatchObject({ estado: 'asignado', usuarioId: luis.id, usuario: { id: 10, nombre: 'Luis Usuario' } });
    expect([ana.id, beto.id]).toContain(res.body.data.tecnico.id);
  });

  it.each(['hardware', 'software', 'red', 'accesos', 'servicios_ti'])('CP002 - debería guardar la categoría "%s"', async (categoria) => {
    expect((await crear(luis, { categoria })).categoria).toBe(categoria);
  });

  it('debería sanitizar HTML de título y descripción', async () => {
    const t = await crear(luis, { titulo: '<b>Monitor</b><script>x()</script>', descripcion: '<i>roto</i>' });
    expect([t.titulo, t.descripcion]).toEqual(['Monitor', 'roto']);
  });

  it('debería responder 400 con errors si faltan campos', async () => {
    const res = await s.como(luis).post('/api/tickets').send({ titulo: 'Sin datos' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('debería quedar abierto y responder 201 si authcore no responde', async () => {
    s.directorio.caido = true;
    const res = await s.como(luis).post('/api/tickets').send(datosTicket());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ estado: 'abierto', tecnico: null });
  });
});

describe('GET /api/tickets', () => {
  it('debería mostrar al admin todo, al usuario lo suyo y al técnico lo asignado', async () => {
    const t1 = await crear(luis);
    await crear(maria);
    await asignarA(t1.id, beto);
    const ids = async (u) => (await s.como(u).get('/api/tickets')).body.data.map((t) => t.id);
    expect(await ids(admin)).toHaveLength(2);
    expect((await s.como(luis).get('/api/tickets')).body.data.every((t) => t.usuarioId === luis.id)).toBe(true);
    expect((await s.como(beto).get('/api/tickets')).body.data.every((t) => t.tecnicoId === beto.id)).toBe(true);
  });

  it('no debería dejar a un usuario ver tickets ajenos pasando usuarioId', async () => {
    await crear(maria);
    const res = await s.como(luis).get(`/api/tickets?usuarioId=${maria.id}`);
    expect(res.body.data).toEqual([]);
  });

  it('debería paginar sin solapamiento y filtrar por estado', async () => {
    for (let i = 0; i < 7; i++) await crear(luis);
    const p1 = await s.como(admin).get('/api/tickets?page=1&limit=5');
    const p2 = await s.como(admin).get('/api/tickets?page=2&limit=5');
    expect(p1.body.meta).toEqual({ total: 7, page: 1, limit: 5, totalPages: 2 });
    expect(p1.body.data.filter((t) => p2.body.data.some((x) => x.id === t.id))).toHaveLength(0);
    const asignados = await s.como(admin).get('/api/tickets?estado=asignado');
    asignados.body.data.forEach((t) => expect(t.estado).toBe('asignado'));
  });

  it('debería responder 400 con un filtro inválido', async () => {
    expect((await s.como(admin).get('/api/tickets?estado=archivado')).status).toBe(400);
  });
});

describe('GET /api/tickets/:id', () => {
  it('debería incluir usuario, tecnico (snapshot) y auditorias en orden', async () => {
    const t = await crear(luis);
    await asignarA(t.id, ana);
    const res = await s.como(luis).get(`/api/tickets/${t.id}`);
    expect(res.body.data).toMatchObject({ usuario: { id: 10, nombre: 'Luis Usuario' }, tecnico: { id: 20, nombre: 'Ana Técnica' } });
    expect(res.body.data.auditorias.map((a) => a.accion)).toEqual(['TICKET_CREADO', 'TICKET_ASIGNADO']);
    expect(res.body.data.auditorias[1].usuario).toEqual({ id: 1, nombre: 'Admin' });
    expect(res.body.data).not.toHaveProperty('deletedAt');
  });

  it('debería responder 403 a otro usuario y 404 si no existe', async () => {
    const t = await crear(luis);
    expect((await s.como(maria).get(`/api/tickets/${t.id}`)).body).toMatchObject({ success: false, message: 'Sin acceso a este ticket' });
    expect((await s.como(admin).get('/api/tickets/TKT-9999-9999')).status).toBe(404);
  });
});

describe('POST /api/tickets/:id/assign', () => {
  it('debería reasignar, auditar tecnicoNombre y enviar email', async () => {
    const t = await crear(luis);
    const res = await asignarA(t.id, beto);
    expect(res.body).toMatchObject({ message: 'Ticket asignado', data: { estado: 'asignado', tecnico: { id: 21, nombre: 'Beto Técnico' } } });
    expect(s.email.enviarTicketAsignado).toHaveBeenCalled();
  });

  it('debería responder 404 con un técnico inválido y 403 a un no-admin', async () => {
    const t = await crear(luis);
    expect((await asignarA(t.id, luis)).body.message).toBe('Técnico no encontrado o inactivo');
    expect((await s.como(ana).post(`/api/tickets/${t.id}/assign`).send({ tecnicoId: ana.id })).status).toBe(403);
  });

  it('debería responder 503 si authcore no responde', async () => {
    const t = await crear(luis);
    s.directorio.caido = true;
    const res = await asignarA(t.id, ana);
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});

describe('Ciclo de vida (CP004, CP005, CP012)', () => {
  it('debería recorrer asignado → en_proceso → resuelto → cerrado y reabrir', async () => {
    const t = await crear(luis);
    await asignarA(t.id, ana);
    expect((await cambiar(ana, t.id, 'en_proceso', 'Revisando')).body.data.estado).toBe('en_proceso');
    expect((await cambiar(ana, t.id, 'resuelto')).body).toMatchObject({ message: 'Estado actualizado', data: { estado: 'resuelto' } });
    expect((await cambiar(ana, t.id, 'cerrado')).body.data.estado).toBe('cerrado');

    const antes = Date.now();
    const re = await s.como(luis).post(`/api/tickets/${t.id}/reopen`).send({ motivo_reapertura: 'Volvió a ocurrir' });
    expect(re.body).toMatchObject({ message: 'Ticket reabierto', data: { estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a ocurrir' } });
    expect(new Date(re.body.data.sla_limite).getTime()).toBeGreaterThan(antes + 7 * 3600000);
  });

  it('CP004 - debería responder 400 con el mensaje de transición inválida', async () => {
    const t = await crear(luis);
    await asignarA(t.id, ana);
    const res = await cambiar(ana, t.id, 'cerrado');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Transición inválida: 'asignado' → 'cerrado'. Permitidos: en_proceso");
  });

  it('debería responder 403 al técnico no asignado y al usuario', async () => {
    const t = await crear(luis);
    await asignarA(t.id, ana);
    expect((await cambiar(beto, t.id, 'en_proceso')).status).toBe(403);
    expect((await cambiar(luis, t.id, 'en_proceso')).status).toBe(403);
  });

  it('CP005 - debería responder 400 al reabrir en_proceso y 403 al reabrir ajeno', async () => {
    const t = await crear(luis);
    await asignarA(t.id, ana);
    await cambiar(ana, t.id, 'en_proceso');
    expect((await s.como(luis).post(`/api/tickets/${t.id}/reopen`).send({ motivo_reapertura: 'x' })).status).toBe(400);
    await cambiar(ana, t.id, 'resuelto');
    expect((await s.como(maria).post(`/api/tickets/${t.id}/reopen`).send({ motivo_reapertura: 'x' })).status).toBe(403);
    expect((await s.como(luis).post(`/api/tickets/${t.id}/reopen`).send({})).status).toBe(400);
  });
});

describe('PUT y DELETE /api/tickets/:id', () => {
  it('PUT debería editar datos pero ignorar estado y usuarioId', async () => {
    const t = await crear(luis);
    const res = await s.como(admin).put(`/api/tickets/${t.id}`).send({ titulo: 'Nuevo', estado: 'cerrado', usuarioId: 999 });
    expect(res.body).toMatchObject({ message: 'Ticket actualizado', data: { titulo: 'Nuevo', estado: t.estado, usuarioId: luis.id } });
    expect((await s.como(luis).put(`/api/tickets/${t.id}`).send({ titulo: 'x' })).status).toBe(403);
  });

  it('DELETE debería hacer borrado lógico y solo para admin', async () => {
    const t = await crear(luis);
    expect((await s.como(ana).delete(`/api/tickets/${t.id}`)).status).toBe(403);
    expect((await s.como(admin).delete(`/api/tickets/${t.id}`)).body).toEqual({ success: true, data: null, message: 'Ticket eliminado' });
    expect((await s.bd.modelos.Ticket.findByPk(t.id, { paranoid: false })).deletedAt).not.toBeNull();
    expect((await s.como(admin).get(`/api/tickets/${t.id}`)).status).toBe(404);
  });
});
