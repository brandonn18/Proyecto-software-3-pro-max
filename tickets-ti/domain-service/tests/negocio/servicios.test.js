// Capa de NEGOCIO: servicios sobre la capa de datos real (PostgreSQL). En capas
// el negocio depende de los DAO concretos, así que se prueba con ellos; solo
// authcore, SMTP, Socket.io y el reloj son dobles.
const { crearDAOs } = require('../../src/datos');
const { crearServicios } = require('../../src/negocio');
const { ErrorIdDuplicado } = require('../../src/comun/errores');
const { RelojFijo, RealtimeEspia, EmailEspia, DirectorioEnMemoria, esperarSegundoPlano } = require('../dobles');
const { abrirBdDePrueba } = require('../datos/bdDePrueba');

const HORA = 3600000;
const ADMIN = { id: 1, nombre: 'Admin', rol: 'administrador' };
const ANA = { id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true };
const BETO = { id: 21, nombre: 'Beto Técnico', email: 'beto@test', rol: 'tecnico', activo: true };
const INACTIVO = { id: 22, nombre: 'Ciro Inactivo', email: 'ciro@test', rol: 'tecnico', activo: false };
const LUIS = { id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true };
const MARIA = { id: 11, nombre: 'María Usuaria', email: 'maria@test', rol: 'usuario', activo: true };
const actor = ({ id, nombre, rol }) => ({ id, nombre, rol });
const esErrorDominio = (codigo, mensaje) => expect.objectContaining({ name: 'ErrorDominio', codigo, ...(mensaje && { message: mensaje }) });

let bd;
let e;

beforeAll(async () => { bd = await abrirBdDePrueba(); });
afterAll(async () => { await bd.cerrar(); });

const entorno = async ({ usuarios = [ANA, BETO, INACTIVO, LUIS, MARIA], slaConfigs = [] } = {}) => {
  await bd.limpiar();
  if (slaConfigs.length) await bd.modelos.SLAConfig.bulkCreate(slaConfigs);
  const ctx = {
    reloj: new RelojFijo(), tiempoReal: new RealtimeEspia(), correo: new EmailEspia(),
    directorio: new DirectorioEnMemoria([...usuarios]), logger: { error: jest.fn() }, dao: crearDAOs(bd.modelos, bd.sequelize),
  };
  ctx.servicios = crearServicios({ ...ctx, jwtSecret: 'x' });
  return ctx;
};

const datosTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

const sembrar = (overrides) => e.dao.tickets.insertar({
  titulo: 'Sembrado', descripcion: 'x', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', estado: 'abierto',
  usuarioId: LUIS.id, usuario_nombre: LUIS.nombre, ...overrides,
});
const notificacionesDe = async (usuario) => (await e.dao.notificaciones.listarDe(usuario.id, { page: 1, limit: 50 })).items;
const accionesDe = async (ticketId) => (await e.dao.auditoria.listarPorTicket(ticketId)).map((a) => a.accion);

describe('ticketsService.crear', () => {
  it('CP001 - debería generar IDs correlativos con el año del reloj, auditar y notificar al creador', async () => {
    e = await entorno();
    const t1 = await e.servicios.tickets.crear(datosTicket(), actor(LUIS));
    const t2 = await e.servicios.tickets.crear(datosTicket(), actor(LUIS));
    expect([t1.id, t2.id]).toEqual(['TKT-2026-0001', 'TKT-2026-0002']);
    expect(await accionesDe(t1.id)).toEqual(['TICKET_CREADO']);
    expect((await notificacionesDe(LUIS)).map((n) => n.mensaje)).toContain(`Tu ticket ${t1.id} "Impresora sin conexión" ha sido creado y será asignado a un técnico.`);
  });

  it('CP001 - debería usar las horas de SLAConfig', async () => {
    e = await entorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 6 }] });
    const t = await e.servicios.tickets.crear(datosTicket(), actor(LUIS));
    expect(new Date(t.sla_limite)).toEqual(new Date(e.reloj.ahora().getTime() + 6 * HORA));
  });

  it('debería reintentar con el siguiente correlativo ante ErrorIdDuplicado y rendirse tras 10', async () => {
    e = await entorno();
    const original = e.dao.tickets.insertar;
    e.dao.tickets.insertar = jest.fn().mockRejectedValueOnce(new ErrorIdDuplicado('TKT-2026-0001')).mockImplementation(original);
    expect((await e.servicios.tickets.crear(datosTicket(), actor(LUIS))).id).toBe('TKT-2026-0002');
    e.dao.tickets.insertar = jest.fn().mockRejectedValue(new ErrorIdDuplicado('x'));
    await expect(e.servicios.tickets.crear(datosTicket(), actor(LUIS))).rejects.toThrow(/ID único/);
    e.dao.tickets.insertar = jest.fn().mockRejectedValue(new Error('BD caída'));
    await expect(e.servicios.tickets.crear(datosTicket(), actor(LUIS))).rejects.toThrow('BD caída');
  });

  it('debería rechazar datos inválidos sin guardar nada', async () => {
    e = await entorno();
    await expect(e.servicios.tickets.crear(datosTicket({ categoria: 'cafeteria' }), actor(LUIS))).rejects.toThrow(esErrorDominio('VALIDACION'));
    expect(await e.dao.tickets.contarDelAnio(2026)).toBe(0);
  });

  it('debería generar IDs únicos al crear en paralelo', async () => {
    e = await entorno();
    const creados = await Promise.all(Array.from({ length: 5 }, () => e.servicios.tickets.crear(datosTicket(), actor(LUIS))));
    expect(new Set(creados.map((t) => t.id)).size).toBe(5);
  });
});

