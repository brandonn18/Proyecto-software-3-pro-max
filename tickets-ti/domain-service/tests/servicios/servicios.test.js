// Servicios con repositorios en memoria y dobles: sin base de datos ni red.
const { crearEntorno, datosTicket, actor, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA } = require('./entorno');
const { esperarSegundoPlano } = require('../dobles');
const { ErrorIdDuplicado, ErrorDeAcceso, ErrorDeTransicion, ErrorDeValidacion, ErrorNoEncontrado } = require('../../src/errores');
const Notificador = require('../../src/servicios/Notificador');
const GestorDeTickets = require('../../src/servicios/GestorDeTickets');
const MonitorDeSLA = require('../../src/servicios/MonitorDeSLA');
const GeneradorDeReportes = require('../../src/servicios/GeneradorDeReportes');
const GestorDeComentarios = require('../../src/servicios/GestorDeComentarios');
const GestorDeConfiguracionSLA = require('../../src/servicios/GestorDeConfiguracionSLA');
const EstrategiaMenorCarga = require('../../src/servicios/EstrategiaMenorCarga');
const ServicioDeTickets = require('../../src/servicios/ServicioDeTickets');

const HORA = 3600000;

describe('GestorDeTickets.abrir (CP001)', () => {
  it('debería generar IDs correlativos con el año del reloj, auditar y notificar al creador', async () => {
    const e = crearEntorno();
    const t1 = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    const t2 = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    expect([t1.id, t2.id]).toEqual(['TKT-2026-0001', 'TKT-2026-0002']);
    expect(e.auditoria.de('TICKET_CREADO')[0].detalle).toEqual({ titulo: 'Impresora sin conexión', categoria: 'hardware', prioridad: 'alta' });
    expect(e.notificaciones.para(10)[0]).toMatchObject({ tipo: 'creacion', mensaje: `Tu ticket ${t1.id} "Impresora sin conexión" ha sido creado y será asignado a un técnico.` });
  });

  it('debería usar las horas de la configuración de SLA', async () => {
    const e = crearEntorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 6 }] });
    const t = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    expect(t.ventanaSLA.limite).toEqual(new Date(e.reloj.ahora().getTime() + 6 * HORA));
  });

  it('debería reintentar con el siguiente correlativo ante ErrorIdDuplicado, rendirse tras 10 y propagar otros errores', async () => {
    const e = crearEntorno();
    const original = e.tickets.guardarNuevo.bind(e.tickets);
    e.tickets.guardarNuevo = jest.fn().mockRejectedValueOnce(new ErrorIdDuplicado('TKT-2026-0001')).mockImplementation(original);
    expect((await e.servicios.tickets.abrir(datosTicket(), actor(LUIS))).id).toBe('TKT-2026-0002');
    e.tickets.guardarNuevo = jest.fn().mockRejectedValue(new ErrorIdDuplicado('x'));
    await expect(e.servicios.tickets.abrir(datosTicket(), actor(LUIS))).rejects.toThrow(/ID único/);
    e.tickets.guardarNuevo = jest.fn().mockRejectedValue(new Error('BD caída'));
    await expect(e.servicios.tickets.abrir(datosTicket(), actor(LUIS))).rejects.toThrow('BD caída');
  });

  it('debería rechazar datos inválidos sin guardar nada', async () => {
    const e = crearEntorno();
    await expect(e.servicios.tickets.abrir(datosTicket({ categoria: 'cafeteria' }), actor(LUIS))).rejects.toThrow(ErrorDeValidacion);
    expect(await e.tickets.contarDelAnio(2026)).toBe(0);
  });
});

