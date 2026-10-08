const {
  crearEntorno, datosTicket, actor, esperarSegundoPlano, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA,
} = require('./entorno');
const { CrearTicket } = require('../../src/application');
const { ErrorIdDuplicado } = require('../../src/application/errores');

const esErrorDominio = (codigo, mensaje) => expect.objectContaining({ name: 'ErrorDominio', codigo, ...(mensaje && { message: mensaje }) });

describe('CrearTicket', () => {
  it('CP001 - debería generar TKT-YYYY-NNNN correlativo con el año del reloj', async () => {
    const { casos } = crearEntorno();
    const t1 = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    const t2 = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect([t1.id, t2.id]).toEqual(['TKT-2026-0001', 'TKT-2026-0002']);
  });

  it('CP001 - debería guardar el snapshot del creador y auditar TICKET_CREADO', async () => {
    const { casos, deps } = crearEntorno();
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket).toMatchObject({ usuarioId: 10, usuario_nombre: 'Luis Usuario' });
    expect(deps.auditoria.de('TICKET_CREADO')[0]).toMatchObject({
      ticketId: ticket.id, usuario: { id: 10, nombre: 'Luis Usuario' },
      detalle: { titulo: 'Impresora sin conexión', categoria: 'hardware', prioridad: 'alta' },
    });
  });

  it('CP001 - debería usar las horas de SLAConfig si existen', async () => {
    const { casos, deps } = crearEntorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 6 }] });
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket.sla_limite).toEqual(new Date(deps.clock.ahora().getTime() + 6 * 3600000));
  });

  it('CP006 - debería notificar al creador con el texto del monolito', async () => {
    const { casos, deps } = crearEntorno();
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(deps.notificaciones.para(10)).toEqual([expect.objectContaining({
      tipo: 'creacion', push: false, mensaje: `Tu ticket ${ticket.id} "Impresora sin conexión" ha sido creado y será asignado a un técnico.`,
    })]);
  });

  it('debería reintentar con el siguiente correlativo ante ErrorIdDuplicado', async () => {
    const { deps } = crearEntorno();
    const original = deps.ticketRepository.guardarNuevo.bind(deps.ticketRepository);
    deps.ticketRepository.guardarNuevo = jest.fn()
      .mockRejectedValueOnce(new ErrorIdDuplicado('TKT-2026-0001'))
      .mockImplementation(original);
    const ticket = await new CrearTicket(deps).ejecutar(datosTicket(), actor(LUIS));
    expect(ticket.id).toBe('TKT-2026-0002');
  });

  it('debería propagar errores que no son de ID duplicado', async () => {
    const { deps } = crearEntorno();
    deps.ticketRepository.guardarNuevo = jest.fn().mockRejectedValue(new Error('BD caída'));
    await expect(new CrearTicket(deps).ejecutar(datosTicket(), actor(LUIS))).rejects.toThrow('BD caída');
  });

  it('debería rendirse tras 10 reintentos', async () => {
    const { deps } = crearEntorno();
    deps.ticketRepository.guardarNuevo = jest.fn().mockRejectedValue(new ErrorIdDuplicado('x'));
    await expect(new CrearTicket(deps).ejecutar(datosTicket(), actor(LUIS))).rejects.toThrow(/ID único/);
  });

  it('debería rechazar datos inválidos sin guardar nada', async () => {
    const { casos, deps } = crearEntorno();
    await expect(casos.crear.ejecutar(datosTicket({ categoria: 'cafeteria' }), actor(LUIS))).rejects.toThrow(esErrorDominio('VALIDACION'));
    expect(await deps.ticketRepository.contarDelAnio(2026)).toBe(0);
  });

  it('debería fallar al construirse sin asignarAutomaticamente', () => {
    const { deps } = crearEntorno();
    expect(() => new CrearTicket({ ...deps, asignarAutomaticamente: undefined })).toThrow(/asignarAutomaticamente/);
  });

  it('debería fallar al construirse si falta un puerto', () => {
    const { deps } = crearEntorno();
    expect(() => new CrearTicket({ ...deps, clock: {} })).toThrow('La dependencia clock no implementa Clock: falta ahora');
  });
});

