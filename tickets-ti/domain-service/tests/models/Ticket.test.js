// MODELO Ticket: reglas de negocio y persistencia juntas (Active Record), por
// eso se prueban contra la base de prueba. authcore, SMTP, Socket.io y el
// reloj son dobles.
const { esperarSegundoPlano } = require('../dobles');
const { abrirBdDePrueba } = require('./bdDePrueba');
const { prepararEntorno, datosTicket, actor, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA } = require('./entorno');

const HORA = 3600000;
const esErrorDominio = (codigo, mensaje) => expect.objectContaining({ name: 'ErrorDominio', codigo, ...(mensaje && { message: mensaje }) });
let bd;
let Ticket;
let e;

beforeAll(async () => { bd = await abrirBdDePrueba(); ({ Ticket } = bd.modelos); });
afterAll(async () => { await bd.cerrar(); });

const sembrar = (overrides) => Ticket.create({
  id: 'TKT-2026-0050', titulo: 'PC lenta', descripcion: 'x', tipo: 'incidente', categoria: 'software', prioridad: 'critica',
  estado: 'abierto', usuarioId: LUIS.id, usuario_nombre: LUIS.nombre, sla_limite: e.reloj.ahora(), ...overrides,
});
const conTecnico = (estado, overrides = {}) => sembrar({ estado, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre, ...overrides });
const notificacionesDe = async (usuario) => bd.modelos.Notification.findAll({ where: { usuarioId: usuario.id }, order: [['id', 'ASC']] });
const acciones = async (id) => (await bd.modelos.AuditLog.historialDe(id)).map((a) => a.accion);

describe('Ticket.abrir (CP001)', () => {
  beforeEach(async () => { e = await prepararEntorno(bd); });

  it('debería generar IDs correlativos con el año del reloj, auditar y notificar al creador', async () => {
    const t1 = await Ticket.abrir(datosTicket(), actor(LUIS));
    const t2 = await Ticket.abrir(datosTicket(), actor(LUIS));
    expect([t1.id, t2.id]).toEqual(['TKT-2026-0001', 'TKT-2026-0002']);
    expect(t1).toMatchObject({ usuarioId: 10, usuario_nombre: 'Luis Usuario', reabierto: false, sla_alerta_enviada: false });
    expect(await acciones(t1.id)).toEqual(['TICKET_CREADO']);
    expect((await notificacionesDe(LUIS))[0].mensaje).toBe(`Tu ticket ${t1.id} "Impresora sin conexión" ha sido creado y será asignado a un técnico.`);
  });

  it('debería calcular el SLA con SLAConfig o con las horas por defecto y usar prioridad media', async () => {
    e = await prepararEntorno(bd, { slaConfigs: [{ prioridad: 'alta', tiempo_horas: 6 }] });
    expect((await Ticket.abrir(datosTicket(), actor(LUIS))).sla_limite).toEqual(new Date(e.reloj.ahora().getTime() + 6 * HORA));
    const media = await Ticket.abrir(datosTicket({ prioridad: undefined }), actor(LUIS));
    expect(media.prioridad).toBe('media');
    expect(media.sla_limite).toEqual(new Date(e.reloj.ahora().getTime() + 24 * HORA));
  });

  it.each([
    ['título vacío', { titulo: '  ' }, 'Título requerido'],
    ['tipo inválido', { tipo: 'queja' }, 'Tipo inválido: queja'],
    ['categoría inválida', { categoria: 'cafeteria' }, 'Categoría inválido: cafeteria'],
  ])('debería rechazar %s sin guardar nada', async (_caso, overrides, mensaje) => {
    await expect(Ticket.abrir(datosTicket(overrides), actor(LUIS))).rejects.toThrow(esErrorDominio('VALIDACION', mensaje));
    expect(await Ticket.count({ paranoid: false })).toBe(0);
  });

  it('debería no reutilizar el ID de un ticket eliminado y generar IDs únicos en paralelo', async () => {
    await (await Ticket.abrir(datosTicket(), actor(LUIS))).destroy();
    expect((await Ticket.abrir(datosTicket(), actor(LUIS))).id).toBe('TKT-2026-0002');
    const creados = await Promise.all(Array.from({ length: 5 }, () => Ticket.abrir(datosTicket(), actor(LUIS))));
    expect(new Set(creados.map((t) => t.id)).size).toBe(5);
  });

  it('debería propagar errores de la base que no son de ID duplicado', async () => {
    const espia = jest.spyOn(Ticket, 'create').mockRejectedValue(new Error('BD caída'));
    await expect(Ticket.abrir(datosTicket(), actor(LUIS))).rejects.toThrow('BD caída');
    espia.mockRestore();
  });

  it('debería rendirse tras 10 reintentos de ID duplicado', async () => {
    const duplicado = Object.assign(new Error('duplicado'), { name: 'SequelizeUniqueConstraintError' });
    const espia = jest.spyOn(Ticket, 'create').mockRejectedValue(duplicado);
    await expect(Ticket.abrir(datosTicket(), actor(LUIS))).rejects.toThrow(/ID único/);
    expect(espia).toHaveBeenCalledTimes(11);
    espia.mockRestore();
  });
});

