// Capa de NEGOCIO: reglas puras, sin base de datos ni HTTP.
const reglasTicket = require('../../src/negocio/reglas/reglasTicket');
const reglasComentarios = require('../../src/negocio/reglas/reglasComentarios');
const idTicket = require('../../src/negocio/reglas/idTicket');
const politicaSLA = require('../../src/negocio/reglas/politicaSLA');
const politicaAsignacion = require('../../src/negocio/reglas/politicaAsignacion');
const politicaAcceso = require('../../src/negocio/reglas/politicaAcceso');
const { CODIGOS } = require('../../src/comun/errores');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 60 * 60 * 1000;
const CREADOR = Object.freeze({ id: 10, nombre: 'Luis Usuario' });
const TECNICO = Object.freeze({ id: 20, nombre: 'Ana Técnica' });

const datosValidos = (overrides = {}) => ({
  id: 'TKT-2026-0001', titulo: 'Impresora sin conexión', descripcion: 'No imprime desde ayer',
  tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', creador: CREADOR, ...overrides,
});
const nuevo = (overrides = {}, sla = { ahora: AHORA, horas: 8 }) => reglasTicket.nuevoTicket(datosValidos(overrides), sla);
// Fila ya guardada en un estado dado, como la devolvería ticketsDAO
const filaEn = (estado, overrides = {}) => ({ ...nuevo(), estado, tecnicoId: TECNICO.id, tecnico_nombre: TECNICO.nombre, ...overrides });

const esperarErrorDominio = (fn, codigo, mensaje) => {
  expect(fn).toThrow(expect.objectContaining({ name: 'ErrorDominio', codigo }));
  if (mensaje) expect(fn).toThrow(mensaje);
};

describe('reglasTicket.nuevoTicket', () => {
  it('CP001 - debería armar la fila abierta con snapshot del creador y sin técnico', () => {
    expect(nuevo()).toMatchObject({
      id: 'TKT-2026-0001', estado: 'abierto', usuarioId: CREADOR.id, usuario_nombre: 'Luis Usuario',
      tecnicoId: null, tecnico_nombre: null, reabierto: false, sla_alerta_enviada: false,
    });
  });

  it('CP001 - debería calcular sla_limite como ahora + horas y usar prioridad media por defecto', () => {
    expect(nuevo({ prioridad: 'critica' }, { ahora: AHORA, horas: 4 }).sla_limite).toEqual(new Date(AHORA.getTime() + 4 * HORA));
    expect(nuevo({ prioridad: undefined }).prioridad).toBe('media');
  });

  it.each([
    ['título vacío', { titulo: '  ' }, /Título requerido/],
    ['sin descripción', { descripcion: undefined }, /Descripción requerido/],
    ['tipo inválido', { tipo: 'queja' }, /Tipo inválido/],
    ['categoría inválida', { categoria: 'cafeteria' }, /Categoría inválido/],
    ['prioridad inválida', { prioridad: 'urgente' }, /Prioridad inválido/],
    ['ID con formato inválido', { id: 'TICKET-1' }, /ID de ticket inválido/],
    ['creador sin id', { creador: { nombre: 'X' } }, /Usuario inválido/],
  ])('no debería crear con %s', (_caso, overrides, mensaje) => {
    esperarErrorDominio(() => nuevo(overrides), CODIGOS.VALIDACION, mensaje);
  });
});

