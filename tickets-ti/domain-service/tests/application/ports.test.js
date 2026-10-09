const ports = require('../../src/application/ports');

const { definirPuerto, verificarPuerto } = ports;

describe('definirPuerto', () => {
  const Saludo = definirPuerto('SaludoPort', ['saludar', 'despedir']);

  it('debería lanzar "no implementado" si el adaptador no sobrescribe un método', () => {
    class AdaptadorIncompleto extends Saludo {}
    expect(() => new AdaptadorIncompleto().saludar()).toThrow('SaludoPort.saludar no implementado por AdaptadorIncompleto');
  });

  it('debería exponer el nombre y los métodos del puerto', () => {
    expect(Saludo.name).toBe('SaludoPort');
    expect(Saludo.metodos).toEqual(['saludar', 'despedir']);
  });
});

describe('verificarPuerto', () => {
  const Saludo = definirPuerto('SaludoPort', ['saludar', 'despedir']);

  it('debería aceptar una clase que implementa todos los métodos', () => {
    class Completo extends Saludo { saludar() {} despedir() {} }
    const adaptador = new Completo();
    expect(verificarPuerto(adaptador, Saludo)).toBe(adaptador);
  });

  it('debería aceptar un objeto plano con la misma forma (duck typing)', () => {
    expect(() => verificarPuerto({ saludar() {}, despedir() {} }, Saludo)).not.toThrow();
  });

  it('debería listar los métodos faltantes', () => {
    class Parcial extends Saludo { saludar() {} }
    expect(() => verificarPuerto(new Parcial(), Saludo, 'saludos'))
      .toThrow('La dependencia saludos no implementa SaludoPort: falta despedir');
  });

  it('debería rechazar una dependencia ausente', () => {
    expect(() => verificarPuerto(undefined, Saludo)).toThrow(/falta saludar, despedir/);
  });
});

describe('Puertos de domain-service', () => {
  it.each([
    'TicketRepository', 'AuditoriaRepository', 'NotificationPort', 'NotificacionRepository', 'RealtimePort',
    'EmailPort', 'UserDirectoryPort', 'Clock', 'SLAConfigRepository', 'ReportesQueryPort',
  ])('%s debería estar definido con al menos un método', (nombre) => {
    expect(ports[nombre].name).toBe(nombre);
    expect(ports[nombre].metodos.length).toBeGreaterThan(0);
  });
});
