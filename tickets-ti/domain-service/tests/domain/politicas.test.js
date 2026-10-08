const { politicaSLA, politicaAsignacion, politicaAcceso, idTicket, errores } = require('../../src/domain');
const { AHORA, HORA, ticketEn } = require('./helpers');

describe('idTicket', () => {
  it('CP001 - debería formatear TKT-YYYY-NNNN con ceros a la izquierda', () => {
    expect(idTicket.formatear(2026, 7)).toBe('TKT-2026-0007');
    expect(idTicket.formatear(2026, 12345)).toBe('TKT-2026-12345');
  });

  it('debería rechazar correlativos y años inválidos', () => {
    expect(() => idTicket.formatear(2026, 0)).toThrow(/Correlativo inválido/);
    expect(() => idTicket.formatear(26, 1)).toThrow(/Año inválido/);
  });

  it('debería validar el formato', () => {
    expect(idTicket.esValido('TKT-2026-0001')).toBe(true);
    expect(idTicket.esValido('TKT-26-0001')).toBe(false);
    expect(idTicket.esValido(null)).toBe(false);
    expect(idTicket.prefijoDelAnio(2026)).toBe('TKT-2026-');
  });
});

describe('politicaSLA.horasPara', () => {
  it('debería priorizar la configuración sobre los valores por defecto', () => {
    expect(politicaSLA.horasPara('alta', { tiempo_horas: 6 })).toBe(6);
  });

  it.each([['critica', 4], ['alta', 8], ['media', 24], ['baja', 72], [undefined, 24]])(
    'debería usar %s → %sh sin configuración', (prioridad, horas) => {
      expect(politicaSLA.horasPara(prioridad, null)).toBe(horas);
    });
});

describe('CP010 — politicaSLA.evaluar', () => {
  // El ticket se creó en AHORA con 8h de SLA; se evalúa `horasDespues` más tarde
  const evaluarA = (horasDespues, overrides = {}) => {
    const ticket = ticketEn('en_proceso', { sla_limite: new Date(AHORA.getTime() + 8 * HORA), ...overrides });
    return politicaSLA.evaluar(ticket, { ahora: new Date(AHORA.getTime() + horasDespues * HORA), horas: 8 });
  };

  it('debería alertar con 6.5h de 8h consumidas (81%)', () => {
    expect(evaluarA(6.5)).toEqual({ porcentaje: 81.25, vencido: false, alertar: true });
  });

  it('debería calcular 0% al inicio y no alertar', () => {
    expect(evaluarA(0)).toEqual({ porcentaje: 0, vencido: false, alertar: false });
  });

  it('debería alertar justo en el umbral del 80%', () => {
    expect(evaluarA(6.4).alertar).toBe(true);
  });

  it('debería topar en 100% y marcar vencido cuando expiró', () => {
    expect(evaluarA(9)).toMatchObject({ porcentaje: 100, vencido: true });
  });

  it('no debería alertar si la alerta ya fue enviada', () => {
    expect(evaluarA(7, { sla_alerta_enviada: true }).alertar).toBe(false);
  });

  it('no debería alertar un ticket sin técnico asignado', () => {
    expect(evaluarA(7, { tecnicoId: null }).alertar).toBe(false);
  });

  it.each(['resuelto', 'cerrado'])('no debería alertar un ticket %s', (estado) => {
    expect(evaluarA(7, { estado }).alertar).toBe(false);
  });

  it('debería respetar un porcentaje de alerta configurado', () => {
    const ticket = ticketEn('en_proceso', { sla_limite: new Date(AHORA.getTime() + 8 * HORA) });
    const r = politicaSLA.evaluar(ticket, { ahora: new Date(AHORA.getTime() + 6.5 * HORA), horas: 8, porcentajeAlerta: 90 });
    expect(r.alertar).toBe(false);
  });

  it('debería contar el SLA desde la reapertura y no desde la creación', () => {
    // Creado hace 5 días, reabierto hace 1h con SLA de 8h → 12.5%, no 100%
    const reabiertoEn = new Date(AHORA.getTime() + 120 * HORA);
    const ticket = ticketEn('resuelto').reabrir('Volvió a fallar', { ahora: reabiertoEn, horas: 8 }).asignarA({ id: 20, nombre: 'Ana' });
    const r = politicaSLA.evaluar(ticket, { ahora: new Date(reabiertoEn.getTime() + HORA), horas: 8 });
    expect(r.porcentaje).toBeCloseTo(12.5);
    expect(r.alertar).toBe(false);
  });
});