describe('CP003 — AsignadorDeTecnicos (vía abrir)', () => {
  it('debería asignar al técnico activo con menor carga, sin contar los cerrados', async () => {
    const e = crearEntorno();
    e.tickets.sembrar({ id: 'TKT-2025-0001', estado: 'en_proceso', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    e.tickets.sembrar({ id: 'TKT-2025-0002', estado: 'cerrado', tecnicoId: BETO.id, tecnico_nombre: BETO.nombre });
    const t = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    expect(t.tecnico).toEqual({ id: BETO.id, nombre: 'Beto Técnico' });
    expect(e.canal.eventos).toContainEqual({ destino: 'tecnico:21', evento: 'ticket:nuevo', datos: { ticketId: t.id, titulo: 'Impresora sin conexión' } });
    expect(e.notificaciones.para(BETO.id)[0]).toMatchObject({ tipo: 'asignacion', mensaje: `Se te ha asignado automáticamente el ticket ${t.id}: Impresora sin conexión` });
  });

  it('nunca debería asignar a un técnico inactivo y debería dejarlo abierto si authcore no responde', async () => {
    const sinActivos = crearEntorno({ usuarios: [INACTIVO, LUIS] });
    expect((await sinActivos.servicios.tickets.abrir(datosTicket(), actor(LUIS))).estado.nombre).toBe('abierto');
    const caido = crearEntorno();
    caido.directorio.caido = true;
    expect((await caido.servicios.tickets.abrir(datosTicket(), actor(LUIS))).tecnico).toBeNull();
    expect(caido.logger.error).toHaveBeenCalled();
  });

  it('debería propagar errores del directorio que no son de disponibilidad', async () => {
    const e = crearEntorno();
    e.directorio.listarTecnicosActivos = jest.fn().mockRejectedValue(new TypeError('bug'));
    await expect(e.servicios.tickets.abrir(datosTicket(), actor(LUIS))).rejects.toThrow('bug');
  });

  it('EstrategiaMenorCarga debería desempatar por carga global y por orden', () => {
    const estrategia = new EstrategiaMenorCarga();
    expect(estrategia.elegir([{ tecnico: 'a', cargaCategoria: 1, cargaGlobal: 5 }, { tecnico: 'b', cargaCategoria: 1, cargaGlobal: 2 }])).toBe('b');
    expect(estrategia.elegir([{ tecnico: 'c', cargaCategoria: 0, cargaGlobal: 0 }, { tecnico: 'a', cargaCategoria: 0, cargaGlobal: 0 }])).toBe('c');
    expect(estrategia.elegir([])).toBeNull();
  });
});

describe('AsignadorDeTecnicos.asignarManualmente', () => {
  const sembrar = (e) => e.tickets.sembrar({ id: 'TKT-2026-0099', titulo: 'Router caído', categoria: 'red' });

  it('debería asignar, auditar tecnicoNombre, notificar con push y enviar email', async () => {
    const e = crearEntorno();
    sembrar(e);
    const t = await e.servicios.asignador.asignarManualmente('TKT-2026-0099', BETO.id, actor(ADMIN));
    await esperarSegundoPlano();
    expect(t.tecnico).toEqual({ id: 21, nombre: 'Beto Técnico' });
    expect(e.auditoria.de('TICKET_ASIGNADO')[0].detalle).toEqual({ tecnicoId: 21, tecnicoNombre: 'Beto Técnico' });
    expect(e.canal.eventos[0]).toMatchObject({ destino: 'usuario:21', evento: 'notificacion:nueva', datos: { mensaje: 'Se te ha asignado el ticket TKT-2026-0099: Router caído' } });
    expect(e.correo.enviarTicketAsignado).toHaveBeenCalledWith(expect.objectContaining({ email: 'beto@test' }), t);
  });

  it.each([['inexistente', 999], ['inactivo', INACTIVO.id], ['que no es técnico', LUIS.id]])('debería responder NO_ENCONTRADO con un técnico %s', async (_caso, id) => {
    const e = crearEntorno();
    sembrar(e);
    await expect(e.servicios.asignador.asignarManualmente('TKT-2026-0099', id, actor(ADMIN))).rejects.toThrow(new ErrorNoEncontrado('Técnico no encontrado o inactivo'));
  });

  it('no debería fallar si el email falla: lo registra en el logger', async () => {
    const e = crearEntorno();
    sembrar(e);
    e.correo.enviarTicketAsignado.mockRejectedValue(new Error('SMTP caído'));
    await expect(e.servicios.asignador.asignarManualmente('TKT-2026-0099', ANA.id, actor(ADMIN))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email asignación]', 'SMTP caído');
  });
});

describe('CicloDeVida', () => {
  const sembrar = (e, estado, overrides = {}) => e.tickets.sembrar({
    id: 'TKT-2026-0050', estado, prioridad: 'critica', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre, ...overrides,
  });

  it('CP004 - debería rechazar una transición inválida sin persistir ni auditar, y denegar a quien no puede', async () => {
    const e = crearEntorno();
    sembrar(e, 'asignado');
    await expect(e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'cerrado' }, actor(ANA))).rejects.toThrow(ErrorDeTransicion);
    await expect(e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'en_proceso' }, actor(BETO))).rejects.toThrow(new ErrorDeAcceso('Sin permiso para modificar este ticket'));
    expect((await e.tickets.buscarPorId('TKT-2026-0050')).estado.nombre).toBe('asignado');
    expect(e.auditoria.eventos).toHaveLength(0);
  });

  it('debería auditar, notificar, emitir y enviar email al resolver', async () => {
    const e = crearEntorno();
    sembrar(e, 'en_proceso');
    const t = await e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'resuelto', comentario: 'Listo' }, actor(ANA));
    await esperarSegundoPlano();
    expect(e.auditoria.de('CAMBIO_ESTADO')[0].detalle).toEqual({ de: 'en_proceso', a: 'resuelto', comentario: 'Listo' });
    expect(e.notificaciones.para(LUIS.id)[0]).toMatchObject({ tipo: 'resolucion', mensaje: 'Tu ticket TKT-2026-0050 ha sido resuelto.' });
    expect(e.canal.eventos).toEqual([{ destino: 'usuario:10', evento: 'ticket:estado_cambiado', datos: { ticketId: t.id, estadoAnterior: 'en_proceso', nuevoEstado: 'resuelto' } }]);
    expect(e.correo.enviarTicketResuelto).toHaveBeenCalledWith(expect.objectContaining({ email: 'luis@test' }), t);
  });

  it('no debería romper la resolución si authcore no responde para el email', async () => {
    const e = crearEntorno();
    sembrar(e, 'en_proceso');
    e.directorio.caido = true;
    await expect(e.servicios.cicloDeVida.cambiarEstado('TKT-2026-0050', { estado: 'resuelto' }, actor(ANA))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.correo.enviarTicketResuelto).not.toHaveBeenCalled();
    expect(e.logger.error).toHaveBeenCalled();
  });

  it('CP005 - debería reabrir para el dueño o el admin, reiniciando el SLA, y negarlo al técnico o a otro usuario', async () => {
    const e = crearEntorno();
    sembrar(e, 'resuelto', { sla_alerta_enviada: true, sla_limite: new Date(0) });
    await expect(e.servicios.cicloDeVida.reabrir('TKT-2026-0050', 'x', actor(ANA))).rejects.toThrow(new ErrorDeAcceso('Sin permiso para reabrir este ticket'));
    await expect(e.servicios.cicloDeVida.reabrir('TKT-2026-0050', 'x', actor(MARIA))).rejects.toThrow(ErrorDeAcceso);
    const t = await e.servicios.cicloDeVida.reabrir('TKT-2026-0050', 'Volvió a fallar', actor(LUIS));
    expect(t.aInstantanea()).toMatchObject({ estado: 'abierto', reabierto: true, sla_alerta_enviada: false, sla_limite: new Date(e.reloj.ahora().getTime() + 4 * HORA) });
    expect(e.auditoria.de('TICKET_REABIERTO')[0].detalle).toEqual({ motivo: 'Volvió a fallar' });
  });
});

