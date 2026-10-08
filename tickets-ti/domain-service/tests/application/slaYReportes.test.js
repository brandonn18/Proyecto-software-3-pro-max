const { crearEntorno, actor, esperarSegundoPlano, ANA, BETO, INACTIVO, LUIS } = require('./entorno');
const app = require('../../src/application');
const f = require('./fakes');

const HORA = 3600000;

describe('CP010 — VerificarSLA', () => {
  // Ticket alta (8h) asignado a Ana, con límite a 8h del reloj actual
  const sembrar = (deps, overrides = {}) => deps.ticketRepository.sembrar({
    id: 'TKT-2026-0010', titulo: 'Servidor', descripcion: 'x', tipo: 'incidente', categoria: 'hardware',
    prioridad: 'alta', estado: 'en_proceso', usuarioId: LUIS.id, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre,
    sla_alerta_enviada: false, sla_limite: new Date(deps.clock.ahora().getTime() + 8 * HORA), ...overrides,
  });

  it('debería alertar al 81%: notificación, email, eventos y marcar el flag', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps);
    deps.clock.avanzarHoras(6.5);
    const alertas = await casos.verificarSLA.ejecutar();
    await esperarSegundoPlano();
    expect(alertas).toBe(1);
    expect(deps.notificaciones.para(ANA.id)[0]).toMatchObject({ tipo: 'sla_alerta', mensaje: expect.stringContaining('lleva el 81% del tiempo consumido') });
    expect(deps.email.enviarAlertaSLA).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@test' }), expect.anything(), 81.25);
    expect(deps.realtime.eventos.map((e) => e.destino)).toEqual(['tecnico:20', 'admins']);
    expect((await deps.ticketRepository.buscarPorId('TKT-2026-0010')).sla_alerta_enviada).toBe(true);
  });

  it('no debería alertar dos veces el mismo ticket', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps);
    deps.clock.avanzarHoras(7);
    await casos.verificarSLA.ejecutar();
    expect(await casos.verificarSLA.ejecutar()).toBe(0);
  });

  it('no debería alertar por debajo del umbral', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps);
    deps.clock.avanzarHoras(2);
    expect(await casos.verificarSLA.ejecutar()).toBe(0);
  });

  it('debería usar el porcentaje y las horas de SLAConfig', async () => {
    const { casos, deps } = crearEntorno({ slaConfigs: [{ prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 90 }] });
    sembrar(deps);
    deps.clock.avanzarHoras(6.5);
    expect(await casos.verificarSLA.ejecutar()).toBe(0);
    deps.clock.avanzarHoras(1);
    expect(await casos.verificarSLA.ejecutar()).toBe(1);
  });

  it('debería alertar aunque falle el email', async () => {
    const { casos, deps } = crearEntorno();
    sembrar(deps);
    deps.email.enviarAlertaSLA.mockRejectedValue(new Error('SMTP'));
    deps.clock.avanzarHoras(7);
    expect(await casos.verificarSLA.ejecutar()).toBe(1);
    await esperarSegundoPlano();
    expect(deps.logger.error).toHaveBeenCalledWith('[Email SLA]', 'SMTP');
  });
});

describe('ConsultarReportes', () => {
  const crear = (respuestas) => {
    const clock = new f.RelojFijo();
    const reportes = f.crearReportesEspia(respuestas);
    const userDirectory = new f.DirectorioEnMemoria([ANA, BETO, INACTIVO, LUIS]);
    return { caso: new app.ConsultarReportes({ reportes, userDirectory, clock }), reportes, clock };
  };

  it('debería armar el resumen admin con técnicos activos del directorio', async () => {
    const { caso } = crear({
      conteosGenerales: {
        totalTickets: 3, porEstado: [{ estado: 'abierto', total: '2' }, { estado: 'resuelto', total: '1' }],
        porPrioridad: [], porCategoria: [], slaVencidos: 1, slaCumplidos: 0, promedioResolucionHoras: '0.0',
      },
    });
    expect(await caso.resumenAdmin()).toMatchObject({ totalTickets: 3, abiertos: 2, resueltos: 1, enProceso: 0, tecnicosActivos: 2, slaVencidos: 1 });
  });

  it('debería incluir técnicos inactivos en rendimiento', async () => {
    const { caso } = crear({ metricasTecnico: { asignados: 2, resueltos: 1, slaVencidos: 0, promedioResolucionHoras: '1.5' } });
    const data = await caso.rendimientoTecnicos();
    expect(data.map((t) => t.nombre).sort()).toEqual(['Ana Técnica', 'Beto Técnico', 'Ciro Inactivo']);
    expect(data[0]).toMatchObject({ ticketsAsignados: 2, ticketsResueltos: 1, slasCumplidos: 1, slasVencidos: 0 });
  });

  it.each([['week', 7, 'day'], ['month', 30, 'day'], ['quarter', 90, 'week'], ['otro', 30, 'day']])(
    'debería traducir el periodo %s a %s días por %s', async (periodo, dias, truncar) => {
      const { caso, reportes, clock } = crear({ ticketsPorPeriodo: [] });
      await caso.ticketsPorPeriodo(periodo);
      expect(reportes.ticketsPorPeriodo).toHaveBeenCalledWith({ desde: new Date(clock.ahora().getTime() - dias * 24 * HORA), truncar });
    });

  it('debería armar por-tecnico desde el snapshot, sin llamar al directorio', async () => {
    const { caso } = crear({ conteoPorTecnico: [{ tecnicoId: 20, tecnico_nombre: 'Ana Técnica', total: 2 }, { tecnicoId: null, tecnico_nombre: null, total: 1 }] });
    expect(await caso.porTecnico()).toEqual([
      { tecnicoId: 20, total: '2', tecnico: { nombre: 'Ana Técnica' } },
      { tecnicoId: null, total: '1', tecnico: null },
    ]);
  });

  it('debería delegar los reportes simples con el id del actor y el reloj', async () => {
    const { caso, reportes, clock } = crear({});
    await caso.dashboardTecnico(actor(ANA));
    await caso.resumenUsuario(actor(LUIS));
    await caso.cumplimientoSLA();
    await caso.resumenGeneral();
    await caso.estadoSLA();
    expect(reportes.dashboardTecnico).toHaveBeenCalledWith(20, clock.ahora());
    expect(reportes.resumenUsuario).toHaveBeenCalledWith(10);
    expect(reportes.cumplimientoSLA).toHaveBeenCalledWith(clock.ahora());
    expect(reportes.resumenGeneral).toHaveBeenCalled();
    expect(reportes.estadoSLA).toHaveBeenCalledWith(clock.ahora());
  });
});

