const {
  SequelizeAuditoriaRepository, SequelizeNotificacionRepository, SequelizeSLAConfigRepository, SequelizeReportesQuery,
} = require('../../src/infrastructure');
const { abrirBdDePrueba } = require('./bdDePrueba');

const HORA = 3600000;
let bd;

beforeAll(async () => { bd = await abrirBdDePrueba(); });
beforeEach(async () => { await bd.limpiar(); });
afterAll(async () => { await bd.cerrar(); });

const filaTicket = (n, overrides = {}) => ({
  id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `T${n}`, descripcion: 'x', tipo: 'incidente', categoria: 'hardware',
  prioridad: 'media', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis', sla_limite: new Date(Date.now() + 24 * HORA),
  ...overrides,
});

describe('SequelizeAuditoriaRepository', () => {
  it('debería registrar con snapshot del actor y listar en orden', async () => {
    await bd.modelos.Ticket.create(filaTicket(1));
    const repo = new SequelizeAuditoriaRepository(bd.modelos);
    await repo.registrar({ ticketId: 'TKT-2026-0001', actor: { id: 10, nombre: 'Luis' }, accion: 'TICKET_CREADO', detalle: { a: 1 } });
    await repo.registrar({ ticketId: 'TKT-2026-0001', actor: null, accion: 'SISTEMA', detalle: {} });
    const registros = await repo.listarPorTicket('TKT-2026-0001');
    expect(registros.map((r) => r.accion)).toEqual(['TICKET_CREADO', 'SISTEMA']);
    expect(registros[0]).toMatchObject({ usuario: { id: 10, nombre: 'Luis' }, detalle: { a: 1 } });
    expect(registros[1].usuario).toBeNull();
  });
});

describe('SequelizeNotificacionRepository', () => {
  const crearRepo = async () => {
    const repo = new SequelizeNotificacionRepository(bd.modelos);
    await repo.crear({ usuarioId: 10, tipo: 'creacion', mensaje: 'a' });
    await repo.crear({ usuarioId: 10, tipo: 'resolucion', mensaje: 'b' });
    await repo.crear({ usuarioId: 20, tipo: 'asignacion', mensaje: 'c' });
    return repo;
  };

  it('debería listar las propias con no leídas primero y filtrar por tipo', async () => {
    const repo = await crearRepo();
    await repo.marcarLeida(2, 10);
    const { items, total } = await repo.listarDe(10, { page: 1, limit: 20 });
    expect(total).toBe(2);
    expect(items.map((n) => [n.mensaje, n.leida])).toEqual([['a', false], ['b', true]]);
    expect((await repo.listarDe(10, { tipo: 'creacion', page: 1, limit: 20 })).total).toBe(1);
  });

  it('debería contar y marcar todas como leídas solo del usuario', async () => {
    const repo = await crearRepo();
    await repo.marcarTodasLeidas(10);
    expect(await repo.contarNoLeidas(10)).toBe(0);
    expect(await repo.contarNoLeidas(20)).toBe(1);
  });

  it('no debería marcar la notificación de otro usuario', async () => {
    const repo = await crearRepo();
    expect(await repo.marcarLeida(3, 10)).toBeNull();
  });
});

describe('SequelizeSLAConfigRepository', () => {
  it('debería obtener, listar ordenado y actualizar', async () => {
    await bd.modelos.SLAConfig.bulkCreate([{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }]);
    const repo = new SequelizeSLAConfigRepository(bd.modelos);
    expect(await repo.obtenerPorPrioridad('critica')).toMatchObject({ tiempo_horas: 4, porcentaje_alerta: 80 });
    expect(await repo.obtenerPorPrioridad('alta')).toBeNull();
    expect((await repo.listar()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    expect(await repo.actualizar(1, { tiempo_horas: 48 })).toMatchObject({ prioridad: 'baja', tiempo_horas: 48 });
    expect(await repo.actualizar(99, { tiempo_horas: 1 })).toBeNull();
  });
});

describe('SequelizeReportesQuery', () => {
  const ahora = new Date();
  const sembrar = () => bd.modelos.Ticket.bulkCreate([
    filaTicket(1, { estado: 'en_proceso', tecnicoId: 20, tecnico_nombre: 'Ana' }),
    filaTicket(2, { estado: 'resuelto', tecnicoId: 20, tecnico_nombre: 'Ana', categoria: 'red' }),
    filaTicket(3, { estado: 'abierto', sla_limite: new Date(ahora.getTime() - 1000), prioridad: 'alta' }),
    filaTicket(4, { estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto', sla_limite: new Date(ahora.getTime() + HORA), sla_alerta_enviada: true }),
  ]);
  const query = () => new SequelizeReportesQuery(bd.modelos, bd.sequelize);

  it('debería calcular los conteos generales', async () => {
    await sembrar();
    const c = await query().conteosGenerales(ahora);
    expect(c).toMatchObject({ totalTickets: 4, slaVencidos: 1, slaCumplidos: 1 });
    expect(c.porEstado).toEqual(expect.arrayContaining([{ estado: 'abierto', total: '1' }, { estado: 'resuelto', total: '1' }]));
    expect(c.promedioResolucionHoras).toMatch(/^\d+\.\d$/);
  });

  it('debería calcular métricas y dashboard del técnico', async () => {
    await sembrar();
    expect(await query().metricasTecnico(20, ahora)).toMatchObject({ asignados: 2, resueltos: 1, slaVencidos: 0 });
    expect(await query().dashboardTecnico(21, ahora)).toMatchObject({ misTickets: 1, slaEnRiesgo: 1, slaVencidos: 0 });
  });

  it('debería agrupar por técnico con el snapshot de nombre', async () => {
    await sembrar();
    const filas = await query().conteoPorTecnico();
    expect(filas).toEqual(expect.arrayContaining([
      { tecnicoId: 20, tecnico_nombre: 'Ana', total: 2 },
      { tecnicoId: 21, tecnico_nombre: 'Beto', total: 1 },
      { tecnicoId: null, tecnico_nombre: null, total: 1 },
    ]));
  });

  it('debería resumir usuario, SLA, general, cumplimiento, período y tiempo real', async () => {
    await sembrar();
    const q = query();
    expect(await q.resumenUsuario(10)).toMatchObject({ total: 4, abiertos: 3, enEspera: 0, resueltos: 1 });
    expect(await q.estadoSLA(ahora)).toEqual({ vencidos: 1, enRiesgo: 1 });
    expect((await q.resumenGeneral()).total).toBe(4);
    const cumplimiento = await q.cumplimientoSLA(ahora);
    expect(cumplimiento.porPrioridad).toEqual(expect.arrayContaining([{ prioridad: 'alta', total: '1', vencidos: '1' }]));
    const periodo = await q.ticketsPorPeriodo({ desde: new Date(ahora.getTime() - 7 * 24 * HORA), truncar: 'day' });
    expect(periodo.reduce((s, f) => s + parseInt(f.total, 10), 0)).toBe(4);
    expect(await q.estadisticasTiempoReal(ahora)).toEqual({ total: 4, abiertos: 1, enProceso: 1, resueltos: 1, slaVencidos: 1 });
  });

  it('debería rechazar un truncado que no está en la lista blanca', () => {
    expect(() => query().ticketsPorPeriodo({ desde: ahora, truncar: "day'); DROP TABLE tickets; --" })).toThrow(/truncar inválido/);
  });

  it('debería devolver null en ultimaActividad para un usuario sin tickets', async () => {
    expect((await query().resumenUsuario(999)).ultimaActividad).toBeNull();
  });
});
