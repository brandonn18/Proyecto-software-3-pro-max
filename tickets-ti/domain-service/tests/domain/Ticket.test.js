const { Ticket, errores } = require('../../src/domain');
const { AHORA, HORA, CREADOR, TECNICO, datosValidos, crearTicket, ticketEn } = require('./helpers');

const { CODIGOS } = errores;

const esperarErrorDominio = (fn, codigo, mensaje) => {
  expect(fn).toThrow(expect.objectContaining({ name: 'ErrorDominio', codigo }));
  if (mensaje) expect(fn).toThrow(mensaje);
};

describe('Ticket.crear', () => {
  it('CP001 - debería crear en estado abierto con snapshot del creador y sin técnico', () => {
    // Act
    const ticket = crearTicket();
    // Assert
    expect(ticket).toMatchObject({
      id: 'TKT-2026-0001', estado: 'abierto', usuarioId: CREADOR.id, usuario_nombre: 'Luis Usuario',
      tecnicoId: null, tecnico_nombre: null, reabierto: false, sla_alerta_enviada: false,
    });
  });

  it('CP001 - debería calcular sla_limite como ahora + horas', () => {
    const ticket = crearTicket({ prioridad: 'critica' }, { ahora: AHORA, horas: 4 });
    expect(ticket.sla_limite).toEqual(new Date(AHORA.getTime() + 4 * HORA));
  });

  it('debería usar prioridad media por defecto', () => {
    const sinPrioridad = datosValidos({ prioridad: undefined });
    expect(Ticket.crear(sinPrioridad, { ahora: AHORA, horas: 24 }).prioridad).toBe('media');
  });

  it.each(['hardware', 'software', 'red', 'accesos', 'servicios_ti'])(
    'CP002 - debería conservar la categoría "%s"', (categoria) => {
      expect(crearTicket({ categoria }).categoria).toBe(categoria);
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
    esperarErrorDominio(() => crearTicket(overrides), CODIGOS.VALIDACION, mensaje);
  });

  it('debería ser inmutable', () => {
    const ticket = crearTicket();
    expect(Object.isFrozen(ticket)).toBe(true);
    expect(() => { 'use strict'; ticket.estado = 'cerrado'; }).toThrow(TypeError);
  });
});

describe('Ticket.asignarA', () => {
  it('debería guardar tecnicoId y tecnico_nombre como snapshot y pasar a asignado', () => {
    const asignado = crearTicket().asignarA(TECNICO);
    expect(asignado).toMatchObject({ estado: 'asignado', tecnicoId: 20, tecnico_nombre: 'Ana Técnica' });
  });

  it('no debería modificar el ticket original', () => {
    const original = crearTicket();
    original.asignarA(TECNICO);
    expect(original.estado).toBe('abierto');
    expect(original.tecnicoId).toBeNull();
  });

  it.each(['asignado', 'en_proceso', 'en_espera'])('debería permitir reasignar un ticket %s', (estado) => {
    const otro = { id: 30, nombre: 'Beto Técnico' };
    expect(ticketEn(estado).asignarA(otro)).toMatchObject({ tecnicoId: 30, estado: 'asignado' });
  });

  it.each(['resuelto', 'cerrado'])('no debería asignar un ticket %s', (estado) => {
    esperarErrorDominio(() => ticketEn(estado).asignarA(TECNICO), CODIGOS.TRANSICION_INVALIDA);
  });

  it('no debería asignar un técnico sin nombre', () => {
    esperarErrorDominio(() => crearTicket().asignarA({ id: 20 }), CODIGOS.VALIDACION);
  });
});