describe('GestorDeTickets: consultas y edición', () => {
  const sembrarVarios = (e) => {
    e.tickets.sembrar({ id: 'TKT-2026-0001', titulo: 'Mouse roto' });
    e.reloj.avanzarHoras(1);
    e.tickets.sembrar({ id: 'TKT-2026-0002', titulo: 'Sin red', estado: 'asignado', usuarioId: MARIA.id, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    e.reloj.avanzarHoras(1);
    e.tickets.sembrar({ id: 'TKT-2026-0003', titulo: 'Office', estado: 'asignado', tecnicoId: BETO.id, tecnico_nombre: BETO.nombre });
  };

  it('debería listar según el actor (polimorfismo de filtroDeListado) y paginar', async () => {
    const e = crearEntorno();
    sembrarVarios(e);
    const todos = await e.servicios.tickets.listar({}, actor(ADMIN));
    expect([todos.items.map((t) => t.id), todos.meta]).toEqual([['TKT-2026-0003', 'TKT-2026-0002', 'TKT-2026-0001'], { total: 3, page: 1, limit: 20, totalPages: 1 }]);
    expect((await e.servicios.tickets.listar({ usuarioId: MARIA.id }, actor(LUIS))).items.map((t) => t.id)).toEqual(['TKT-2026-0003', 'TKT-2026-0001']);
    expect((await e.servicios.tickets.listar({}, actor(ANA))).items.map((t) => t.id)).toEqual(['TKT-2026-0002']);
    expect((await e.servicios.tickets.listar({ estado: 'asignado', search: 'office', prioridad: '', limit: '5000' }, actor(ADMIN))).meta.limit).toBe(100);
  });

  it('debería dar el detalle con historial y negarlo a otro usuario', async () => {
    const e = crearEntorno();
    const creado = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    const { ticket, historial } = await e.servicios.tickets.detalle(creado.id, actor(LUIS));
    expect([ticket.id, historial[0].accion]).toEqual([creado.id, 'TICKET_CREADO']);
    await expect(e.servicios.tickets.detalle(creado.id, actor(MARIA))).rejects.toThrow(new ErrorDeAcceso('Sin acceso a este ticket'));
  });

  it('debería editar solo campos editables y eliminar (lógico)', async () => {
    const e = crearEntorno({ usuarios: [LUIS] });
    const creado = await e.servicios.tickets.abrir(datosTicket(), actor(LUIS));
    const t = await e.servicios.tickets.actualizarDatos(creado.id, { titulo: 'Nuevo', estado: 'cerrado' });
    expect([t.titulo, t.estado.nombre]).toEqual(['Nuevo', 'abierto']);
    await e.servicios.tickets.eliminar(creado.id);
    await expect(e.servicios.tickets.detalle(creado.id, actor(ADMIN))).rejects.toThrow(ErrorNoEncontrado);
    await expect(e.servicios.tickets.eliminar(creado.id)).rejects.toThrow('Ticket no encontrado');
  });
});

describe('CP010 — MonitorDeSLA', () => {
  const sembrar = (e) => e.tickets.sembrar({
    id: 'TKT-2026-0010', estado: 'en_proceso', prioridad: 'alta', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre, sla_limite: new Date(e.reloj.ahora().getTime() + 8 * HORA),
  });

  it('debería alertar al 81% una sola vez: notificación, email, eventos y flag', async () => {
    const e = crearEntorno();
    sembrar(e);
    e.reloj.avanzarHoras(6.5);
    expect(await e.servicios.monitorSLA.verificar()).toBe(1);
    await esperarSegundoPlano();
    expect(e.notificaciones.para(ANA.id)[0]).toMatchObject({ tipo: 'sla_alerta', mensaje: expect.stringContaining('lleva el 81% del tiempo consumido') });
    expect(e.correo.enviarAlertaSLA).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@test' }), expect.anything(), 81.25);
    expect(e.canal.eventos.map((ev) => ev.destino)).toEqual(['usuario:20', 'tecnico:20', 'admins']);
    expect((await e.tickets.buscarPorId('TKT-2026-0010')).alertaSLAEnviada).toBe(true);
    expect(await e.servicios.monitorSLA.verificar()).toBe(0);
  });

  it('debería respetar el umbral y el porcentaje configurado', async () => {
    const e = crearEntorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 90 }] });
    sembrar(e);
    e.reloj.avanzarHoras(6.5);
    expect(await e.servicios.monitorSLA.verificar()).toBe(0);
    e.reloj.avanzarHoras(1);
    expect(await e.servicios.monitorSLA.verificar()).toBe(1);
  });

  it('debería alertar aunque falle el email', async () => {
    const e = crearEntorno();
    sembrar(e);
    e.correo.enviarAlertaSLA.mockRejectedValue(new Error('SMTP'));
    e.reloj.avanzarHoras(7);
    expect(await e.servicios.monitorSLA.verificar()).toBe(1);
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email SLA]', 'SMTP');
  });
});

