// Implementaciones Sequelize de las interfaces de persistencia, contra PostgreSQL.
const RepositorioDeTicketsSequelize = require('../../src/infraestructura/persistencia/RepositorioDeTicketsSequelize');
const RepositorioDeAuditoriaSequelize = require('../../src/infraestructura/persistencia/RepositorioDeAuditoriaSequelize');
const RepositorioDeNotificacionesSequelize = require('../../src/infraestructura/persistencia/RepositorioDeNotificacionesSequelize');
const RepositorioDeConfiguracionSLASequelize = require('../../src/infraestructura/persistencia/RepositorioDeConfiguracionSLASequelize');
const RepositorioDeComentariosSequelize = require('../../src/infraestructura/persistencia/RepositorioDeComentariosSequelize');
const ConsultaDeReportesSequelize = require('../../src/infraestructura/persistencia/ConsultaDeReportesSequelize');
const { RepositorioDeTickets } = require('../../src/interfaces');
const Ticket = require('../../src/entidades/Ticket');
const Comentario = require('../../src/entidades/Comentario');
const EventoDeAuditoria = require('../../src/entidades/EventoDeAuditoria');
const { FabricaDeActores } = require('../../src/entidades/actores');
const IdTicket = require('../../src/valores/IdTicket');
const DatosDeTicket = require('../../src/valores/DatosDeTicket');
const VentanaSLA = require('../../src/valores/VentanaSLA');
const Paginacion = require('../../src/valores/Paginacion');
const { ErrorIdDuplicado } = require('../../src/errores');
const { abrirBdDePrueba } = require('./bdDePrueba');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 3600000;
const LUIS = FabricaDeActores.crear({ id: 10, nombre: 'Luis Usuario', rol: 'usuario' });
const ANA = { id: 20, nombre: 'Ana Técnica' };
const pagina = new Paginacion({ limit: 20 });
let bd;

beforeAll(async () => { bd = await abrirBdDePrueba(); });
beforeEach(async () => { await bd.limpiar(); });
afterAll(async () => { await bd.cerrar(); });

const nuevo = (n, overrides = {}) => Ticket.abrir({
  id: IdTicket.del(2026, n), solicitante: overrides.solicitante ?? LUIS, ventanaSLA: VentanaSLA.desde(AHORA, 8),
  datos: new DatosDeTicket({ titulo: `Ticket ${n}`, descripcion: 'desc', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides }),
});
const asignado = (n, overrides) => { const t = nuevo(n, overrides); t.asignarA(ANA); return t; };

describe('RepositorioDeTicketsSequelize', () => {
  let repo;
  beforeAll(() => { repo = new RepositorioDeTicketsSequelize(bd.modelos); });

  it('debería ser un RepositorioDeTickets y reconstruir entidades con sus snapshots', async () => {
    expect(repo).toBeInstanceOf(RepositorioDeTickets);
    await repo.guardarNuevo(asignado(1));
    const t = await repo.buscarPorId('TKT-2026-0001');
    expect(t).toBeInstanceOf(Ticket);
    expect(t.aInstantanea()).toMatchObject({ estado: 'asignado', usuario_nombre: 'Luis Usuario', tecnicoId: 20, tecnico_nombre: 'Ana Técnica', sla_limite: new Date(AHORA.getTime() + 8 * HORA) });
    expect(t.aInstantanea().createdAt).toBeInstanceOf(Date);
    expect(await repo.buscarPorId('TKT-2026-9999')).toBeNull();
  });

  it('debería lanzar ErrorIdDuplicado y contar por año incluyendo eliminados', async () => {
    await repo.guardarNuevo(nuevo(1));
    await expect(repo.guardarNuevo(nuevo(1))).rejects.toBeInstanceOf(ErrorIdDuplicado);
    await repo.guardarNuevo(nuevo(2));
    await repo.eliminar('TKT-2026-0002');
    expect([await repo.contarDelAnio(2026), await repo.contarDelAnio(2025)]).toEqual([2, 0]);
  });

  it('debería persistir los cambios de la entidad y ocultar los eliminados', async () => {
    const t = await repo.guardarNuevo(asignado(1));
    t.cambiarEstadoA('en_proceso');
    expect((await repo.actualizar(t)).estado.nombre).toBe('en_proceso');
    await repo.eliminar(t.id);
    expect(await repo.buscarPorId(t.id)).toBeNull();
    expect((await repo.listar({ filtros: {}, paginacion: pagina })).total).toBe(0);
  });

  it('debería listar del más nuevo al más antiguo, paginar, filtrar y buscar literal', async () => {
    await repo.guardarNuevo(nuevo(1, { categoria: 'red' }));
    await repo.guardarNuevo(nuevo(2, { titulo: 'Impresora rota' }));
    await repo.guardarNuevo(nuevo(3, { solicitante: FabricaDeActores.crear({ id: 11, nombre: 'María', rol: 'usuario' }) }));
    const primera = await repo.listar({ filtros: {}, paginacion: new Paginacion({ limit: 2 }) });
    expect([primera.total, primera.items.map((t) => t.id)]).toEqual([3, ['TKT-2026-0003', 'TKT-2026-0002']]);
    const total = async (filtros) => (await repo.listar({ filtros, paginacion: pagina })).total;
    expect(await Promise.all([total({ categoria: 'red' }), total({ usuarioId: 11 }), total({ search: 'IMPRESORA' }), total({ search: '0003' }), total({ search: '%' }), total({ search: '_' })]))
      .toEqual([1, 1, 1, 1, 0, 0]);
    expect(await total({ fechaDesde: '2000-01-01', fechaHasta: '2999-12-31' })).toBe(3);
  });

  it('debería contar carga activa y listar pendientes de alerta SLA', async () => {
    await repo.guardarNuevo(asignado(1));
    await repo.guardarNuevo(asignado(2, { categoria: 'red' }));
    await repo.guardarNuevo(nuevo(3));
    const alertado = asignado(4);
    alertado.marcarAlertaSLAEnviada();
    await repo.guardarNuevo(alertado);
    const resuelto = await repo.guardarNuevo(asignado(5));
    resuelto.cambiarEstadoA('en_proceso');
    resuelto.cambiarEstadoA('resuelto');
    await repo.actualizar(resuelto);
    expect([await repo.contarCargaActiva({ tecnicoId: 20 }), await repo.contarCargaActiva({ tecnicoId: 20, categoria: 'red' })]).toEqual([3, 1]);
    expect((await repo.listarPendientesDeAlertaSLA()).map((t) => t.id).sort()).toEqual(['TKT-2026-0001', 'TKT-2026-0002']);
  });
});