describe('CP003 — AsignarAutomaticamente (vía CrearTicket)', () => {
  it('debería asignar al técnico activo con menor carga en la categoría', async () => {
    const { casos, deps } = crearEntorno();
    deps.ticketRepository.sembrar({ id: 'TKT-2025-0001', estado: 'en_proceso', categoria: 'hardware', tecnicoId: ANA.id, prioridad: 'baja', usuarioId: 10 });
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket).toMatchObject({ estado: 'asignado', tecnicoId: BETO.id, tecnico_nombre: 'Beto Técnico' });
  });

  it('no debería contar tickets resueltos o cerrados como carga', async () => {
    const { casos, deps } = crearEntorno();
    deps.ticketRepository.sembrar({ id: 'TKT-2025-0001', estado: 'cerrado', categoria: 'hardware', tecnicoId: ANA.id, usuarioId: 10 });
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket.tecnicoId).toBe(ANA.id);
  });

  it('nunca debería asignar a un técnico inactivo', async () => {
    const { casos } = crearEntorno({ usuarios: [INACTIVO, LUIS] });
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket).toMatchObject({ estado: 'abierto', tecnicoId: null });
  });

  it('CP006 - debería notificar y emitir ticket:nuevo al técnico elegido', async () => {
    const { casos, deps } = crearEntorno({ usuarios: [ANA, LUIS] });
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(deps.notificaciones.para(ANA.id)[0]).toMatchObject({ push: false, mensaje: `Se te ha asignado automáticamente el ticket ${ticket.id}: Impresora sin conexión` });
    expect(deps.realtime.eventos).toContainEqual({ destino: 'tecnico:20', evento: 'ticket:nuevo', datos: { ticketId: ticket.id, titulo: 'Impresora sin conexión' } });
  });

  it('debería crear el ticket abierto y registrar el error si authcore no responde', async () => {
    const { casos, deps } = crearEntorno();
    deps.userDirectory.caido = true;
    const ticket = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    expect(ticket).toMatchObject({ estado: 'abierto', tecnicoId: null });
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('debería propagar errores del directorio que no son de disponibilidad', async () => {
    const { casos, deps } = crearEntorno();
    deps.userDirectory.listarTecnicosActivos = jest.fn().mockRejectedValue(new TypeError('bug'));
    await expect(casos.crear.ejecutar(datosTicket(), actor(LUIS))).rejects.toThrow('bug');
  });
});