describe('reglasTicket.cambiosDeAsignacion', () => {
  it('debería devolver el snapshot del técnico y el estado asignado, sin tocar la fila', () => {
    const fila = nuevo();
    expect(reglasTicket.cambiosDeAsignacion(fila, TECNICO)).toEqual({ tecnicoId: 20, tecnico_nombre: 'Ana Técnica', estado: 'asignado' });
    expect(fila).toMatchObject({ estado: 'abierto', tecnicoId: null });
  });

  it.each(['asignado', 'en_proceso', 'en_espera'])('debería permitir reasignar un ticket %s', (estado) => {
    expect(reglasTicket.cambiosDeAsignacion(filaEn(estado), { id: 30, nombre: 'Beto' })).toMatchObject({ tecnicoId: 30 });
  });

  it.each(['resuelto', 'cerrado'])('no debería asignar un ticket %s', (estado) => {
    esperarErrorDominio(() => reglasTicket.cambiosDeAsignacion(filaEn(estado), TECNICO), CODIGOS.TRANSICION_INVALIDA);
  });

  it('no debería asignar un técnico sin nombre', () => {
    esperarErrorDominio(() => reglasTicket.cambiosDeAsignacion(nuevo(), { id: 20 }), CODIGOS.VALIDACION);
  });
});

describe('reglasTicket.cambiosDeEstado', () => {
  it.each([
    ['asignado', 'en_proceso'], ['en_proceso', 'en_espera'], ['en_espera', 'en_proceso'], ['en_proceso', 'resuelto'],
    ['resuelto', 'cerrado'], ['resuelto', 'abierto'], ['cerrado', 'abierto'],
  ])('CP004/CP012 - debería permitir %s → %s', (desde, hacia) => {
    expect(reglasTicket.cambiosDeEstado(filaEn(desde), hacia)).toEqual({ estado: hacia });
  });

  it.each([
    ['abierto', 'cerrado', 'asignado'], ['abierto', 'resuelto', 'asignado'],
    ['asignado', 'cerrado', 'en_proceso'], ['en_espera', 'resuelto', 'en_proceso'],
  ])('CP004 - debería rechazar %s → %s con el mensaje del contrato', (desde, hacia, permitidos) => {
    esperarErrorDominio(
      () => reglasTicket.cambiosDeEstado(filaEn(desde), hacia),
      CODIGOS.TRANSICION_INVALIDA,
      `Transición inválida: '${desde}' → '${hacia}'. Permitidos: ${permitidos}`
    );
  });

  it('debería rechazar un estado que no existe como error de validación', () => {
    esperarErrorDominio(() => reglasTicket.cambiosDeEstado(filaEn('asignado'), 'archivado'), CODIGOS.VALIDACION);
  });
});

describe('reglasTicket.cambiosDeReapertura', () => {
  const sla = { ahora: new Date(AHORA.getTime() + 48 * HORA), horas: 8 };

  it.each(['resuelto', 'cerrado'])('CP005 - debería reabrir un ticket %s y reiniciar el SLA', (estado) => {
    const cambios = reglasTicket.cambiosDeReapertura(filaEn(estado, { sla_alerta_enviada: true }), 'Volvió a fallar', sla);
    expect(cambios).toEqual({
      estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a fallar', sla_alerta_enviada: false,
      sla_limite: new Date(sla.ahora.getTime() + 8 * HORA),
    });
  });

  it('CP005 - no debería reabrir un ticket en_proceso ni sin motivo', () => {
    esperarErrorDominio(() => reglasTicket.cambiosDeReapertura(filaEn('en_proceso'), 'x', sla), CODIGOS.TRANSICION_INVALIDA,
      'Solo se pueden reabrir tickets resueltos o cerrados');
    esperarErrorDominio(() => reglasTicket.cambiosDeReapertura(filaEn('resuelto'), '', sla), CODIGOS.VALIDACION);
  });
});

describe('reglasTicket.cambiosEditables y estaActivo', () => {
  it('debería dejar solo los campos editables', () => {
    expect(reglasTicket.cambiosEditables(filaEn('asignado'), { estado: 'cerrado', usuarioId: 999, titulo: 'X', prioridad: undefined }))
      .toEqual({ titulo: 'X' });
  });

  it('debería validar los valores nuevos', () => {
    esperarErrorDominio(() => reglasTicket.cambiosEditables(filaEn('abierto'), { prioridad: 'urgente' }), CODIGOS.VALIDACION);
  });

  it('estaActivo debería ser false solo en resuelto y cerrado', () => {
    expect(reglasTicket.estaActivo(filaEn('en_espera'))).toBe(true);
    expect(reglasTicket.estaActivo(filaEn('resuelto'))).toBe(false);
    expect(reglasTicket.estaActivo(filaEn('cerrado'))).toBe(false);
  });
});