describe('Otros repositorios Sequelize', () => {
  it('RepositorioDeAuditoriaSequelize debería registrar con snapshot y listar en orden', async () => {
    const repo = new RepositorioDeAuditoriaSequelize(bd.modelos);
    await repo.registrar(new EventoDeAuditoria({ ticketId: 'T', actor: LUIS, accion: 'TICKET_CREADO', detalle: { a: 1 } }));
    await repo.registrar(new EventoDeAuditoria({ ticketId: 'T', accion: 'SISTEMA', detalle: {} }));
    expect((await repo.listarPorTicket('T')).map((e) => e.aJSON())).toEqual([
      expect.objectContaining({ accion: 'TICKET_CREADO', detalle: { a: 1 }, usuario: { id: 10, nombre: 'Luis Usuario' } }),
      expect.objectContaining({ accion: 'SISTEMA', usuario: null }),
    ]);
  });

  it('RepositorioDeNotificacionesSequelize debería ordenar no leídas primero y respetar al dueño', async () => {
    const repo = new RepositorioDeNotificacionesSequelize(bd.modelos);
    await repo.guardar({ usuarioId: 10, tipo: 'creacion', mensaje: 'a' });
    await repo.guardar({ usuarioId: 10, tipo: 'resolucion', mensaje: 'b' });
    await repo.guardar({ usuarioId: 20, tipo: 'asignacion', mensaje: 'c' });
    await repo.marcarLeida(2, 10);
    const { items, total } = await repo.listarDe(10, { paginacion: pagina });
    expect([total, items.map((n) => [n.aJSON().mensaje, n.leida])]).toEqual([2, [['a', false], ['b', true]]]);
    expect((await repo.listarDe(10, { tipo: 'creacion', paginacion: pagina })).total).toBe(1);
    expect(await repo.marcarLeida(3, 10)).toBeNull();
    await repo.marcarTodasLeidas(10);
    expect([await repo.contarNoLeidas(10), await repo.contarNoLeidas(20)]).toEqual([0, 1]);
  });

  it('RepositorioDeConfiguracionSLASequelize debería obtener, listar ordenado y guardar ajustes', async () => {
    await bd.modelos.SLAConfig.bulkCreate([{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }]);
    const repo = new RepositorioDeConfiguracionSLASequelize(bd.modelos);
    expect((await repo.obtenerPorPrioridad('critica')).aJSON()).toMatchObject({ tiempo_horas: 4, porcentaje_alerta: 80 });
    expect(await repo.obtenerPorPrioridad('alta')).toBeNull();
    expect((await repo.listar()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    const baja = await repo.buscarPorId(1);
    baja.ajustar({ tiempo_horas: 48 });
    expect((await repo.guardar(baja)).tiempoHoras).toBe(48);
    expect(await repo.buscarPorId(99)).toBeNull();
  });

  it('RepositorioDeComentariosSequelize debería guardar con fecha de la base y no guardar dos veces', async () => {
    const repo = new RepositorioDeComentariosSequelize(bd.modelos);
    const autor = LUIS.aSnapshot();
    const c = await repo.guardar(new Comentario({ ticketId: 'TKT-2026-0001', autor, texto: 'uno' }));
    await repo.guardar(new Comentario({ ticketId: 'TKT-2026-0001', autor, texto: 'dos' }));
    expect(c.aJSON()).toEqual({ id: 1, ticketId: 'TKT-2026-0001', texto: 'uno', createdAt: expect.any(Date), autor });
    expect((await repo.listarPorTicket('TKT-2026-0001')).map((x) => x.texto)).toEqual(['uno', 'dos']);
    await expect(repo.guardar(c)).rejects.toThrow('ya fue guardado');
  });

  it('deberían exigir su modelo', () => {
    [RepositorioDeTicketsSequelize, RepositorioDeAuditoriaSequelize, RepositorioDeNotificacionesSequelize,
      RepositorioDeConfiguracionSLASequelize, RepositorioDeComentariosSequelize].forEach((Clase) => expect(() => new Clase({})).toThrow(/requiere/));
    expect(() => new ConsultaDeReportesSequelize({}, null)).toThrow(/requiere/);
  });
});

describe('ConsultaDeReportesSequelize', () => {
  const ahora = new Date();
  const fila = (n, overrides = {}) => ({
    id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `T${n}`, descripcion: 'x', tipo: 'incidente', categoria: 'hardware',
    prioridad: 'media', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis', sla_limite: new Date(ahora.getTime() + 24 * HORA), ...overrides,
  });
  let q;
  beforeEach(async () => {
    q = new ConsultaDeReportesSequelize(bd.modelos, bd.sequelize);
    await bd.modelos.Ticket.bulkCreate([
      fila(1, { estado: 'en_proceso', tecnicoId: 20, tecnico_nombre: 'Ana' }),
      fila(2, { estado: 'resuelto', tecnicoId: 20, tecnico_nombre: 'Ana', categoria: 'red' }),
      fila(3, { estado: 'abierto', sla_limite: new Date(ahora.getTime() - 1000), prioridad: 'alta' }),
      fila(4, { estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto', sla_limite: new Date(ahora.getTime() + HORA), sla_alerta_enviada: true }),
    ]);
  });

  it('debería calcular conteos, métricas, dashboard y agrupar por técnico', async () => {
    expect(await q.conteosGenerales(ahora)).toMatchObject({ totalTickets: 4, slaVencidos: 1, slaCumplidos: 1 });
    expect(await q.metricasTecnico(20, ahora)).toMatchObject({ asignados: 2, resueltos: 1, slaVencidos: 0 });
    expect(await q.dashboardTecnico(21, ahora)).toMatchObject({ misTickets: 1, slaEnRiesgo: 1 });
    expect(await q.conteoPorTecnico()).toEqual(expect.arrayContaining([{ tecnicoId: 20, tecnico_nombre: 'Ana', total: 2 }, { tecnicoId: null, tecnico_nombre: null, total: 1 }]));
  });

  it('debería resumir usuario, SLA, general, cumplimiento, período y tiempo real', async () => {
    expect(await q.resumenUsuario(10)).toMatchObject({ total: 4, abiertos: 3, enEspera: 0, resueltos: 1 });
    expect((await q.resumenUsuario(999)).ultimaActividad).toBeNull();
    expect(await q.estadoSLA(ahora)).toEqual({ vencidos: 1, enRiesgo: 1 });
    expect((await q.resumenGeneral()).total).toBe(4);
    expect((await q.cumplimientoSLA(ahora)).porPrioridad).toEqual(expect.arrayContaining([{ prioridad: 'alta', total: '1', vencidos: '1' }]));
    const periodo = await q.ticketsPorPeriodo({ desde: new Date(ahora.getTime() - 7 * 24 * HORA), truncar: 'day' });
    expect(periodo.reduce((s, f) => s + parseInt(f.total, 10), 0)).toBe(4);
    expect(await q.estadisticasTiempoReal(ahora)).toEqual({ total: 4, abiertos: 1, enProceso: 1, resueltos: 1, slaVencidos: 1 });
    expect(() => q.ticketsPorPeriodo({ desde: ahora, truncar: "day'); DROP TABLE tickets; --" })).toThrow(/truncar inválido/);
  });
});