describe('CP003 — asignacionService.automatica', () => {
  it('debería asignar al técnico activo con menor carga en la categoría', async () => {
    e = await entorno();
    await sembrar({ id: 'TKT-2025-0001', estado: 'en_proceso', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    expect(await e.servicios.tickets.crear(datosTicket(), actor(LUIS))).toMatchObject({ estado: 'asignado', tecnicoId: BETO.id });
  });

  it('no debería contar tickets cerrados como carga ni asignar a un inactivo', async () => {
    e = await entorno();
    await sembrar({ id: 'TKT-2025-0001', estado: 'cerrado', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    expect((await e.servicios.tickets.crear(datosTicket(), actor(LUIS))).tecnicoId).toBe(ANA.id);
    e = await entorno({ usuarios: [INACTIVO, LUIS] });
    expect(await e.servicios.tickets.crear(datosTicket(), actor(LUIS))).toMatchObject({ estado: 'abierto', tecnicoId: null });
  });

  it('CP006 - debería notificar sin push y emitir ticket:nuevo al técnico elegido', async () => {
    e = await entorno({ usuarios: [ANA, LUIS] });
    const t = await e.servicios.tickets.crear(datosTicket(), actor(LUIS));
    expect((await notificacionesDe(ANA))[0]).toMatchObject({ tipo: 'asignacion', mensaje: `Se te ha asignado automáticamente el ticket ${t.id}: Impresora sin conexión` });
    expect(e.tiempoReal.eventos).toEqual([{ destino: 'tecnico:20', evento: 'ticket:nuevo', datos: { ticketId: t.id, titulo: 'Impresora sin conexión' } }]);
  });

  it('debería dejar el ticket abierto si authcore no responde y propagar otros errores', async () => {
    e = await entorno();
    e.directorio.caido = true;
    expect(await e.servicios.tickets.crear(datosTicket(), actor(LUIS))).toMatchObject({ estado: 'abierto', tecnicoId: null });
    expect(e.logger.error).toHaveBeenCalled();
    e.directorio.caido = false;
    e.directorio.listarTecnicosActivos = jest.fn().mockRejectedValue(new TypeError('bug'));
    await expect(e.servicios.tickets.crear(datosTicket(), actor(LUIS))).rejects.toThrow('bug');
  });
});

describe('asignacionService.manual', () => {
  const sembrarAbierto = () => sembrar({ id: 'TKT-2026-0099', titulo: 'Router caído', categoria: 'red' });

  it('debería asignar, auditar tecnicoNombre, notificar con push y enviar email', async () => {
    e = await entorno();
    await sembrarAbierto();
    const t = await e.servicios.asignacion.manual('TKT-2026-0099', BETO.id, actor(ADMIN));
    await esperarSegundoPlano();
    expect(t).toMatchObject({ estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto Técnico' });
    expect((await e.dao.auditoria.listarPorTicket(t.id))[0].detalle).toEqual({ tecnicoId: 21, tecnicoNombre: 'Beto Técnico' });
    expect(e.tiempoReal.eventos[0]).toMatchObject({ destino: 'usuario:21', evento: 'notificacion:nueva' });
    expect(e.correo.enviarTicketAsignado).toHaveBeenCalledWith(expect.objectContaining({ email: 'beto@test' }), t);
  });

  it.each([['inexistente', 999], ['inactivo', INACTIVO.id], ['que no es técnico', LUIS.id]])(
    'debería responder NO_ENCONTRADO con un técnico %s', async (_caso, tecnicoId) => {
      e = await entorno();
      await sembrarAbierto();
      await expect(e.servicios.asignacion.manual('TKT-2026-0099', tecnicoId, actor(ADMIN)))
        .rejects.toThrow(esErrorDominio('NO_ENCONTRADO', 'Técnico no encontrado o inactivo'));
    });

  it('no debería fallar si el email falla: lo registra en el logger', async () => {
    e = await entorno();
    await sembrarAbierto();
    e.correo.enviarTicketAsignado.mockRejectedValue(new Error('SMTP caído'));
    await expect(e.servicios.asignacion.manual('TKT-2026-0099', ANA.id, actor(ADMIN))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email asignación]', 'SMTP caído');
  });
});

describe('cicloDeVidaService', () => {
  const sembrarAsignado = (estado) => sembrar({ id: 'TKT-2026-0050', estado, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre, prioridad: 'critica' });

  it('CP004 - debería rechazar una transición inválida sin persistir ni auditar', async () => {
    e = await entorno();
    await sembrarAsignado('asignado');
    await expect(e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'cerrado' }, actor(ANA))).rejects.toThrow(esErrorDominio('TRANSICION_INVALIDA'));
    expect((await e.dao.tickets.buscarPorId('TKT-2026-0050')).estado).toBe('asignado');
    expect(await accionesDe('TKT-2026-0050')).toEqual([]);
  });

  it('debería notificar, emitir y enviar email al resolver', async () => {
    e = await entorno();
    await sembrarAsignado('en_proceso');
    const t = await e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'resuelto', comentario: 'Listo' }, actor(ANA));
    await esperarSegundoPlano();
    expect((await e.dao.auditoria.listarPorTicket(t.id))[0].detalle).toEqual({ de: 'en_proceso', a: 'resuelto', comentario: 'Listo' });
    expect((await notificacionesDe(LUIS))[0]).toMatchObject({ tipo: 'resolucion', mensaje: 'Tu ticket TKT-2026-0050 ha sido resuelto.' });
    expect(e.tiempoReal.eventos).toEqual([{
      destino: 'usuario:10', evento: 'ticket:estado_cambiado', datos: { ticketId: t.id, estadoAnterior: 'en_proceso', nuevoEstado: 'resuelto' },
    }]);
    expect(e.correo.enviarTicketResuelto).toHaveBeenCalledWith(expect.objectContaining({ email: 'luis@test' }), t);
  });

  it('no debería romper la resolución si authcore no responde para el email', async () => {
    e = await entorno();
    await sembrarAsignado('en_proceso');
    e.directorio.caido = true;
    await expect(e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'resuelto' }, actor(ANA))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.correo.enviarTicketResuelto).not.toHaveBeenCalled();
    expect(e.logger.error).toHaveBeenCalled();
  });

  it('CP005 - debería reabrir para el dueño reiniciando el SLA desde el reloj, y denegar al técnico', async () => {
    e = await entorno();
    await sembrarAsignado('resuelto');
    await expect(e.servicios.cicloDeVida.reabrir('TKT-2026-0050', 'x', actor(ANA))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO'));
    const t = await e.servicios.cicloDeVida.reabrir('TKT-2026-0050', 'Volvió a fallar', actor(LUIS));
    expect(t).toMatchObject({ estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a fallar', sla_alerta_enviada: false });
    expect(new Date(t.sla_limite)).toEqual(new Date(e.reloj.ahora().getTime() + 4 * HORA));
    expect(await accionesDe(t.id)).toEqual(['TICKET_REABIERTO']);
  });
});

describe('CP010 — slaService.verificar', () => {
  const sembrarEnProceso = () => sembrar({
    id: 'TKT-2026-0010', estado: 'en_proceso', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre,
    sla_limite: new Date(e.reloj.ahora().getTime() + 8 * HORA),
  });

  it('debería alertar al 81% una sola vez: notificación, email, eventos y flag', async () => {
    e = await entorno();
    await sembrarEnProceso();
    e.reloj.avanzarHoras(6.5);
    expect(await e.servicios.sla.verificar()).toBe(1);
    await esperarSegundoPlano();
    expect((await notificacionesDe(ANA))[0]).toMatchObject({ tipo: 'sla_alerta', mensaje: expect.stringContaining('lleva el 81% del tiempo consumido') });
    expect(e.correo.enviarAlertaSLA).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@test' }), expect.anything(), 81.25);
    expect(e.tiempoReal.eventos.map((ev) => ev.destino)).toEqual(['usuario:20', 'tecnico:20', 'admins']);
    expect((await e.dao.tickets.buscarPorId('TKT-2026-0010')).sla_alerta_enviada).toBe(true);
    expect(await e.servicios.sla.verificar()).toBe(0);
  });

  it('debería respetar el umbral y el porcentaje de SLAConfig', async () => {
    e = await entorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 90 }] });
    await sembrarEnProceso();
    e.reloj.avanzarHoras(2);
    expect(await e.servicios.sla.verificar()).toBe(0);
    e.reloj.avanzarHoras(4.5);
    expect(await e.servicios.sla.verificar()).toBe(0);
    e.reloj.avanzarHoras(1);
    expect(await e.servicios.sla.verificar()).toBe(1);
  });

  it('debería alertar aunque falle el email', async () => {
    e = await entorno();
    await sembrarEnProceso();
    e.correo.enviarAlertaSLA.mockRejectedValue(new Error('SMTP'));
    e.reloj.avanzarHoras(7);
    expect(await e.servicios.sla.verificar()).toBe(1);
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email SLA]', 'SMTP');
  });
});