describe('CP003 — politicaAsignacion.elegirTecnico', () => {
  const ana = { id: 1, nombre: 'Ana' };
  const beto = { id: 2, nombre: 'Beto' };
  const carla = { id: 3, nombre: 'Carla' };

  it('debería elegir al técnico con menor carga en la categoría', () => {
    const elegido = politicaAsignacion.elegirTecnico([
      { tecnico: ana, cargaCategoria: 3, cargaGlobal: 3 },
      { tecnico: beto, cargaCategoria: 0, cargaGlobal: 9 },
    ]);
    expect(elegido).toBe(beto);
  });

  it('debería desempatar por carga global', () => {
    const elegido = politicaAsignacion.elegirTecnico([
      { tecnico: ana, cargaCategoria: 1, cargaGlobal: 5 },
      { tecnico: beto, cargaCategoria: 1, cargaGlobal: 2 },
    ]);
    expect(elegido).toBe(beto);
  });

  it('debería desempatar por el orden recibido si todo empata', () => {
    const elegido = politicaAsignacion.elegirTecnico([
      { tecnico: carla, cargaCategoria: 0, cargaGlobal: 0 },
      { tecnico: ana, cargaCategoria: 0, cargaGlobal: 0 },
    ]);
    expect(elegido).toBe(carla);
  });

  it('debería devolver al único técnico disponible', () => {
    expect(politicaAsignacion.elegirTecnico([{ tecnico: ana, cargaCategoria: 7, cargaGlobal: 7 }])).toBe(ana);
  });

  it('debería devolver null sin técnicos', () => {
    expect(politicaAsignacion.elegirTecnico([])).toBeNull();
    expect(politicaAsignacion.elegirTecnico(undefined)).toBeNull();
  });
});

describe('politicaAcceso', () => {
  const ticket = ticketEn('asignado', { usuarioId: 10, tecnicoId: 20 });
  const admin = { id: 1, rol: 'administrador' };
  const tecnicoAsignado = { id: 20, rol: 'tecnico' };
  const otroTecnico = { id: 21, rol: 'tecnico' };
  const duenio = { id: 10, rol: 'usuario' };
  const otroUsuario = { id: 11, rol: 'usuario' };

  it('debería dejar ver al admin, a cualquier técnico y al dueño', () => {
    [admin, tecnicoAsignado, otroTecnico, duenio].forEach((actor) => expect(politicaAcceso.puedeVer(ticket, actor)).toBe(true));
  });

  it('no debería dejar ver a otro usuario', () => {
    expect(() => politicaAcceso.exigirVer(ticket, otroUsuario))
      .toThrow(expect.objectContaining({ codigo: errores.CODIGOS.ACCESO_DENEGADO, message: 'Sin acceso a este ticket' }));
  });

  it('debería dejar cambiar estado solo al admin y al técnico asignado', () => {
    expect(politicaAcceso.puedeCambiarEstado(ticket, admin)).toBe(true);
    expect(politicaAcceso.puedeCambiarEstado(ticket, tecnicoAsignado)).toBe(true);
    expect(politicaAcceso.puedeCambiarEstado(ticket, duenio)).toBe(false);
    expect(() => politicaAcceso.exigirCambiarEstado(ticket, otroTecnico)).toThrow('Sin permiso para modificar este ticket');
  });

  it('no debería lanzar cuando el acceso está permitido', () => {
    expect(() => politicaAcceso.exigirVer(ticket, duenio)).not.toThrow();
    expect(() => politicaAcceso.exigirCambiarEstado(ticket, admin)).not.toThrow();
  });

  it('debería filtrar el listado por rol', () => {
    expect(politicaAcceso.filtroDeListado(duenio)).toEqual({ usuarioId: 10 });
    expect(politicaAcceso.filtroDeListado(tecnicoAsignado)).toEqual({ tecnicoId: 20 });
    expect(politicaAcceso.filtroDeListado(admin)).toEqual({});
  });
});