describe('Ticket.cambiarEstado', () => {
  it.each([
    ['asignado', 'en_proceso'],
    ['en_proceso', 'en_espera'],
    ['en_espera', 'en_proceso'],
    ['en_proceso', 'resuelto'],
    ['resuelto', 'cerrado'],
    ['resuelto', 'abierto'],
    ['cerrado', 'abierto'],
  ])('CP004/CP012 - debería permitir %s → %s', (desde, hacia) => {
    expect(ticketEn(desde).cambiarEstado(hacia).estado).toBe(hacia);
  });

  it.each([
    ['abierto', 'cerrado', 'asignado'],
    ['abierto', 'resuelto', 'asignado'],
    ['asignado', 'cerrado', 'en_proceso'],
    ['en_espera', 'resuelto', 'en_proceso'],
  ])('CP004 - debería rechazar %s → %s con el mensaje del contrato', (desde, hacia, permitidos) => {
    esperarErrorDominio(
      () => ticketEn(desde).cambiarEstado(hacia),
      CODIGOS.TRANSICION_INVALIDA,
      `Transición inválida: '${desde}' → '${hacia}'. Permitidos: ${permitidos}`
    );
  });

  it('debería rechazar un estado que no existe como error de validación', () => {
    esperarErrorDominio(() => ticketEn('asignado').cambiarEstado('archivado'), CODIGOS.VALIDACION);
  });
});

describe('Ticket.reabrir', () => {
  const sla = { ahora: new Date(AHORA.getTime() + 48 * HORA), horas: 8 };

  it.each(['resuelto', 'cerrado'])('CP005 - debería reabrir un ticket %s y reiniciar el SLA', (estado) => {
    const reabierto = ticketEn(estado, { sla_alerta_enviada: true }).reabrir('Volvió a fallar', sla);
    expect(reabierto).toMatchObject({
      estado: 'abierto', reabierto: true, motivo_reapertura: 'Volvió a fallar', sla_alerta_enviada: false,
    });
    expect(reabierto.sla_limite).toEqual(new Date(sla.ahora.getTime() + 8 * HORA));
  });

  it('CP005 - no debería reabrir un ticket en_proceso', () => {
    esperarErrorDominio(
      () => ticketEn('en_proceso').reabrir('motivo', sla),
      CODIGOS.TRANSICION_INVALIDA,
      'Solo se pueden reabrir tickets resueltos o cerrados'
    );
  });

  it('no debería reabrir sin motivo', () => {
    esperarErrorDominio(() => ticketEn('resuelto').reabrir('', sla), CODIGOS.VALIDACION);
  });
});

describe('Ticket.actualizarDatos', () => {
  it('debería actualizar solo los campos editables', () => {
    const actualizado = ticketEn('en_proceso').actualizarDatos({ titulo: 'Nuevo título', prioridad: 'critica' });
    expect(actualizado).toMatchObject({ titulo: 'Nuevo título', prioridad: 'critica', estado: 'en_proceso' });
  });

  it('no debería permitir cambiar estado, usuarioId ni tecnicoId por edición directa', () => {
    const original = ticketEn('asignado');
    const actualizado = original.actualizarDatos({ estado: 'cerrado', usuarioId: 999, tecnicoId: 999, titulo: 'X' });
    expect(actualizado).toMatchObject({ estado: 'asignado', usuarioId: original.usuarioId, tecnicoId: original.tecnicoId, titulo: 'X' });
  });

  it('debería validar los valores nuevos', () => {
    esperarErrorDominio(() => ticketEn('abierto').actualizarDatos({ prioridad: 'urgente' }), CODIGOS.VALIDACION);
  });
});

describe('Ticket SLA', () => {
  it('debería marcar la alerta como enviada', () => {
    expect(ticketEn('asignado').marcarAlertaSLAEnviada().sla_alerta_enviada).toBe(true);
  });

  it('debería delegar la evaluación en la política de SLA', () => {
    const ticket = ticketEn('asignado');
    const { porcentaje } = ticket.evaluarSLA({ ahora: new Date(AHORA.getTime() + 4 * HORA), horas: 8 });
    expect(porcentaje).toBeCloseTo(50);
  });

  it('estaActivo debería ser false solo en resuelto y cerrado', () => {
    expect(ticketEn('en_espera').estaActivo()).toBe(true);
    expect(ticketEn('resuelto').estaActivo()).toBe(false);
    expect(ticketEn('cerrado').estaActivo()).toBe(false);
  });
});
