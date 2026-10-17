const ContratoAuthcore = require('../../src/infraestructura/authcore/ContratoAuthcore');
const { Administrador, Tecnico, Solicitante } = require('../../src/entidades/actores');
const PersonaDelDirectorio = require('../../src/entidades/PersonaDelDirectorio');

describe('ContratoAuthcore', () => {
  describe('rolDesdeRoles', () => {
    it.each([
      [['USER'], 'usuario'],
      [['TECNICO'], 'tecnico'],
      [['ADMIN'], 'administrador'],
      [['USER', 'TECNICO'], 'tecnico'],
      [['USER', 'TECNICO', 'ADMIN'], 'administrador'],
    ])('debería traducir %j a %s (gana el de mayor privilegio)', (roles, esperado) => {
      expect(ContratoAuthcore.rolDesdeRoles(roles)).toBe(esperado);
    });

    it.each([[[]], [['SOPORTE']], [undefined], ['ADMIN']])('debería devolver null con %j', (roles) => {
      expect(ContratoAuthcore.rolDesdeRoles(roles)).toBeNull();
    });
  });

  describe('actorDesdeClaims', () => {
    it.each([
      [['USER', 'TECNICO'], Tecnico],
      [['ADMIN'], Administrador],
      [['USER'], Solicitante],
    ])('debería instanciar la subclase de Actor que corresponde a %j', (roles, Clase) => {
      const actor = ContratoAuthcore.actorDesdeClaims({ sub: 'ana', uid: 20, roles });
      expect(actor).toBeInstanceOf(Clase);
      expect([actor.id, actor.nombre]).toEqual([20, 'ana']);
    });

    it.each([
      ['sin uid', { sub: 'ana', roles: ['USER'] }],
      ['uid no entero', { sub: 'ana', uid: '20', roles: ['USER'] }],
      ['sin sub', { uid: 20, roles: ['USER'] }],
      ['sin roles conocidos', { sub: 'ana', uid: 20, roles: ['OTRO'] }],
      ['nulo', null],
    ])('debería devolver null %s', (_caso, claims) => {
      expect(ContratoAuthcore.actorDesdeClaims(claims)).toBeNull();
    });
  });

  describe('personaDesdeUsuario', () => {
    it('debería usar username como nombre y marcar activo', () => {
      const persona = ContratoAuthcore.personaDesdeUsuario({ id: 5, username: 'beto', email: 'b@t', roles: ['TECNICO'] });
      expect(persona).toBeInstanceOf(PersonaDelDirectorio);
      expect(persona.aJSON()).toEqual({ id: 5, nombre: 'beto', email: 'b@t', rol: 'tecnico', activo: true });
      expect(persona.esTecnicoActivo()).toBe(true);
    });

    it('debería devolver null si authcore no encontró al usuario', () => {
      expect(ContratoAuthcore.personaDesdeUsuario(null)).toBeNull();
    });
  });
});
