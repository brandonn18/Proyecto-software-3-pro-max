// Resto de los MODELOS contra la base de prueba: AuditLog, Notification,
// SLAConfig, TicketComentario, Usuario y Reporte.
const { abrirBdDePrueba } = require('./bdDePrueba');
const { prepararEntorno, actor, ANA, BETO, INACTIVO, LUIS, MARIA } = require('./entorno');

const HORA = 3600000;
let bd;
let m;
let e;

beforeAll(async () => { bd = await abrirBdDePrueba(); m = bd.modelos; });
beforeEach(async () => { e = await prepararEntorno(bd); });
afterAll(async () => { await bd.cerrar(); });

const filaTicket = (n, overrides = {}) => ({
  id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `T${n}`, descripcion: 'x', tipo: 'incidente', categoria: 'hardware',
  prioridad: 'media', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis', sla_limite: new Date(Date.now() + 24 * HORA), ...overrides,
});

describe('AuditLog', () => {
  it('debería registrar con snapshot del actor y listar en orden', async () => {
    await m.AuditLog.registrar({ ticketId: 'T', actor: { id: 10, nombre: 'Luis' }, accion: 'TICKET_CREADO', detalle: { a: 1 } });
    await m.AuditLog.registrar({ ticketId: 'T', actor: null, accion: 'SISTEMA', detalle: {} });
    const historial = await m.AuditLog.historialDe('T');
    expect(historial.map((r) => [r.accion, r.usuarioId, r.usuario_nombre])).toEqual([['TICKET_CREADO', 10, 'Luis'], ['SISTEMA', null, null]]);
  });
});

describe('Notification', () => {
  const sembrar = async () => {
    await m.Notification.enviar({ usuarioId: 10, tipo: 'creacion', mensaje: 'a', push: false });
    await m.Notification.enviar({ usuarioId: 10, tipo: 'resolucion', mensaje: 'b', push: false });
    await m.Notification.enviar({ usuarioId: 20, tipo: 'asignacion', mensaje: 'c', push: true });
  };

  it('debería empujar notificacion:nueva solo con push', async () => {
    await sembrar();
    expect(e.tiempoReal.eventos).toEqual([{ destino: 'usuario:20', evento: 'notificacion:nueva', datos: expect.objectContaining({ id: 3, mensaje: 'c', leida: false }) }]);
  });

  it('debería listar las propias con no leídas primero, filtrar por tipo y paginar', async () => {
    await sembrar();
    await m.Notification.marcarLeidaDe(2, actor(LUIS));
    const bandeja = await m.Notification.bandejaDe(actor(LUIS));
    expect(bandeja).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(bandeja.items.map((n) => [n.mensaje, n.leida])).toEqual([['a', false], ['b', true]]);
    expect((await m.Notification.bandejaDe(actor(LUIS), { tipo: 'creacion', limit: '1' })).total).toBe(1);
  });

  it('debería contar, marcar todas solo del usuario y no marcar la de otro', async () => {
    await sembrar();
    await m.Notification.marcarTodasLeidasDe(actor(LUIS));
    expect(await m.Notification.contarNoLeidasDe(actor(LUIS))).toBe(0);
    expect(await m.Notification.contarNoLeidasDe(actor(ANA))).toBe(1);
    await expect(m.Notification.marcarLeidaDe(3, actor(LUIS))).rejects.toThrow('Notificación no encontrada');
  });
});

