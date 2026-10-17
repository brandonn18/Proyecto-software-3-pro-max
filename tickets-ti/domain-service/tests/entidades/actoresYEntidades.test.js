// Polimorfismo de los actores, clases abstractas y el resto de entidades.
const { Actor, Administrador, Tecnico, Solicitante, FabricaDeActores } = require('../../src/entidades/actores');
const Ticket = require('../../src/entidades/Ticket');
const Comentario = require('../../src/entidades/Comentario');
const ConfiguracionSLA = require('../../src/entidades/ConfiguracionSLA');
const Notificacion = require('../../src/entidades/Notificacion');
const EventoDeAuditoria = require('../../src/entidades/EventoDeAuditoria');
const PersonaDelDirectorio = require('../../src/entidades/PersonaDelDirectorio');
const interfaces = require('../../src/interfaces');
const { ErrorDeValidacion, ErrorNoImplementado } = require('../../src/errores');

const ticket = Ticket.reconstruir({
  id: 'TKT-2026-0001', titulo: 'T', descripcion: 'd', tipo: 'incidente', categoria: 'red', prioridad: 'alta', estado: 'asignado',
  usuarioId: 10, usuario_nombre: 'Luis', tecnicoId: 20, tecnico_nombre: 'Ana', sla_limite: new Date(),
});
const admin = FabricaDeActores.crear({ id: 1, nombre: 'Admin', rol: 'administrador' });
const tecnicoAsignado = FabricaDeActores.crear({ id: 20, nombre: 'Ana', rol: 'tecnico' });
const otroTecnico = FabricaDeActores.crear({ id: 21, nombre: 'Beto', rol: 'tecnico' });
const duenio = FabricaDeActores.crear({ id: 10, nombre: 'Luis', rol: 'usuario' });
const otroUsuario = FabricaDeActores.crear({ id: 11, nombre: 'María', rol: 'usuario' });

describe('Actores (polimorfismo)', () => {
  it('la fábrica debería crear la subclase de cada rol y rechazar roles desconocidos', () => {
    expect([admin, tecnicoAsignado, duenio].map((a) => a.constructor)).toEqual([Administrador, Tecnico, Solicitante]);
    expect(() => FabricaDeActores.crear({ id: 1, nombre: 'X', rol: 'root' })).toThrow(ErrorDeValidacion);
    expect(() => FabricaDeActores.crear({ id: 'x', nombre: 'X', rol: 'usuario' })).toThrow('Usuario inválido');
  });

  it.each([
    ['puedeVer', [true, true, true, true, false]],
    ['puedeCambiarEstado', [true, true, false, false, false]],
    ['puedeReabrir', [true, false, false, true, false]],
    ['puedeComentar', [true, true, false, true, false]],
  ])('%s debería responder distinto según la subclase', (metodo, esperado) => {
    expect([admin, tecnicoAsignado, otroTecnico, duenio, otroUsuario].map((a) => a[metodo](ticket))).toEqual(esperado);
  });

  it('cada subclase debería imponer su filtro de listado', () => {
    expect([admin, tecnicoAsignado, duenio].map((a) => a.filtroDeListado())).toEqual([{}, { tecnicoId: 20 }, { usuarioId: 10 }]);
    expect(duenio.aSnapshot()).toEqual({ id: 10, nombre: 'Luis', rol: 'usuario' });
  });

  it('Actor debería ser abstracta y sus métodos fallar si una subclase no los implementa', () => {
    expect(() => new Actor({ id: 1, nombre: 'x' })).toThrow(/abstracta/);
    class Incompleto extends Actor {}
    const incompleto = new Incompleto({ id: 1, nombre: 'x' });
    expect(() => incompleto.rol).toThrow(ErrorNoImplementado);
    ['puedeVer', 'puedeCambiarEstado', 'puedeReabrir', 'puedeComentar', 'filtroDeListado'].forEach((m) => {
      expect(() => incompleto[m](ticket)).toThrow(`Incompleto no implementa ${m}`);
    });
  });
});