describe('Asignación (CP003 y manual)', () => {
  beforeEach(async () => { e = await prepararEntorno(bd); });

  it('debería autoasignar al técnico activo con menor carga, sin contar cerrados', async () => {
    await conTecnico('en_proceso', { id: 'TKT-2025-0001', categoria: 'hardware' });
    await conTecnico('cerrado', { id: 'TKT-2025-0002', categoria: 'hardware', tecnicoId: BETO.id, tecnico_nombre: BETO.nombre });
    expect(await Ticket.abrir(datosTicket(), actor(LUIS))).toMatchObject({ estado: 'asignado', tecnicoId: BETO.id, tecnico_nombre: 'Beto Técnico' });
    expect(e.tiempoReal.eventos).toContainEqual(expect.objectContaining({ destino: 'tecnico:21', evento: 'ticket:nuevo' }));
  });

  it('debería dejar el ticket abierto sin técnicos activos o con authcore caído, y propagar otros errores', async () => {
    e = await prepararEntorno(bd, { usuarios: [INACTIVO, LUIS] });
    expect(await Ticket.abrir(datosTicket(), actor(LUIS))).toMatchObject({ estado: 'abierto', tecnicoId: null });
    e.directorio.caido = true;
    expect((await Ticket.abrir(datosTicket(), actor(LUIS))).estado).toBe('abierto');
    expect(e.logger.error).toHaveBeenCalled();
    e.directorio.caido = false;
    e.directorio.listarTecnicosActivos = jest.fn().mockRejectedValue(new TypeError('bug'));
    await expect(Ticket.abrir(datosTicket(), actor(LUIS))).rejects.toThrow('bug');
  });

  it('debería asignar a mano, auditar tecnicoNombre, notificar con push y enviar email', async () => {
    const t = await sembrar({});
    await t.asignarManual(BETO.id, actor(ADMIN));
    await esperarSegundoPlano();
    expect(t).toMatchObject({ estado: 'asignado', tecnicoId: 21, tecnico_nombre: 'Beto Técnico' });
    expect((await bd.modelos.AuditLog.historialDe(t.id))[0].detalle).toEqual({ tecnicoId: 21, tecnicoNombre: 'Beto Técnico' });
    expect(e.tiempoReal.eventos[0]).toMatchObject({ destino: 'usuario:21', evento: 'notificacion:nueva' });
    expect(e.correo.enviarTicketAsignado).toHaveBeenCalledWith(expect.objectContaining({ email: 'beto@test' }), t);
  });

  it.each([['inexistente', 999], ['inactivo', INACTIVO.id], ['que no es técnico', LUIS.id]])(
    'debería responder NO_ENCONTRADO con un técnico %s', async (_caso, tecnicoId) => {
      await expect((await sembrar({})).asignarManual(tecnicoId, actor(ADMIN))).rejects.toThrow(esErrorDominio('NO_ENCONTRADO', 'Técnico no encontrado o inactivo'));
    });

  it.each(['resuelto', 'cerrado'])('no debería asignar un ticket %s', async (estado) => {
    await expect((await conTecnico(estado)).asignarA(BETO)).rejects.toThrow(esErrorDominio('TRANSICION_INVALIDA'));
  });

  it('no debería fallar si el email falla: lo registra en el logger', async () => {
    e.correo.enviarTicketAsignado.mockRejectedValue(new Error('SMTP caído'));
    await expect((await sembrar({})).asignarManual(ANA.id, actor(ADMIN))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email asignación]', 'SMTP caído');
  });
});