describe('PublicarEstadisticas', () => {
  it('debería emitir a los admins las cifras más técnicos activos', async () => {
    const realtime = new f.RealtimeEspia();
    const caso = new app.PublicarEstadisticas({
      reportes: f.crearReportesEspia({ estadisticasTiempoReal: { total: 5, abiertos: 2, enProceso: 1, resueltos: 1, slaVencidos: 0 } }),
      userDirectory: new f.DirectorioEnMemoria([ANA, INACTIVO]),
      realtime,
      clock: new f.RelojFijo(),
    });
    await caso.ejecutar();
    expect(realtime.eventos).toEqual([{
      destino: 'admins', evento: 'estadisticas:actualizadas',
      datos: { total: 5, abiertos: 2, enProceso: 1, resueltos: 1, slaVencidos: 0, tecnicosActivos: 1 },
    }]);
  });
});

describe('BandejaNotificaciones', () => {
  const crear = async () => {
    const repo = new f.NotificacionesEnMemoria();
    await repo.notificar({ usuarioId: LUIS.id, tipo: 'creacion', mensaje: 'a' });
    await repo.notificar({ usuarioId: LUIS.id, tipo: 'resolucion', mensaje: 'b' });
    await repo.notificar({ usuarioId: ANA.id, tipo: 'asignacion', mensaje: 'c' });
    return new app.BandejaNotificaciones({ notificacionRepository: repo });
  };

  it('debería listar solo las propias con meta y filtrar por tipo', async () => {
    const bandeja = await crear();
    expect((await bandeja.listar(actor(LUIS))).meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    expect((await bandeja.listar(actor(LUIS), { tipo: 'resolucion' })).items).toHaveLength(1);
  });

  it('debería contar no leídas y marcarlas', async () => {
    const bandeja = await crear();
    await bandeja.marcarLeida(1, actor(LUIS));
    expect(await bandeja.contarNoLeidas(actor(LUIS))).toEqual({ unread: 1 });
    await bandeja.marcarTodasLeidas(actor(LUIS));
    expect(await bandeja.contarNoLeidas(actor(LUIS))).toEqual({ unread: 0 });
    expect(await bandeja.contarNoLeidas(actor(ANA))).toEqual({ unread: 1 });
  });

  it('no debería marcar la notificación de otro usuario', async () => {
    const bandeja = await crear();
    await expect(bandeja.marcarLeida(3, actor(LUIS))).rejects.toThrow('Notificación no encontrada');
  });
});

describe('GestionarSLAConfig', () => {
  const crear = () => new app.GestionarSLAConfig({
    slaConfigRepository: new f.SLAConfigEnMemoria([{ prioridad: 'baja', tiempo_horas: 72 }, { prioridad: 'critica', tiempo_horas: 4 }]),
  });

  it('debería listar ordenado por horas', async () => {
    expect((await crear().listar()).map((c) => c.prioridad)).toEqual(['critica', 'baja']);
  });

  it('debería actualizar solo tiempo_horas y porcentaje_alerta', async () => {
    const actualizado = await crear().actualizar(1, { tiempo_horas: 48, porcentaje_alerta: 75, prioridad: 'critica' });
    expect(actualizado).toMatchObject({ prioridad: 'baja', tiempo_horas: 48, porcentaje_alerta: 75 });
  });

  it.each([[{ tiempo_horas: 0 }], [{ porcentaje_alerta: 101 }], [{ tiempo_horas: '8' }]])(
    'debería rechazar %j', async (datos) => {
      await expect(crear().actualizar(1, datos)).rejects.toThrow(expect.objectContaining({ codigo: 'VALIDACION' }));
    });

  it('debería responder NO_ENCONTRADO si no existe', async () => {
    await expect(crear().actualizar(99, { tiempo_horas: 5 })).rejects.toThrow('Configuración SLA no encontrada');
  });
});

describe('Sin dependencias', () => {
  it.each(['ConsultarReportes', 'PublicarEstadisticas', 'BandejaNotificaciones', 'GestionarSLAConfig', 'VerificarSLA', 'AsignarTicket'])(
    '%s debería fallar al construirse sin sus puertos', (nombre) => {
      expect(() => new app[nombre]({})).toThrow(/no implementa/);
    });
});