describe('AsignarTicket (manual)', () => {
  const sembrarAbierto = (deps) => deps.ticketRepository.sembrar({
    id: 'TKT-2026-0099', titulo: 'Router caído', descripcion: 'x', tipo: 'incidente', categoria: 'red',
    prioridad: 'alta', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis Usuario', tecnicoId: null,
  });

  it('debería asignar, auditar tecnicoNombre, notificar y enviar email', async () => {
    const { casos, deps } = crearEntorno();
    sembrarAbierto(deps);
    const ticket = await casos.asignar.ejecutar('TKT-2026-0099', BETO.id, actor(ADMIN));
    await esperarSegundoPlano();
    expect(ticket).toMatchObject({ estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto Técnico' });
    expect(deps.auditoria.de('TICKET_ASIGNADO')[0].detalle).toEqual({ tecnicoId: 21, tecnicoNombre: 'Beto Técnico' });
    expect(deps.notificaciones.para(21)[0]).toMatchObject({ push: true, mensaje: 'Se te ha asignado el ticket TKT-2026-0099: Router caído' });
    expect(deps.email.enviarTicketAsignado).toHaveBeenCalledWith(expect.objectContaining({ id: 21, email: 'beto@test' }), ticket);
  });

  it.each([['inexistente', 999], ['inactivo', INACTIVO.id], ['que no es técnico', LUIS.id]])(
    'debería responder NO_ENCONTRADO con un técnico %s', async (_caso, tecnicoId) => {
      const { casos, deps } = crearEntorno();
      sembrarAbierto(deps);
      await expect(casos.asignar.ejecutar('TKT-2026-0099', tecnicoId, actor(ADMIN)))
        .rejects.toThrow(esErrorDominio('NO_ENCONTRADO', 'Técnico no encontrado o inactivo'));
    });

  it('debería responder NO_ENCONTRADO si el ticket no existe', async () => {
    const { casos } = crearEntorno();
    await expect(casos.asignar.ejecutar('TKT-2026-0404', ANA.id, actor(ADMIN))).rejects.toThrow(esErrorDominio('NO_ENCONTRADO', 'Ticket no encontrado'));
  });

  it('no debería fallar si el email falla: lo registra en el logger', async () => {
    const { casos, deps } = crearEntorno();
    sembrarAbierto(deps);
    deps.email.enviarTicketAsignado.mockRejectedValue(new Error('SMTP caído'));
    await expect(casos.asignar.ejecutar('TKT-2026-0099', ANA.id, actor(ADMIN))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(deps.logger.error).toHaveBeenCalledWith('[Email asignación]', 'SMTP caído');
  });
});

describe('CambiarEstadoTicket', () => {
  const sembrar = (deps, estado) => deps.ticketRepository.sembrar({
    id: 'TKT-2026-0050', titulo: 'PC lenta', descripcion: 'x', tipo: 'incidente', categoria: 'software',
    prioridad: 'media', estado, usuarioId: LUIS.id, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre,
  });

  it('CP004 - debería permitir al técnico asignado asignado→en_proceso y auditar', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'asignado');
    const t = await casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'en_proceso', comentario: 'Revisando' }, actor(ANA));
    expect(t.estado).toBe('en_proceso');
    expect(deps.auditoria.de('CAMBIO_ESTADO')[0].detalle).toEqual({ de: 'asignado', a: 'en_proceso', comentario: 'Revisando' });
  });

  it('debería denegar a un técnico que no es el asignado', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'asignado');
    await expect(casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'en_proceso' }, actor(BETO)))
      .rejects.toThrow(esErrorDominio('ACCESO_DENEGADO'));
  });

  it('CP004 - debería rechazar una transición inválida sin persistir ni auditar', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'asignado');
    await expect(casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'cerrado' }, actor(ANA)))
      .rejects.toThrow(esErrorDominio('TRANSICION_INVALIDA'));
    expect((await deps.ticketRepository.buscarPorId('TKT-2026-0050')).estado).toBe('asignado');
    expect(deps.auditoria.registros).toHaveLength(0);
  });

  it('debería notificar, emitir y enviar email al resolver', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'en_proceso');
    const t = await casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'resuelto' }, actor(ANA));
    await esperarSegundoPlano();
    expect(deps.notificaciones.para(LUIS.id)[0]).toMatchObject({ tipo: 'resolucion', push: false, mensaje: 'Tu ticket TKT-2026-0050 ha sido resuelto.' });
    expect(deps.realtime.eventos).toContainEqual({
      destino: 'usuario:10', evento: 'ticket:estado_cambiado', datos: { ticketId: t.id, estadoAnterior: 'en_proceso', nuevoEstado: 'resuelto' },
    });
    expect(deps.email.enviarTicketResuelto).toHaveBeenCalledWith(expect.objectContaining({ email: 'luis@test' }), t);
  });

  it('CP012 - debería permitir al admin cerrar un ticket resuelto sin notificar', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'resuelto');
    const t = await casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'cerrado' }, actor(ADMIN));
    expect(t.estado).toBe('cerrado');
    expect(deps.notificaciones.enviadas).toHaveLength(0);
  });

  it('no debería romper la resolución si authcore no responde para el email', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps, 'en_proceso');
    deps.userDirectory.caido = true;
    await expect(casos.cambiarEstado.ejecutar('TKT-2026-0050', { estado: 'resuelto' }, actor(ANA))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(deps.email.enviarTicketResuelto).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });
});