describe('GeneradorDeReportes', () => {
  it('debería armar el resumen admin con técnicos activos del directorio', async () => {
    const e = crearEntorno({ reportes: { conteosGenerales: { totalTickets: 3, porEstado: [{ estado: 'abierto', total: '2' }, { estado: 'resuelto', total: '1' }], porPrioridad: [], porCategoria: [], slaVencidos: 1, slaCumplidos: 0, promedioResolucionHoras: '0.0' } } });
    expect(await e.servicios.reportes.resumenAdmin()).toMatchObject({ totalTickets: 3, abiertos: 2, resueltos: 1, enProceso: 0, tecnicosActivos: 2 });
  });

  it('debería incluir técnicos inactivos en rendimiento y armar por-tecnico desde el snapshot', async () => {
    const e = crearEntorno({ reportes: { metricasTecnico: { asignados: 2, resueltos: 1, slaVencidos: 0, promedioResolucionHoras: '1.5' }, conteoPorTecnico: [{ tecnicoId: 20, tecnico_nombre: 'Ana', total: 2 }, { tecnicoId: null, tecnico_nombre: null, total: 1 }] } });
    expect((await e.servicios.reportes.rendimientoTecnicos()).map((t) => t.nombre).sort()).toEqual(['Ana Técnica', 'Beto Técnico', 'Ciro Inactivo']);
    expect(await e.servicios.reportes.porTecnico()).toEqual([{ tecnicoId: 20, total: '2', tecnico: { nombre: 'Ana' } }, { tecnicoId: null, total: '1', tecnico: null }]);
  });

  it.each([['week', 7, 'day'], ['month', 30, 'day'], ['quarter', 90, 'week'], ['otro', 30, 'day']])('debería traducir %s a %s días por %s', async (periodo, dias, truncar) => {
    const e = crearEntorno();
    await e.servicios.reportes.ticketsPorPeriodo(periodo);
    expect(e.reportes.ticketsPorPeriodo).toHaveBeenCalledWith({ desde: new Date(e.reloj.ahora().getTime() - dias * 24 * HORA), truncar });
  });

  it('debería delegar los reportes simples y publicar estadísticas a los admins', async () => {
    const e = crearEntorno({ reportes: { estadisticasTiempoReal: { total: 5 } } });
    await Promise.all([e.servicios.reportes.dashboardTecnico(actor(ANA)), e.servicios.reportes.resumenUsuario(actor(LUIS)), e.servicios.reportes.cumplimientoSLA(), e.servicios.reportes.resumenGeneral(), e.servicios.reportes.estadoSLA()]);
    expect(e.reportes.dashboardTecnico).toHaveBeenCalledWith(20, e.reloj.ahora());
    expect(e.reportes.resumenUsuario).toHaveBeenCalledWith(10);
    await e.servicios.reportes.publicarEstadisticas();
    expect(e.canal.eventos).toEqual([{ destino: 'admins', evento: 'estadisticas:actualizadas', datos: { total: 5, tecnicosActivos: 2 } }]);
  });
});

