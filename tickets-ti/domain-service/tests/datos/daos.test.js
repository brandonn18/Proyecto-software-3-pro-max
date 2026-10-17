// Capa de DATOS: el resto de los DAO contra PostgreSQL.
const { crearDAOs } = require('../../src/datos');
const { abrirBdDePrueba } = require('./bdDePrueba');

const HORA = 3600000;
let bd;
let dao;

beforeAll(async () => { bd = await abrirBdDePrueba(); dao = crearDAOs(bd.modelos, bd.sequelize); });
beforeEach(async () => { await bd.limpiar(); });
afterAll(async () => { await bd.cerrar(); });

const filaTicket = (n, overrides = {}) => ({
  id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `T${n}`, descripcion: 'x', tipo: 'incidente', categoria: 'hardware',
  prioridad: 'media', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis', sla_limite: new Date(Date.now() + 24 * HORA),
  ...overrides,
});

describe('auditoriaDAO', () => {
  it('debería registrar con snapshot del actor y listar en orden', async () => {
    await bd.modelos.Ticket.create(filaTicket(1));
    await dao.auditoria.registrar({ ticketId: 'TKT-2026-0001', actor: { id: 10, nombre: 'Luis' }, accion: 'TICKET_CREADO', detalle: { a: 1 } });
    await dao.auditoria.registrar({ ticketId: 'TKT-2026-0001', actor: null, accion: 'SISTEMA', detalle: {} });
    const registros = await dao.auditoria.listarPorTicket('TKT-2026-0001');
    expect(registros.map((r) => r.accion)).toEqual(['TICKET_CREADO', 'SISTEMA']);
    expect(registros[0]).toMatchObject({ usuario: { id: 10, nombre: 'Luis' }, detalle: { a: 1 } });
    expect(registros[1].usuario).toBeNull();
  });
});

describe('notificacionesDAO', () => {
  const sembrar = async () => {
    await dao.notificaciones.insertar({ usuarioId: 10, tipo: 'creacion', mensaje: 'a' });
    await dao.notificaciones.insertar({ usuarioId: 10, tipo: 'resolucion', mensaje: 'b' });
    await dao.notificaciones.insertar({ usuarioId: 20, tipo: 'asignacion', mensaje: 'c' });
  };

  it('debería listar las propias con no leídas primero y filtrar por tipo', async () => {
    await sembrar();
    await dao.notificaciones.marcarLeida(2, 10);
    const { items, total } = await dao.notificaciones.listarDe(10, { page: 1, limit: 20 });
    expect(total).toBe(2);
    expect(items.map((n) => [n.mensaje, n.leida])).toEqual([['a', false], ['b', true]]);
    expect((await dao.notificaciones.listarDe(10, { tipo: 'creacion', page: 1, limit: 20 })).total).toBe(1);
  });

  it('debería contar y marcar todas como leídas solo del usuario', async () => {
    await sembrar();
    await dao.notificaciones.marcarTodasLeidas(10);
    expect(await dao.notificaciones.contarNoLeidas(10)).toBe(0);
    expect(await dao.notificaciones.contarNoLeidas(20)).toBe(1);
  });

  it('no debería marcar la notificación de otro usuario', async () => {
    await sembrar();
    expect(await dao.notificaciones.marcarLeida(3, 10)).toBeNull();
  });
});