describe('idTicket', () => {
  it('CP001 - debería formatear TKT-YYYY-NNNN y validar el formato', () => {
    expect(idTicket.formatear(2026, 7)).toBe('TKT-2026-0007');
    expect(idTicket.formatear(2026, 12345)).toBe('TKT-2026-12345');
    expect(idTicket.esValido('TKT-2026-0001')).toBe(true);
    expect(idTicket.esValido('TKT-26-0001')).toBe(false);
    expect(idTicket.prefijoDelAnio(2026)).toBe('TKT-2026-');
  });

  it('debería rechazar correlativos y años inválidos', () => {
    expect(() => idTicket.formatear(2026, 0)).toThrow(/Correlativo inválido/);
    expect(() => idTicket.formatear(26, 1)).toThrow(/Año inválido/);
  });
});

describe('CP010 — politicaSLA', () => {
  const evaluarA = (horasDespues, overrides = {}) => politicaSLA.evaluar(
    filaEn('en_proceso', { sla_limite: new Date(AHORA.getTime() + 8 * HORA), ...overrides }),
    { ahora: new Date(AHORA.getTime() + horasDespues * HORA), horas: 8 },
  );

  it.each([['critica', 4], ['alta', 8], ['media', 24], ['baja', 72], [undefined, 24]])(
    'horasPara debería usar %s → %sh sin configuración', (prioridad, horas) => {
      expect(politicaSLA.horasPara(prioridad, null)).toBe(horas);
    });

  it('horasPara debería priorizar la configuración', () => {
    expect(politicaSLA.horasPara('alta', { tiempo_horas: 6 })).toBe(6);
  });

  it('debería alertar con 6.5h de 8h consumidas, no al inicio, y topar en 100%', () => {
    expect(evaluarA(6.5)).toEqual({ porcentaje: 81.25, vencido: false, alertar: true });
    expect(evaluarA(0)).toEqual({ porcentaje: 0, vencido: false, alertar: false });
    expect(evaluarA(9)).toMatchObject({ porcentaje: 100, vencido: true });
  });

  it('no debería alertar si ya se envió, sin técnico o si está resuelto', () => {
    expect(evaluarA(7, { sla_alerta_enviada: true }).alertar).toBe(false);
    expect(evaluarA(7, { tecnicoId: null }).alertar).toBe(false);
    expect(evaluarA(7, { estado: 'resuelto' }).alertar).toBe(false);
  });

  it('debería contar el SLA desde la reapertura y no desde la creación', () => {
    const reabiertoEn = new Date(AHORA.getTime() + 120 * HORA);
    const fila = { ...filaEn('resuelto'), ...reglasTicket.cambiosDeReapertura(filaEn('resuelto'), 'Otra vez', { ahora: reabiertoEn, horas: 8 }) };
    const r = politicaSLA.evaluar(fila, { ahora: new Date(reabiertoEn.getTime() + HORA), horas: 8 });
    expect(r.porcentaje).toBeCloseTo(12.5);
  });
});

