/**
 * Port de tests/unit/notifications.test.js (CP006, CP009) y
 * tests/characterization/contratoReportes.test.js del monolito.
 */
const { abrirServidorDePrueba, USUARIOS, datosTicket } = require('./servidorDePrueba');

const { admin, ana, luis, maria } = USUARIOS;
const INACTIVO = { id: 22, nombre: 'Ciro Inactivo', email: 'c@test', rol: 'tecnico', activo: false };
const claves = (o) => Object.keys(o).sort();
let s;

beforeAll(async () => { s = await abrirServidorDePrueba(); });
beforeEach(async () => { await s.reiniciar({ usuarios: [admin, ana, INACTIVO, luis, maria] }); });
afterAll(async () => { await s.cerrar(); });

const crear = async (usuario = luis) => (await s.como(usuario).post('/api/tickets').send(datosTicket())).body.data;

describe('Notificaciones', () => {
  it('CP006 - debería notificar al creador y al técnico al crear', async () => {
    const t = await crear();
    const delUsuario = (await s.como(luis).get('/api/notifications')).body.data;
    const delTecnico = (await s.como(ana).get('/api/notifications')).body.data;
    expect(delUsuario.map((n) => n.tipo)).toEqual(['creacion']);
    expect(delTecnico[0]).toMatchObject({ tipo: 'asignacion', mensaje: expect.stringContaining(t.id) });
    expect(s.realtime.eventos).toContainEqual(expect.objectContaining({ destino: 'tecnico:20', evento: 'ticket:nuevo' }));
  });

  it('debería contar no leídas, marcar una y todas', async () => {
    await crear();
    await crear();
    expect((await s.como(luis).get('/api/notifications/count')).body.data).toEqual({ unread: 2 });
    const [primera] = (await s.como(luis).get('/api/notifications')).body.data;
    const marcada = await s.como(luis).patch(`/api/notifications/${primera.id}/read`);
    expect(marcada.body).toMatchObject({ message: 'Notificación marcada como leída', data: { leida: true } });
    await s.como(luis).patch('/api/notifications/read-all');
    expect((await s.como(luis).get('/api/notifications/count')).body.data).toEqual({ unread: 0 });
  });

  it('debería responder 404 al marcar la notificación de otro usuario', async () => {
    await crear(maria);
    const [ajena] = (await s.como(maria).get('/api/notifications')).body.data;
    const res = await s.como(luis).patch(`/api/notifications/${ajena.id}/read`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Notificación no encontrada');
  });

  it('debería paginar con meta', async () => {
    await crear();
    const res = await s.como(luis).get('/api/notifications?limit=1');
    expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 1, totalPages: 1 });
  });
});

describe('CP009 — Reportes por rol', () => {
  it('debería dar el resumen admin con las claves del contrato y técnicos activos del directorio', async () => {
    await crear();
    const res = await s.como(admin).get('/api/reports/summary');
    expect(claves(res.body.data)).toEqual([
      'abiertos', 'asignados', 'cerrados', 'enEspera', 'enProceso', 'promedioResolucionHoras', 'resueltos',
      'slaCumplidos', 'slaVencidos', 'tecnicosActivos', 'ticketsPorCategoria', 'ticketsPorPrioridad', 'totalTickets',
    ]);
    expect(res.body.data).toMatchObject({ totalTickets: 1, asignados: 1, tecnicosActivos: 1 });
  });

  it('debería incluir técnicos inactivos en technician-performance', async () => {
    await crear();
    const data = (await s.como(admin).get('/api/reports/technician-performance')).body.data;
    expect(data.map((t) => t.nombre).sort()).toEqual(['Ana Técnica', 'Ciro Inactivo']);
    expect(data.find((t) => t.tecnicoId === ana.id)).toMatchObject({ ticketsAsignados: 1, ticketsResueltos: 0 });
  });

  it('debería dar por-tecnico con tecnico { nombre } desde el snapshot', async () => {
    await crear();
    const data = (await s.como(admin).get('/api/reports/por-tecnico')).body.data;
    expect(data).toEqual([{ tecnicoId: ana.id, total: '1', tecnico: { nombre: 'Ana Técnica' } }]);
  });

  it('debería dar dashboard del técnico y resumen del usuario solo con lo suyo', async () => {
    await crear(luis);
    await crear(maria);
    expect((await s.como(ana).get('/api/reports/my-dashboard')).body.data.misTickets).toBe(2);
    expect((await s.como(luis).get('/api/reports/my-tickets-summary')).body.data).toMatchObject({ total: 1, abiertos: 1 });
  });

  it('debería responder los reportes simples con su forma', async () => {
    await crear();
    expect(claves((await s.como(admin).get('/api/reports/sla-compliance')).body.data)).toEqual(['porCategoria', 'porPrioridad']);
    expect(claves((await s.como(admin).get('/api/reports/resumen')).body.data)).toEqual(['porEstado', 'porPrioridad', 'total']);
    expect((await s.como(ana).get('/api/reports/sla')).body.data).toEqual({ vencidos: 0, enRiesgo: 0 });
    expect(claves((await s.como(admin).get('/api/reports/tickets-by-period?period=week')).body.data[0])).toEqual(['periodo', 'total']);
  });

  it('debería responder 403 a un usuario en reportes de admin y 400 con period inválido', async () => {
    expect((await s.como(luis).get('/api/reports/summary')).status).toBe(403);
    expect((await s.como(admin).get('/api/reports/tickets-by-period?period=siglo')).status).toBe(400);
  });

  it('debería responder 503 en summary si authcore no responde', async () => {
    s.directorio.caido = true;
    expect((await s.como(admin).get('/api/reports/summary')).status).toBe(503);
  });
});

describe('Configuración SLA', () => {
  it('debería listar en /api/sla y /api/reports/sla-config', async () => {
    const a = (await s.como(luis).get('/api/sla')).body.data.map((c) => c.prioridad);
    const b = (await s.como(luis).get('/api/reports/sla-config')).body.data.map((c) => c.prioridad);
    expect(a).toEqual(['critica', 'alta', 'media', 'baja']);
    expect(b).toEqual(a);
  });

  it('debería actualizar solo horas y porcentaje, solo para admin', async () => {
    const res = await s.como(admin).put('/api/sla/1').send({ tiempo_horas: 6, porcentaje_alerta: 70, prioridad: 'baja' });
    expect(res.body).toMatchObject({ message: 'Configuración SLA actualizada', data: { prioridad: 'critica', tiempo_horas: 6, porcentaje_alerta: 70 } });
    expect((await s.como(ana).put('/api/sla/1').send({ tiempo_horas: 1 })).status).toBe(403);
    expect((await s.como(admin).put('/api/sla/1').send({ tiempo_horas: 0 })).status).toBe(400);
    expect((await s.como(admin).put('/api/sla/99').send({ tiempo_horas: 5 })).status).toBe(404);
  });
});