describe('Interfaces (clases abstractas)', () => {
  it.each(Object.entries(interfaces))('%s no debería poder instanciarse', (_nombre, Interfaz) => {
    expect(() => new Interfaz()).toThrow(/abstracta/);
  });

  it('una subclase que no sobrescribe un método debería fallar al llamarlo', async () => {
    class RepoIncompleto extends interfaces.RepositorioDeTickets {}
    await expect(new RepoIncompleto().buscarPorId('x')).rejects.toThrow('RepoIncompleto no implementa buscarPorId');
    class RelojIncompleto extends interfaces.Reloj {}
    expect(() => new RelojIncompleto().ahora()).toThrow(ErrorNoImplementado);
  });
});

describe('Comentario', () => {
  const autor = admin.aSnapshot();

  it('debería limpiar el texto, exigir ticket y autor, y no cambiar al persistirse', () => {
    const c = new Comentario({ ticketId: 'T', autor, texto: '  hola ' });
    const guardado = c.persistido(7, new Date(0));
    expect([c.texto, c.id, guardado.id]).toEqual(['hola', null, 7]);
    expect(guardado.aJSON()).toEqual({ id: 7, ticketId: 'T', texto: 'hola', createdAt: new Date(0), autor: { id: 1, nombre: 'Admin', rol: 'administrador' } });
    expect(() => new Comentario({ ticketId: '', autor, texto: 'x' })).toThrow('Ticket requerido');
    expect(() => new Comentario({ ticketId: 'T', autor: {}, texto: 'x' })).toThrow('Autor inválido');
  });

  it('debería rechazar texto vacío o de más de 2000 caracteres', () => {
    expect(() => new Comentario({ ticketId: 'T', autor, texto: '   ' })).toThrow('El comentario no puede estar vacío');
    expect(() => new Comentario({ ticketId: 'T', autor, texto: 'a'.repeat(Comentario.LONGITUD_MAXIMA + 1) })).toThrow(/2000/);
  });
});

describe('ConfiguracionSLA', () => {
  const crear = () => new ConfiguracionSLA({ id: 1, prioridad: 'baja', tiempo_horas: 72 });

  it('debería ajustar solo horas y porcentaje, y validar antes de cambiar', () => {
    const c = crear();
    c.ajustar({ tiempo_horas: 48 });
    expect(c.aJSON()).toMatchObject({ prioridad: 'baja', tiempo_horas: 48, porcentaje_alerta: 80 });
    expect(() => c.ajustar({ tiempo_horas: 10, porcentaje_alerta: 101 })).toThrow(/porcentaje_alerta/);
    expect(c.tiempoHoras).toBe(48);
  });

  it.each([[{ tiempo_horas: 0 }], [{ tiempo_horas: '8' }], [{ porcentaje_alerta: 0 }]])('debería rechazar %j', (cambios) => {
    expect(() => crear().ajustar(cambios)).toThrow(ErrorDeValidacion);
  });
});

describe('Notificacion, EventoDeAuditoria y PersonaDelDirectorio', () => {
  it('deberían exponer su JSON y sus reglas', () => {
    const n = new Notificacion({ id: 1, usuarioId: 10, tipo: 'creacion', mensaje: 'm' });
    expect([n.perteneceA(10), n.perteneceA(11), n.leida]).toEqual([true, false, false]);
    expect(n.aJSON()).toEqual({ id: 1, usuarioId: 10, ticketId: null, tipo: 'creacion', mensaje: 'm', leida: false, createdAt: null });
    expect(new EventoDeAuditoria({ ticketId: 'T', accion: 'SISTEMA' }).aJSON().usuario).toBeNull();
    expect(new EventoDeAuditoria({ ticketId: 'T', accion: 'X', actor: duenio }).actor).toEqual({ id: 10, nombre: 'Luis' });
    expect(new PersonaDelDirectorio({ id: 1, nombre: 'x', rol: 'tecnico', activo: false }).esTecnicoActivo()).toBe(false);
  });
});