describe('slaService (configuración)', () => {
  beforeEach(async () => {
    e = await entorno({ slaConfigs: [{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }] });
  });

  it('debería listar ordenado y actualizar solo horas y porcentaje', async () => {
    expect((await e.servicios.sla.listarConfig()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    expect(await e.servicios.sla.actualizarConfig(1, { tiempo_horas: 48, porcentaje_alerta: 75, prioridad: 'critica' }))
      .toMatchObject({ prioridad: 'baja', tiempo_horas: 48, porcentaje_alerta: 75 });
  });

  it.each([[{ tiempo_horas: 0 }], [{ porcentaje_alerta: 101 }], [{ tiempo_horas: '8' }]])('debería rechazar %j', async (datos) => {
    await expect(e.servicios.sla.actualizarConfig(1, datos)).rejects.toThrow(esErrorDominio('VALIDACION'));
  });

  it('debería responder NO_ENCONTRADO si no existe', async () => {
    await expect(e.servicios.sla.actualizarConfig(99, { tiempo_horas: 5 })).rejects.toThrow('Configuración SLA no encontrada');
  });
});

describe('reportesService', () => {
  it.each([['week', 7, 'day'], ['month', 30, 'day'], ['quarter', 90, 'week'], ['otro', 30, 'day']])(
    'debería traducir el periodo %s a %s días por %s', async (periodo, dias, truncar) => {
      e = await entorno();
      e.dao.reportes.ticketsPorPeriodo = jest.fn().mockResolvedValue([]);
      await e.servicios.reportes.ticketsPorPeriodo(periodo);
      expect(e.dao.reportes.ticketsPorPeriodo).toHaveBeenCalledWith({ desde: new Date(e.reloj.ahora().getTime() - dias * 24 * HORA), truncar });
    });

  it('debería armar por-tecnico desde el snapshot y publicar estadísticas a los admins', async () => {
    e = await entorno({ usuarios: [ANA, INACTIVO, LUIS] });
    await e.servicios.tickets.crear(datosTicket(), actor(LUIS));
    await sembrar({ id: 'TKT-2025-0001' });
    expect(await e.servicios.reportes.porTecnico()).toEqual(expect.arrayContaining([
      { tecnicoId: 20, total: '1', tecnico: { nombre: 'Ana Técnica' } }, { tecnicoId: null, total: '1', tecnico: null },
    ]));
    e.tiempoReal.eventos = [];
    expect(await e.servicios.reportes.publicarEstadisticas()).toMatchObject({ total: 2, tecnicosActivos: 1 });
    expect(e.tiempoReal.eventos).toEqual([{ destino: 'admins', evento: 'estadisticas:actualizadas', datos: expect.objectContaining({ total: 2 }) }]);
  });
});