describe('SLAConfig', () => {
  beforeEach(async () => { await m.SLAConfig.bulkCreate([{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }]); });

  it('debería dar la regla configurada o la de por defecto', async () => {
    expect(await m.SLAConfig.reglaPara('critica')).toEqual({ horas: 4, porcentajeAlerta: 80 });
    expect(await m.SLAConfig.reglaPara('alta')).toEqual({ horas: 8, porcentajeAlerta: undefined });
  });

  it('debería listar ordenado y actualizar solo horas y porcentaje', async () => {
    expect((await m.SLAConfig.listarOrdenado()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    expect(await m.SLAConfig.actualizarPermitido(1, { tiempo_horas: 48, porcentaje_alerta: 75, prioridad: 'critica' }))
      .toMatchObject({ prioridad: 'baja', tiempo_horas: 48, porcentaje_alerta: 75 });
  });

  it.each([[{ tiempo_horas: 0 }], [{ porcentaje_alerta: 101 }], [{ tiempo_horas: '8' }]])('debería rechazar %j', async (datos) => {
    await expect(m.SLAConfig.actualizarPermitido(1, datos)).rejects.toThrow(expect.objectContaining({ codigo: 'VALIDACION' }));
  });

  it('debería responder NO_ENCONTRADO si no existe', async () => {
    await expect(m.SLAConfig.actualizarPermitido(99, { tiempo_horas: 5 })).rejects.toThrow('Configuración SLA no encontrada');
  });
});

describe('TicketComentario', () => {
  beforeEach(async () => { await m.Ticket.create(filaTicket(1, { estado: 'asignado', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre })); });

  it('debería guardar el autor como snapshot, limpiar el texto y listar en orden', async () => {
    const c = await m.TicketComentario.comentar('TKT-2026-0001', actor(LUIS), '  primero ');
    await m.TicketComentario.comentar('TKT-2026-0001', actor(ANA), 'segundo');
    expect(c).toMatchObject({ autorId: 10, autor_nombre: 'Luis Usuario', autor_rol: 'usuario', texto: 'primero' });
    expect((await m.TicketComentario.hiloDe('TKT-2026-0001', actor(LUIS))).map((x) => x.texto)).toEqual(['primero', 'segundo']);
  });

  it('debería exigir participar para comentar y poder ver para leer', async () => {
    await expect(m.TicketComentario.comentar('TKT-2026-0001', actor(BETO), 'x')).rejects.toThrow(expect.objectContaining({ codigo: 'ACCESO_DENEGADO' }));
    await expect(m.TicketComentario.hiloDe('TKT-2026-0001', actor(MARIA))).rejects.toThrow('Sin acceso a este ticket');
    await expect(m.TicketComentario.comentar('TKT-2026-9999', actor(LUIS), 'x')).rejects.toThrow('Ticket no encontrado');
  });

  it('debería rechazar texto vacío o largo y tickets cerrados', async () => {
    await expect(m.TicketComentario.comentar('TKT-2026-0001', actor(LUIS), '  ')).rejects.toThrow('El comentario no puede estar vacío');
    await expect(m.TicketComentario.comentar('TKT-2026-0001', actor(LUIS), 'a'.repeat(2001))).rejects.toThrow(/no puede superar 2000/);
    await m.Ticket.update({ estado: 'cerrado' }, { where: { id: 'TKT-2026-0001' } });
    await expect(m.TicketComentario.comentar('TKT-2026-0001', actor(LUIS), 'x')).rejects.toThrow(expect.objectContaining({ codigo: 'TRANSICION_INVALIDA' }));
  });
});

describe('Usuario', () => {
  it('debería leer del directorio y reconocer técnicos activos', async () => {
    expect(await m.Usuario.buscar(LUIS.id)).toMatchObject({ nombre: 'Luis Usuario' });
    expect((await m.Usuario.tecnicosActivos()).map((t) => t.id)).toEqual([ANA.id, BETO.id]);
    expect((await m.Usuario.tecnicos({ incluirInactivos: true })).map((t) => t.id)).toContain(INACTIVO.id);
    expect([ANA, INACTIVO, LUIS, null].map((p) => m.Usuario.esTecnicoActivo(p))).toEqual([true, false, false, false]);
  });
});

describe('Reporte', () => {
  const ahora = new Date();
  beforeEach(async () => {
    e.reloj.fecha = ahora;
    await m.Ticket.bulkCreate([
      filaTicket(1, { estado: 'en_proceso', tecnicoId: 20, tecnico_nombre: 'Ana' }),
      filaTicket(2, { estado: 'resuelto', tecnicoId: 20, tecnico_nombre: 'Ana', categoria: 'red' }),
      filaTicket(3, { estado: 'abierto', sla_limite: new Date(ahora.getTime() - 1000), prioridad: 'alta' }),
      filaTicket(4, { estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto', sla_limite: new Date(ahora.getTime() + HORA), sla_alerta_enviada: true }),
    ]);
  });

  it('debería calcular los conteos generales', async () => {
    const c = await m.Reporte.conteosGenerales();
    expect(c).toMatchObject({ totalTickets: 4, slaVencidos: 1, slaCumplidos: 1 });
    expect(c.porEstado).toEqual(expect.arrayContaining([{ estado: 'abierto', total: '1' }, { estado: 'resuelto', total: '1' }]));
    expect(c.promedioResolucionHoras).toMatch(/^\d+\.\d$/);
  });

  it('debería calcular métricas y dashboard del técnico y agrupar por técnico', async () => {
    expect(await m.Reporte.metricasTecnico(20)).toMatchObject({ asignados: 2, resueltos: 1, slaVencidos: 0 });
    expect(await m.Reporte.dashboardTecnico(21)).toMatchObject({ misTickets: 1, slaEnRiesgo: 1, slaVencidos: 0 });
    expect((await m.Reporte.conteoPorTecnico()).map((f) => [f.tecnicoId, f.tecnico_nombre, Number(f.total)]))
      .toEqual(expect.arrayContaining([[20, 'Ana', 2], [21, 'Beto', 1], [null, null, 1]]));
  });

  it('debería resumir usuario, SLA, general, cumplimiento, período y tiempo real', async () => {
    expect(await m.Reporte.resumenUsuario(10)).toMatchObject({ total: 4, abiertos: 3, enEspera: 0, resueltos: 1 });
    expect((await m.Reporte.resumenUsuario(999)).ultimaActividad).toBeNull();
    expect(await m.Reporte.estadoSLA()).toEqual({ vencidos: 1, enRiesgo: 1 });
    expect((await m.Reporte.resumenGeneral()).total).toBe(4);
    expect((await m.Reporte.cumplimientoSLA()).porPrioridad).toEqual(expect.arrayContaining([{ prioridad: 'alta', total: '1', vencidos: '1' }]));
    for (const periodo of ['week', 'month', 'quarter', 'siglo']) {
      // eslint-disable-next-line no-await-in-loop
      expect((await m.Reporte.ticketsPorPeriodo(periodo)).reduce((s, f) => s + parseInt(f.total, 10), 0)).toBe(4);
    }
    expect(await m.Reporte.estadisticasTiempoReal()).toEqual({ total: 4, abiertos: 1, enProceso: 1, resueltos: 1, slaVencidos: 1 });
  });

  it('no debería contar tickets creados antes del período', async () => {
    e.reloj.fecha = new Date(ahora.getTime() + 40 * 24 * HORA);
    expect(await m.Reporte.ticketsPorPeriodo('month')).toEqual([]);
    expect((await m.Reporte.ticketsPorPeriodo('quarter')).length).toBeGreaterThan(0);
  });
});
