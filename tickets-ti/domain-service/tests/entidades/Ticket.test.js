// Entidad Ticket, sus estados (patrón State) y objetos de valor: sin base de datos.
const Ticket = require('../../src/entidades/Ticket');
const { EstadoDeTicket, Abierto, Cerrado, ESTADOS_FINALES } = require('../../src/entidades/estados');
const { FabricaDeActores } = require('../../src/entidades/actores');
const IdTicket = require('../../src/valores/IdTicket');
const DatosDeTicket = require('../../src/valores/DatosDeTicket');
const VentanaSLA = require('../../src/valores/VentanaSLA');
const Prioridad = require('../../src/valores/Prioridad');
const Paginacion = require('../../src/valores/Paginacion');
const { ErrorDeValidacion, ErrorDeTransicion } = require('../../src/errores');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 60 * 60 * 1000;
const LUIS = FabricaDeActores.crear({ id: 10, nombre: 'Luis Usuario', rol: 'usuario' });
const ANA = { id: 20, nombre: 'Ana Técnica' };

const datos = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});
const abrir = (overrides, horas = 8) => Ticket.abrir({
  id: IdTicket.del(2026, 1), datos: new DatosDeTicket(datos(overrides)), solicitante: LUIS, ventanaSLA: VentanaSLA.desde(AHORA, horas),
});
// Ticket ya guardado en un estado dado, con técnico asignado
const en = (estado, overrides = {}) => Ticket.reconstruir({
  ...abrir().aInstantanea(), estado, tecnicoId: ANA.id, tecnico_nombre: ANA.nombre, ...overrides,
});

describe('Ticket.abrir (CP001)', () => {
  it('debería quedar abierto con snapshot del solicitante, sin técnico y con su SLA', () => {
    const t = abrir();
    expect(t.aInstantanea()).toMatchObject({
      id: 'TKT-2026-0001', estado: 'abierto', usuarioId: 10, usuario_nombre: 'Luis Usuario', tecnicoId: null, tecnico_nombre: null,
      reabierto: false, sla_alerta_enviada: false, sla_limite: new Date(AHORA.getTime() + 8 * HORA),
    });
    expect(t.estado).toBeInstanceOf(Abierto);
  });

  it('debería encapsular su estado: no hay propiedades públicas que asignar', () => {
    const t = abrir();
    t.estado = 'cerrado';
    expect(t.aInstantanea().estado).toBe('abierto');
    expect(Object.keys(t)).toEqual([]);
  });

  it.each([
    ['título vacío', { titulo: '  ' }, 'Título requerido'],
    ['sin descripción', { descripcion: undefined }, 'Descripción requerido'],
    ['tipo inválido', { tipo: 'queja' }, 'Tipo inválido: queja'],
    ['categoría inválida', { categoria: 'cafeteria' }, 'Categoría inválido: cafeteria'],
    ['prioridad inválida', { prioridad: 'urgente' }, 'Prioridad inválido: urgente'],
  ])('no debería aceptar %s', (_caso, overrides, mensaje) => {
    expect(() => new DatosDeTicket(datos(overrides))).toThrow(new ErrorDeValidacion(mensaje));
  });

  it('debería exigir IdTicket y DatosDeTicket, y prioridad media por defecto', () => {
    expect(() => Ticket.abrir({ id: 'TKT-2026-0001', datos: {} })).toThrow(TypeError);
    expect(new DatosDeTicket(datos({ prioridad: undefined })).prioridad.nombre).toBe('media');
  });
});

describe('Ticket.asignarA', () => {
  it('debería guardar el snapshot del técnico y pasar a asignado', () => {
    const t = abrir();
    t.asignarA(ANA);
    expect(t.aInstantanea()).toMatchObject({ estado: 'asignado', tecnicoId: 20, tecnico_nombre: 'Ana Técnica' });
  });

  it.each(['asignado', 'en_proceso', 'en_espera'])('debería permitir reasignar un ticket %s', (estado) => {
    const t = en(estado);
    t.asignarA({ id: 30, nombre: 'Beto' });
    expect(t.tecnico).toEqual({ id: 30, nombre: 'Beto' });
  });

  it.each(['resuelto', 'cerrado'])('no debería asignar un ticket %s', (estado) => {
    expect(() => en(estado).asignarA(ANA)).toThrow(ErrorDeTransicion);
  });

  it('no debería asignar un técnico sin nombre', () => {
    expect(() => abrir().asignarA({ id: 20 })).toThrow(ErrorDeValidacion);
  });
});

describe('Ticket.cambiarEstadoA (CP004, CP012)', () => {
  it.each([
    ['asignado', 'en_proceso'], ['en_proceso', 'en_espera'], ['en_espera', 'en_proceso'], ['en_proceso', 'resuelto'],
    ['resuelto', 'cerrado'], ['resuelto', 'abierto'], ['cerrado', 'abierto'],
  ])('debería permitir %s → %s', (desde, hacia) => {
    const t = en(desde);
    t.cambiarEstadoA(hacia);
    expect(t.estado.nombre).toBe(hacia);
  });

  it.each([
    ['abierto', 'cerrado', 'asignado'], ['asignado', 'cerrado', 'en_proceso'], ['en_espera', 'resuelto', 'en_proceso'],
  ])('debería rechazar %s → %s con el mensaje del contrato', (desde, hacia, permitidos) => {
    expect(() => en(desde).cambiarEstadoA(hacia)).toThrow(new ErrorDeTransicion(`Transición inválida: '${desde}' → '${hacia}'. Permitidos: ${permitidos}`));
  });

  it('debería rechazar un estado que no existe como error de validación', () => {
    expect(() => en('asignado').cambiarEstadoA('archivado')).toThrow(new ErrorDeValidacion('Estado inválido: archivado'));
  });
});

