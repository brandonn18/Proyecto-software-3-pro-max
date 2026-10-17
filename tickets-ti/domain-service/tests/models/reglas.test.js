// Reglas puras que usan los modelos (models/apoyo/): sin base de datos.
const idTicket = require('../../src/models/apoyo/idTicket');
const politicaSLA = require('../../src/models/apoyo/politicaSLA');
const politicaAsignacion = require('../../src/models/apoyo/politicaAsignacion');
const politicaAcceso = require('../../src/models/apoyo/politicaAcceso');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 60 * 60 * 1000;
const enProceso = (overrides = {}) => ({
  estado: 'en_proceso', tecnicoId: 20, sla_alerta_enviada: false, sla_limite: new Date(AHORA.getTime() + 8 * HORA), ...overrides,
});
const evaluarA = (horas, overrides) => politicaSLA.evaluar(enProceso(overrides), { ahora: new Date(AHORA.getTime() + horas * HORA), horas: 8 });

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
  it.each([['critica', 4], ['alta', 8], ['media', 24], ['baja', 72], [undefined, 24]])('horasPara %s → %sh', (prioridad, horas) => {
    expect(politicaSLA.horasPara(prioridad, null)).toBe(horas);
  });

  it('debería priorizar la configuración', () => {
    expect(politicaSLA.horasPara('alta', { tiempo_horas: 6 })).toBe(6);
  });

  it('debería alertar con 81%, no al inicio, topar en 100% y respetar el porcentaje configurado', () => {
    expect(evaluarA(6.5)).toEqual({ porcentaje: 81.25, vencido: false, alertar: true });
    expect(evaluarA(0)).toEqual({ porcentaje: 0, vencido: false, alertar: false });
    expect(evaluarA(9)).toMatchObject({ porcentaje: 100, vencido: true });
    expect(politicaSLA.evaluar(enProceso(), { ahora: new Date(AHORA.getTime() + 6.5 * HORA), horas: 8, porcentajeAlerta: 90 }).alertar).toBe(false);
  });

  it('no debería alertar si ya se envió, sin técnico o en un estado final', () => {
    expect(evaluarA(7, { sla_alerta_enviada: true }).alertar).toBe(false);
    expect(evaluarA(7, { tecnicoId: null }).alertar).toBe(false);
    expect(evaluarA(7, { estado: 'cerrado' }).alertar).toBe(false);
  });
});

describe('CP003 — politicaAsignacion', () => {
  const ana = { id: 1 };
  const beto = { id: 2 };

  it('debería elegir menor carga en la categoría, desempatar por global y por orden', () => {
    expect(politicaAsignacion.elegirTecnico([{ tecnico: ana, cargaCategoria: 3, cargaGlobal: 3 }, { tecnico: beto, cargaCategoria: 0, cargaGlobal: 9 }])).toBe(beto);
    expect(politicaAsignacion.elegirTecnico([{ tecnico: ana, cargaCategoria: 1, cargaGlobal: 5 }, { tecnico: beto, cargaCategoria: 1, cargaGlobal: 2 }])).toBe(beto);
    expect(politicaAsignacion.elegirTecnico([{ tecnico: beto, cargaCategoria: 0, cargaGlobal: 0 }, { tecnico: ana, cargaCategoria: 0, cargaGlobal: 0 }])).toBe(beto);
    expect(politicaAsignacion.elegirTecnico([])).toBeNull();
  });
});

describe('politicaAcceso', () => {
  const ticket = { usuarioId: 10, tecnicoId: 20 };

  it('debería decidir ver, cambiar estado, reabrir y filtrar por rol', () => {
    expect(politicaAcceso.puedeVer(ticket, { id: 21, rol: 'tecnico' })).toBe(true);
    expect(politicaAcceso.puedeVer(ticket, { id: 11, rol: 'usuario' })).toBe(false);
    expect(politicaAcceso.puedeCambiarEstado(ticket, { id: 20, rol: 'tecnico' })).toBe(true);
    expect(politicaAcceso.puedeReabrir(ticket, { id: 20, rol: 'tecnico' })).toBe(false);
    expect(politicaAcceso.filtroDeListado({ id: 10, rol: 'usuario' })).toEqual({ usuarioId: 10 });
    expect(politicaAcceso.filtroDeListado({ id: 20, rol: 'tecnico' })).toEqual({ tecnicoId: 20 });
    expect(politicaAcceso.filtroDeListado({ id: 1, rol: 'administrador' })).toEqual({});
  });
});