describe('CP003 — politicaAsignacion.elegirTecnico', () => {
  const ana = { id: 1, nombre: 'Ana' };
  const beto = { id: 2, nombre: 'Beto' };

  it('debería elegir menor carga en la categoría, desempatar por global y por orden', () => {
    expect(politicaAsignacion.elegirTecnico([{ tecnico: ana, cargaCategoria: 3, cargaGlobal: 3 }, { tecnico: beto, cargaCategoria: 0, cargaGlobal: 9 }])).toBe(beto);
    expect(politicaAsignacion.elegirTecnico([{ tecnico: ana, cargaCategoria: 1, cargaGlobal: 5 }, { tecnico: beto, cargaCategoria: 1, cargaGlobal: 2 }])).toBe(beto);
    expect(politicaAsignacion.elegirTecnico([{ tecnico: beto, cargaCategoria: 0, cargaGlobal: 0 }, { tecnico: ana, cargaCategoria: 0, cargaGlobal: 0 }])).toBe(beto);
  });

  it('debería devolver null sin técnicos', () => {
    expect(politicaAsignacion.elegirTecnico([])).toBeNull();
    expect(politicaAsignacion.elegirTecnico(undefined)).toBeNull();
  });
});

describe('politicaAcceso', () => {
  const fila = filaEn('asignado', { usuarioId: 10, tecnicoId: 20 });
  const admin = { id: 1, rol: 'administrador' };
  const tecnicoAsignado = { id: 20, rol: 'tecnico' };
  const otroTecnico = { id: 21, rol: 'tecnico' };
  const duenio = { id: 10, rol: 'usuario' };
  const otroUsuario = { id: 11, rol: 'usuario' };

  it('debería dejar ver al admin, a cualquier técnico y al dueño, no a otro usuario', () => {
    [admin, tecnicoAsignado, otroTecnico, duenio].forEach((actor) => expect(politicaAcceso.puedeVer(fila, actor)).toBe(true));
    expect(() => politicaAcceso.exigirVer(fila, otroUsuario)).toThrow('Sin acceso a este ticket');
  });

  it('debería dejar cambiar estado solo al admin y al técnico asignado', () => {
    expect(politicaAcceso.puedeCambiarEstado(fila, admin)).toBe(true);
    expect(politicaAcceso.puedeCambiarEstado(fila, duenio)).toBe(false);
    expect(() => politicaAcceso.exigirCambiarEstado(fila, otroTecnico)).toThrow('Sin permiso para modificar este ticket');
  });

  it('debería dejar reabrir solo al admin y al usuario dueño', () => {
    expect(politicaAcceso.puedeReabrir(fila, duenio)).toBe(true);
    expect(() => politicaAcceso.exigirReabrir(fila, tecnicoAsignado)).toThrow('Sin permiso para reabrir este ticket');
  });

  it('debería filtrar el listado por rol', () => {
    expect(politicaAcceso.filtroDeListado(duenio)).toEqual({ usuarioId: 10 });
    expect(politicaAcceso.filtroDeListado(tecnicoAsignado)).toEqual({ tecnicoId: 20 });
    expect(politicaAcceso.filtroDeListado(admin)).toEqual({});
  });
});

describe('reglasComentarios', () => {
  const fila = filaEn('asignado', { usuarioId: 10, tecnicoId: 20 });

  it('debería limpiar el texto y rechazar vacío o demasiado largo', () => {
    expect(reglasComentarios.validarTexto('  hola ')).toBe('hola');
    esperarErrorDominio(() => reglasComentarios.validarTexto('   '), CODIGOS.VALIDACION);
    esperarErrorDominio(() => reglasComentarios.validarTexto('a'.repeat(2001)), CODIGOS.VALIDACION);
  });

  it('debería dejar comentar solo a participantes y nunca en un ticket cerrado', () => {
    expect(() => reglasComentarios.exigirComentar(fila, { id: 20, rol: 'tecnico' })).not.toThrow();
    esperarErrorDominio(() => reglasComentarios.exigirComentar(fila, { id: 21, rol: 'tecnico' }), CODIGOS.ACCESO_DENEGADO);
    esperarErrorDominio(() => reglasComentarios.exigirComentar({ ...fila, estado: 'cerrado' }, { id: 1, rol: 'administrador' }), CODIGOS.TRANSICION_INVALIDA);
    esperarErrorDominio(() => reglasComentarios.exigirLeer(fila, { id: 11, rol: 'usuario' }), CODIGOS.ACCESO_DENEGADO);
  });
});