describe('Ticket.reabrir (CP005)', () => {
  const ventana = VentanaSLA.desde(new Date(AHORA.getTime() + 48 * HORA), 8);

  it.each(['resuelto', 'cerrado'])('debería reabrir un ticket %s y reiniciar el SLA', (estado) => {
    const t = en(estado, { sla_alerta_enviada: true });
    t.reabrir('Volvió a fallar', ventana);
    expect(t.aInstantanea()).toMatchObject({ estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a fallar', sla_alerta_enviada: false, sla_limite: ventana.limite });
  });

  it('no debería reabrir un ticket activo ni sin motivo', () => {
    expect(() => en('en_proceso').reabrir('x', ventana)).toThrow(new ErrorDeTransicion('Solo se pueden reabrir tickets resueltos o cerrados'));
    expect(() => en('resuelto').reabrir('', ventana)).toThrow(ErrorDeValidacion);
  });
});

describe('Ticket: edición, comentarios y SLA', () => {
  it('debería editar solo los campos editables y validarlos', () => {
    const t = en('asignado');
    t.actualizarDatos({ titulo: 'Nuevo', estado: 'cerrado', usuarioId: 999 });
    expect(t.aInstantanea()).toMatchObject({ titulo: 'Nuevo', estado: 'asignado', usuarioId: 10 });
    expect(() => t.actualizarDatos({ prioridad: 'urgente' })).toThrow(ErrorDeValidacion);
  });

  it('solo un ticket cerrado debería rechazar comentarios', () => {
    expect(en('resuelto').admiteComentarios()).toBe(true);
    expect(en('cerrado').admiteComentarios()).toBe(false);
  });

  it('CP010 - debería evaluar el SLA: 81% alerta, 0% no, vence y respeta el umbral', () => {
    const t = en('en_proceso');
    expect(t.evaluarSLA(new Date(AHORA.getTime() + 6.5 * HORA), 8)).toEqual({ porcentaje: 81.25, vencido: false, alertar: true });
    expect(t.evaluarSLA(AHORA, 8)).toEqual({ porcentaje: 0, vencido: false, alertar: false });
    expect(t.evaluarSLA(new Date(AHORA.getTime() + 9 * HORA), 8)).toMatchObject({ porcentaje: 100, vencido: true });
    expect(t.evaluarSLA(new Date(AHORA.getTime() + 6.5 * HORA), 8, 90).alertar).toBe(false);
  });

  it('no debería alertar ya alertado, sin técnico o en un estado final', () => {
    const tarde = new Date(AHORA.getTime() + 7 * HORA);
    const alertado = en('en_proceso');
    alertado.marcarAlertaSLAEnviada();
    expect(alertado.evaluarSLA(tarde, 8).alertar).toBe(false);
    expect(en('abierto', { tecnicoId: null }).evaluarSLA(tarde, 8).alertar).toBe(false);
    expect(en('resuelto').evaluarSLA(tarde, 8).alertar).toBe(false);
  });

  it('debería contar el SLA desde la reapertura y no desde la creación', () => {
    const reabiertoEn = new Date(AHORA.getTime() + 120 * HORA);
    const t = en('resuelto');
    t.reabrir('Otra vez', VentanaSLA.desde(reabiertoEn, 8));
    expect(t.evaluarSLA(new Date(reabiertoEn.getTime() + HORA), 8).porcentaje).toBeCloseTo(12.5);
  });
});

describe('Estados (patrón State)', () => {
  it('EstadoDeTicket debería ser abstracta y los finales salir de preguntarle a cada estado', () => {
    expect(() => new EstadoDeTicket()).toThrow(/abstracta/);
    expect(ESTADOS_FINALES).toEqual(['resuelto', 'cerrado']);
    expect(EstadoDeTicket.desde('cerrado')).toBeInstanceOf(Cerrado);
    expect(String(new Cerrado())).toBe('cerrado');
  });
});

describe('Objetos de valor', () => {
  it('IdTicket debería formatear, validar y compararse por valor', () => {
    expect(IdTicket.del(2026, 7).toString()).toBe('TKT-2026-0007');
    expect(IdTicket.del(2026, 12345).toString()).toBe('TKT-2026-12345');
    expect(IdTicket.del(2026, 7).equals(new IdTicket('TKT-2026-0007'))).toBe(true);
    expect(IdTicket.esValido('TKT-26-0001')).toBe(false);
    expect(() => IdTicket.del(2026, 0)).toThrow(/Correlativo inválido/);
    expect(() => IdTicket.del(26, 1)).toThrow(/Año inválido/);
    expect(() => new IdTicket('TICKET-1')).toThrow(/ID de ticket inválido/);
  });

  it.each([['critica', 4], ['alta', 8], ['media', 24], ['baja', 72]])('Prioridad %s debería dar %sh por defecto', (nombre, horas) => {
    expect(new Prioridad(nombre).horasDeSLA(null)).toBe(horas);
  });

  it('Prioridad debería priorizar la configuración y tener 24h si no se conoce', () => {
    expect(new Prioridad('alta').horasDeSLA({ tiempoHoras: 6 })).toBe(6);
    expect(Prioridad.horasPorDefecto(undefined)).toBe(24);
    expect(String(new Prioridad('baja'))).toBe('baja');
  });

  it('Paginacion debería normalizar y topar limit en 100', () => {
    const p = new Paginacion({ page: '2', limit: '5000' });
    expect([p.page, p.limit, p.offset]).toEqual([2, 100, 100]);
    expect(new Paginacion({ page: 'x' }).meta(7)).toEqual({ total: 7, page: 1, limit: 20, totalPages: 1 });
  });
});