describe('Ciclo de vida (CP004, CP005, CP012)', () => {
  beforeEach(async () => { e = await prepararEntorno(bd); });

  it.each([['asignado', 'en_proceso'], ['en_proceso', 'en_espera'], ['en_espera', 'en_proceso'], ['resuelto', 'cerrado'], ['cerrado', 'abierto']])(
    'debería permitir %s → %s', async (desde, hacia) => {
      expect((await (await conTecnico(desde)).cambiarEstado(hacia, null, actor(ADMIN))).estado).toBe(hacia);
    });

  it('CP004 - debería rechazar una transición inválida con el mensaje del contrato, sin persistir ni auditar', async () => {
    const t = await conTecnico('asignado');
    await expect(t.cambiarEstado('cerrado', null, actor(ANA)))
      .rejects.toThrow(esErrorDominio('TRANSICION_INVALIDA', "Transición inválida: 'asignado' → 'cerrado'. Permitidos: en_proceso"));
    await expect(t.cambiarEstado('archivado', null, actor(ANA))).rejects.toThrow(esErrorDominio('VALIDACION'));
    expect((await Ticket.findByPk(t.id)).estado).toBe('asignado');
    expect(await acciones(t.id)).toEqual([]);
  });

  it('debería denegar a un técnico que no es el asignado y al usuario', async () => {
    const t = await conTecnico('asignado');
    await expect(t.cambiarEstado('en_proceso', null, actor(BETO))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO', 'Sin permiso para modificar este ticket'));
    await expect(t.cambiarEstado('en_proceso', null, actor(LUIS))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO'));
  });

  it('debería auditar, notificar, emitir y enviar email al resolver', async () => {
    const t = await conTecnico('en_proceso');
    await t.cambiarEstado('resuelto', 'Listo', actor(ANA));
    await esperarSegundoPlano();
    expect((await bd.modelos.AuditLog.historialDe(t.id))[0].detalle).toEqual({ de: 'en_proceso', a: 'resuelto', comentario: 'Listo' });
    expect((await notificacionesDe(LUIS))[0]).toMatchObject({ tipo: 'resolucion', mensaje: 'Tu ticket TKT-2026-0050 ha sido resuelto.' });
    expect(e.tiempoReal.eventos).toEqual([{
      destino: 'usuario:10', evento: 'ticket:estado_cambiado', datos: { ticketId: t.id, estadoAnterior: 'en_proceso', nuevoEstado: 'resuelto' },
    }]);
    expect(e.correo.enviarTicketResuelto).toHaveBeenCalledWith(expect.objectContaining({ email: 'luis@test' }), t);
  });

  it('no debería romper la resolución si authcore no responde para el email', async () => {
    const t = await conTecnico('en_proceso');
    e.directorio.caido = true;
    await expect(t.cambiarEstado('resuelto', null, actor(ANA))).resolves.toBeDefined();
    await esperarSegundoPlano();
    expect(e.correo.enviarTicketResuelto).not.toHaveBeenCalled();
    expect(e.logger.error).toHaveBeenCalled();
  });

  it('CP005 - debería reabrir para el dueño reiniciando el SLA desde el reloj', async () => {
    const t = await conTecnico('resuelto', { sla_alerta_enviada: true });
    await t.reabrir('Volvió a fallar', actor(LUIS));
    expect(t).toMatchObject({ estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a fallar', sla_alerta_enviada: false });
    expect(t.sla_limite).toEqual(new Date(e.reloj.ahora().getTime() + 4 * HORA));
    expect((await bd.modelos.AuditLog.historialDe(t.id))[0].detalle).toEqual({ motivo: 'Volvió a fallar' });
  });

  it('CP005 - debería negar reabrir al técnico o a otro usuario, un ticket activo o sin motivo', async () => {
    const resuelto = await conTecnico('resuelto');
    await expect(resuelto.reabrir('x', actor(ANA))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO', 'Sin permiso para reabrir este ticket'));
    await expect(resuelto.reabrir('x', actor(MARIA))).rejects.toThrow(esErrorDominio('ACCESO_DENEGADO'));
    await expect(resuelto.reabrir('', actor(LUIS))).rejects.toThrow(esErrorDominio('VALIDACION'));
    await resuelto.update({ estado: 'en_proceso' });
    await expect(resuelto.reabrir('x', actor(ADMIN))).rejects.toThrow(esErrorDominio('TRANSICION_INVALIDA', 'Solo se pueden reabrir tickets resueltos o cerrados'));
  });

  it('debería editar solo campos editables y validarlos', async () => {
    const t = await conTecnico('asignado');
    await t.actualizarDatos({ titulo: 'Nuevo', estado: 'cerrado', usuarioId: 999, prioridad: undefined });
    expect(await Ticket.findByPk(t.id)).toMatchObject({ titulo: 'Nuevo', estado: 'asignado', usuarioId: LUIS.id });
    await expect(t.actualizarDatos({ prioridad: 'urgente' })).rejects.toThrow(esErrorDominio('VALIDACION'));
  });
});

describe('Consultas', () => {
  beforeEach(async () => {
    e = await prepararEntorno(bd);
    await sembrar({ id: 'TKT-2026-0001', titulo: 'Mouse roto', categoria: 'hardware' });
    await sembrar({ id: 'TKT-2026-0002', titulo: 'Sin red', estado: 'asignado', usuarioId: MARIA.id, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre });
    await sembrar({ id: 'TKT-2026-0003', titulo: 'Office 50%', estado: 'asignado', tecnicoId: BETO.id, tecnico_nombre: BETO.nombre });
  });

  it('debería listar por rol, sin dejar al usuario pedir tickets ajenos', async () => {
    expect((await Ticket.listarPara(actor(ADMIN))).total).toBe(3);
    expect((await Ticket.listarPara(actor(LUIS), { usuarioId: MARIA.id })).items.map((t) => t.id).sort()).toEqual(['TKT-2026-0001', 'TKT-2026-0003']);
    expect((await Ticket.listarPara(actor(ANA), { tecnicoId: BETO.id })).items.map((t) => t.id)).toEqual(['TKT-2026-0002']);
  });

  it('debería filtrar, buscar literal, ignorar vacíos y topar limit en 100', async () => {
    const pagina = await Ticket.listarPara(actor(ADMIN), { estado: 'asignado', search: 'office', prioridad: '', limit: '5000' });
    expect(pagina).toMatchObject({ total: 1, page: 1, limit: 100 });
    expect((await Ticket.listarPara(actor(ADMIN), { search: '%' })).total).toBe(1);
    expect((await Ticket.listarPara(actor(ADMIN), { search: '_' })).total).toBe(0);
    expect((await Ticket.listarPara(actor(ADMIN), { fechaDesde: '2000-01-01', fechaHasta: '2999-12-31' })).total).toBe(3);
  });

  it('debería exigir ver el ticket y responder NO_ENCONTRADO si no existe', async () => {
    expect(() => (Ticket.build({ usuarioId: LUIS.id })).exigirVer(actor(MARIA))).toThrow('Sin acceso a este ticket');
    await expect(Ticket.buscarOFallar('TKT-2026-9999')).rejects.toThrow(esErrorDominio('NO_ENCONTRADO', 'Ticket no encontrado'));
  });
});

describe('CP010 — Ticket.verificarSLA', () => {
  const sembrarEnProceso = () => conTecnico('en_proceso', { id: 'TKT-2026-0010', prioridad: 'alta', sla_limite: new Date(e.reloj.ahora().getTime() + 8 * HORA) });

  it('debería alertar al 81% una sola vez: notificación, email, eventos y flag', async () => {
    e = await prepararEntorno(bd);
    await sembrarEnProceso();
    e.reloj.avanzarHoras(6.5);
    expect(await Ticket.verificarSLA()).toBe(1);
    await esperarSegundoPlano();
    expect((await notificacionesDe(ANA))[0]).toMatchObject({ tipo: 'sla_alerta', mensaje: expect.stringContaining('lleva el 81% del tiempo consumido') });
    expect(e.correo.enviarAlertaSLA).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@test' }), expect.anything(), 81.25);
    expect(e.tiempoReal.eventos.map((ev) => ev.destino)).toEqual(['usuario:20', 'tecnico:20', 'admins']);
    expect((await Ticket.findByPk('TKT-2026-0010')).sla_alerta_enviada).toBe(true);
    expect(await Ticket.verificarSLA()).toBe(0);
  });

  it('debería respetar el umbral y el porcentaje de SLAConfig, y no alertar sin técnico', async () => {
    e = await prepararEntorno(bd, { slaConfigs: [{ prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 90 }] });
    await sembrarEnProceso();
    await sembrar({ id: 'TKT-2026-0011', prioridad: 'alta', sla_limite: new Date(e.reloj.ahora().getTime() + HORA) });
    e.reloj.avanzarHoras(6.5);
    expect(await Ticket.verificarSLA()).toBe(0);
    e.reloj.avanzarHoras(1);
    expect(await Ticket.verificarSLA()).toBe(1);
  });

  it('debería alertar aunque falle el email', async () => {
    e = await prepararEntorno(bd);
    await sembrarEnProceso();
    e.correo.enviarAlertaSLA.mockRejectedValue(new Error('SMTP'));
    e.reloj.avanzarHoras(7);
    expect(await Ticket.verificarSLA()).toBe(1);
    await esperarSegundoPlano();
    expect(e.logger.error).toHaveBeenCalledWith('[Email SLA]', 'SMTP');
  });
});