describe('Notificador y GestorDeConfiguracionSLA', () => {
  it('debería listar la bandeja propia, contar y marcar', async () => {
    const e = crearEntorno();
    await e.servicios.notificador.notificar({ usuarioId: 10, tipo: 'creacion', mensaje: 'a', push: false });
    await e.servicios.notificador.notificar({ usuarioId: 20, tipo: 'asignacion', mensaje: 'b', push: false });
    expect((await e.servicios.notificador.bandejaDe(actor(LUIS))).meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    await expect(e.servicios.notificador.marcarLeida(2, actor(LUIS))).rejects.toThrow('Notificación no encontrada');
    await e.servicios.notificador.marcarLeida(1, actor(LUIS));
    expect(await e.servicios.notificador.contarNoLeidas(actor(LUIS))).toEqual({ unread: 0 });
    await e.servicios.notificador.marcarTodasLeidas(actor(ANA));
    expect(await e.servicios.notificador.contarNoLeidas(actor(ANA))).toEqual({ unread: 0 });
  });

  it('debería listar ordenado, ajustar solo horas y porcentaje y responder NO_ENCONTRADO', async () => {
    const e = crearEntorno({ slaConfigs: [{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }] });
    expect((await e.servicios.configuracionSLA.listar()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
    expect((await e.servicios.configuracionSLA.ajustar(1, { tiempo_horas: 48, prioridad: 'critica' })).aJSON()).toMatchObject({ prioridad: 'baja', tiempo_horas: 48 });
    await expect(e.servicios.configuracionSLA.ajustar(99, { tiempo_horas: 5 })).rejects.toThrow('Configuración SLA no encontrada');
  });
});

describe('GestorDeComentarios', () => {
  it('debería dejar comentar a participantes, nunca en un ticket cerrado, y leer solo a quien ve el ticket', async () => {
    const e = crearEntorno();
    e.tickets.sembrar({ id: 'TKT-2026-0001', estado: 'asignado', tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    const c = await e.servicios.comentarios.comentar('TKT-2026-0001', 'Voy', actor(ANA));
    expect(c.aJSON()).toMatchObject({ id: 1, texto: 'Voy', autor: { id: 20, rol: 'tecnico' } });
    await expect(e.servicios.comentarios.comentar('TKT-2026-0001', 'x', actor(BETO))).rejects.toThrow(ErrorDeAcceso);
    await expect(e.servicios.comentarios.listar('TKT-2026-0001', actor(MARIA))).rejects.toThrow('Sin acceso a este ticket');
    expect((await e.servicios.comentarios.listar('TKT-2026-0001', actor(LUIS))).map((x) => x.texto)).toEqual(['Voy']);
    e.tickets.sembrar({ id: 'TKT-2026-0002', estado: 'cerrado' });
    await expect(e.servicios.comentarios.comentar('TKT-2026-0002', 'x', actor(ADMIN))).rejects.toThrow(ErrorDeTransicion);
  });
});

describe('Inyección de dependencias', () => {
  it.each([
    ['Notificador', () => new Notificador({})],
    ['GestorDeTickets', () => new GestorDeTickets({})],
    ['MonitorDeSLA', () => new MonitorDeSLA({})],
    ['GeneradorDeReportes', () => new GeneradorDeReportes({})],
    ['GestorDeComentarios', () => new GestorDeComentarios({})],
    ['GestorDeConfiguracionSLA', () => new GestorDeConfiguracionSLA({})],
  ])('%s debería fallar al construirse sin sus dependencias', (_nombre, construir) => {
    expect(construir).toThrow(TypeError);
  });

  it('ServicioDeTickets debería ser abstracta', () => {
    const e = crearEntorno();
    expect(() => new ServicioDeTickets(e.tickets)).toThrow(/abstracta/);
  });
});