describe('slaConfigDAO', () => {
  it('debería obtener, listar ordenado y actualizar', async () => {
    await bd.modelos.SLAConfig.bulkCreate([{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }]);
    expect(await dao.slaConfig.obtenerPorPrioridad('critica')).toMatchObject({ tiempo_horas: 4, porcentaje_alerta: 80 });
    expect(await dao.slaConfig.obtenerPorPrioridad('alta')).toBeNull();
    expect((await dao.slaConfig.listar()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    expect(await dao.slaConfig.actualizar(1, { tiempo_horas: 48 })).toMatchObject({ prioridad: 'baja', tiempo_horas: 48 });
    expect(await dao.slaConfig.actualizar(99, { tiempo_horas: 1 })).toBeNull();
  });
});

describe('comentariosDAO', () => {
  it('debería insertar con fecha de la base y listar del más antiguo al más nuevo', async () => {
    await bd.modelos.Ticket.create(filaTicket(1));
    const autor = { autorId: 10, autor_nombre: 'Luis', autor_rol: 'usuario' };
    const primero = await dao.comentarios.insertar({ ticketId: 'TKT-2026-0001', texto: 'uno', ...autor });
    await dao.comentarios.insertar({ ticketId: 'TKT-2026-0001', texto: 'dos', ...autor });
    expect(primero).toEqual({ id: 1, ticketId: 'TKT-2026-0001', texto: 'uno', createdAt: expect.any(Date), ...autor });
    expect((await dao.comentarios.listarPorTicket('TKT-2026-0001')).map((c) => c.texto)).toEqual(['uno', 'dos']);
    expect(await dao.comentarios.listarPorTicket('TKT-2026-0002')).toEqual([]);
  });
});

describe('reportesDAO', () => {
  const ahora = new Date();
  const sembrar = () => bd.modelos.Ticket.bulkCreate([
    filaTicket(1, { estado: 'en_proceso', tecnicoId: 20, tecnico_nombre: 'Ana' }),
    filaTicket(2, { estado: 'resuelto', tecnicoId: 20, tecnico_nombre: 'Ana', categoria: 'red' }),
    filaTicket(3, { estado: 'abierto', sla_limite: new Date(ahora.getTime() - 1000), prioridad: 'alta' }),
    filaTicket(4, { estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto', sla_limite: new Date(ahora.getTime() + HORA), sla_alerta_enviada: true }),
  ]);

  it('debería calcular los conteos generales', async () => {
    await sembrar();
    const c = await dao.reportes.conteosGenerales(ahora);
    expect(c).toMatchObject({ totalTickets: 4, slaVencidos: 1, slaCumplidos: 1 });
    expect(c.porEstado).toEqual(expect.arrayContaining([{ estado: 'abierto', total: '1' }, { estado: 'resuelto', total: '1' }]));
    expect(c.promedioResolucionHoras).toMatch(/^\d+\.\d$/);
  });

  it('debería calcular métricas y dashboard del técnico', async () => {
    await sembrar();
    expect(await dao.reportes.metricasTecnico(20, ahora)).toMatchObject({ asignados: 2, resueltos: 1, slaVencidos: 0 });
    expect(await dao.reportes.dashboardTecnico(21, ahora)).toMatchObject({ misTickets: 1, slaEnRiesgo: 1, slaVencidos: 0 });
  });

  it('debería agrupar por técnico con el snapshot de nombre', async () => {
    await sembrar();
    expect(await dao.reportes.conteoPorTecnico()).toEqual(expect.arrayContaining([
      { tecnicoId: 20, tecnico_nombre: 'Ana', total: 2 },
      { tecnicoId: 21, tecnico_nombre: 'Beto', total: 1 },
      { tecnicoId: null, tecnico_nombre: null, total: 1 },
    ]));
  });

  it('debería resumir usuario, SLA, general, cumplimiento, período y tiempo real', async () => {
    await sembrar();
    const r = dao.reportes;
    expect(await r.resumenUsuario(10)).toMatchObject({ total: 4, abiertos: 3, enEspera: 0, resueltos: 1 });
    expect(await r.estadoSLA(ahora)).toEqual({ vencidos: 1, enRiesgo: 1 });
    expect((await r.resumenGeneral()).total).toBe(4);
    const cumplimiento = await r.cumplimientoSLA(ahora);
    expect(cumplimiento.porPrioridad).toEqual(expect.arrayContaining([{ prioridad: 'alta', total: '1', vencidos: '1' }]));
    const periodo = await r.ticketsPorPeriodo({ desde: new Date(ahora.getTime() - 7 * 24 * HORA), truncar: 'day' });
    expect(periodo.reduce((s, f) => s + parseInt(f.total, 10), 0)).toBe(4);
    expect(await r.estadisticasTiempoReal(ahora)).toEqual({ total: 4, abiertos: 1, enProceso: 1, resueltos: 1, slaVencidos: 1 });
  });

  it('debería rechazar un truncado que no está en la lista blanca', () => {
    expect(() => dao.reportes.ticketsPorPeriodo({ desde: ahora, truncar: "day'); DROP TABLE tickets; --" })).toThrow(/truncar inválido/);
  });

  it('debería devolver null en ultimaActividad para un usuario sin tickets', async () => {
    expect((await dao.reportes.resumenUsuario(999)).ultimaActividad).toBeNull();
  });
});

describe('Construcción de los DAO', () => {
  it('debería exigir su modelo', () => {
    expect(() => crearDAOs({}, bd.sequelize)).toThrow(/requiere/);
  });
});