describe('CP005 — ReabrirTicket', () => {
  const sembrarResuelto = (deps) => deps.ticketRepository.sembrar({
    id: 'TKT-2026-0070', titulo: 'VPN', descripcion: 'x', tipo: 'incidente', categoria: 'red', prioridad: 'critica',
    estado: 'resuelto', usuarioId: LUIS.id, tecnicoId: ANA.id, sla_alerta_enviada: true, sla_limite: new Date(0),
  });

  it('debería reabrir para el dueño, reiniciar SLA desde ahora y auditar el motivo', async () => {
    const { casos, deps } = crearEntorno();
    sembrarResuelto(deps);
    const t = await casos.reabrir.ejecutar('TKT-2026-0070', 'Volvió a fallar', actor(LUIS));
    expect(t).toMatchObject({ estado: 'abierto', reabierto: true, sla_alerta_enviada: false });
    expect(t.sla_limite).toEqual(new Date(deps.clock.ahora().getTime() + 4 * 3600000));
    expect(deps.auditoria.de('TICKET_REABIERTO')[0].detalle).toEqual({ motivo: 'Volvió a fallar' });
  });

  it('debería permitir al admin', async () => {
    const { casos, deps } = crearEntorno();
    sembrarResuelto(deps);
    await expect(casos.reabrir.ejecutar('TKT-2026-0070', 'Revisión', actor(ADMIN))).resolves.toMatchObject({ estado: 'abierto' });
  });

  it.each([['otro usuario', MARIA], ['el técnico', ANA]])('debería denegar a %s', async (_caso, quien) => {
    const { casos, deps } = crearEntorno();
    sembrarResuelto(deps);
    await expect(casos.reabrir.ejecutar('TKT-2026-0070', 'x', actor(quien))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO'));
  });
});

describe('GestionarTicket', () => {
  const sembrarVarios = (deps) => {
    deps.ticketRepository.sembrar({ id: 'TKT-2026-0001', titulo: 'Mouse roto', estado: 'abierto', usuarioId: LUIS.id, tecnicoId: null, categoria: 'hardware', prioridad: 'baja' });
    deps.clock.avanzarHoras(1);
    deps.ticketRepository.sembrar({ id: 'TKT-2026-0002', titulo: 'Sin red', estado: 'asignado', usuarioId: MARIA.id, tecnicoId: ANA.id, categoria: 'red', prioridad: 'alta' });
    deps.clock.avanzarHoras(1);
    deps.ticketRepository.sembrar({ id: 'TKT-2026-0003', titulo: 'Office', estado: 'asignado', usuarioId: LUIS.id, tecnicoId: BETO.id, categoria: 'software', prioridad: 'media' });
  };

  it('debería listar al admin todo, del más reciente al más antiguo, con meta', async () => {
    const { casos, deps } = crearEntorno();
    sembrarVarios(deps);
    const { items, meta } = await casos.gestionar.listar({}, actor(ADMIN));
    expect(items.map((t) => t.id)).toEqual(['TKT-2026-0003', 'TKT-2026-0002', 'TKT-2026-0001']);
    expect(meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
  });

  it('no debería dejar que un usuario vea tickets ajenos aunque lo pida por query', async () => {
    const { casos, deps } = crearEntorno();
    sembrarVarios(deps);
    const { items } = await casos.gestionar.listar({ usuarioId: MARIA.id }, actor(LUIS));
    expect(items.map((t) => t.usuarioId)).toEqual([LUIS.id, LUIS.id]);
  });

  it('debería mostrar al técnico solo sus asignados', async () => {
    const { casos, deps } = crearEntorno();
    sembrarVarios(deps);
    const { items } = await casos.gestionar.listar({}, actor(ANA));
    expect(items.map((t) => t.id)).toEqual(['TKT-2026-0002']);
  });

  it('debería aplicar filtros, ignorar vacíos y topar limit en 100', async () => {
    const { casos, deps } = crearEntorno();
    sembrarVarios(deps);
    const { items, meta } = await casos.gestionar.listar({ estado: 'asignado', search: 'office', prioridad: '', limit: '5000' }, actor(ADMIN));
    expect(items.map((t) => t.id)).toEqual(['TKT-2026-0003']);
    expect(meta.limit).toBe(100);
  });

  it('debería devolver ticket y auditorías al obtener', async () => {
    const { casos } = crearEntorno();
    const creado = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    const { ticket, auditorias } = await casos.gestionar.obtener(creado.id, actor(LUIS));
    expect(ticket.id).toBe(creado.id);
    expect(auditorias[0]).toMatchObject({ accion: 'TICKET_CREADO', usuario: { id: 10, nombre: 'Luis Usuario' } });
  });

  it('debería denegar el detalle a otro usuario', async () => {
    const { casos } = crearEntorno();
    const creado = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    await expect(casos.gestionar.obtener(creado.id, actor(MARIA))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO', 'Sin acceso a este ticket'));
  });

  it('debería actualizar solo campos editables', async () => {
    const { casos } = crearEntorno({ usuarios: [LUIS] });
    const creado = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    const t = await casos.gestionar.actualizarDatos(creado.id, { titulo: 'Nuevo', estado: 'cerrado', usuarioId: 999 });
    expect(t).toMatchObject({ titulo: 'Nuevo', estado: 'abierto', usuarioId: LUIS.id });
  });

  it('debería eliminar (lógico) y luego no encontrarlo', async () => {
    const { casos } = crearEntorno();
    const creado = await casos.crear.ejecutar(datosTicket(), actor(LUIS));
    await casos.gestionar.eliminar(creado.id);
    await expect(casos.gestionar.obtener(creado.id, actor(ADMIN))).rejects.toThrow(esErrorDominio('NO_ENCONTRADO'));
    await expect(casos.gestionar.eliminar(creado.id)).rejects.toThrow(esErrorDominio('NO_ENCONTRADO'));
  });
});
