const { rolDesdeRoles, actorDesdeClaims, personaDesdeUsuario } = require('../../src/infrastructure/authcore/contratoAuthcore');

describe('contratoAuthcore', () => {
  describe('rolDesdeRoles', () => {
    it.each([
      [['USER'], 'usuario'],
      [['TECNICO'], 'tecnico'],
      [['ADMIN'], 'administrador'],
      [['USER', 'TECNICO'], 'tecnico'],
      [['USER', 'TECNICO', 'ADMIN'], 'administrador'],
    ])('debería traducir %j a %s (gana el de mayor privilegio)', (roles, esperado) => {
      expect(rolDesdeRoles(roles)).toBe(esperado);
    });

    it.each([[[]], [['SOPORTE']], [undefined], ['ADMIN']])('debería devolver null con %j', (roles) => {
      expect(rolDesdeRoles(roles)).toBeNull();
    });
  });

  describe('actorDesdeClaims', () => {
    it('debería construir el actor con uid, sub y rol traducido', () => {
      expect(actorDesdeClaims({ sub: 'ana', uid: 20, roles: ['USER', 'TECNICO'] }))
        .toEqual({ id: 20, nombre: 'ana', rol: 'tecnico', email: null });
    });

    it.each([
      ['sin uid', { sub: 'ana', roles: ['USER'] }],
      ['uid no entero', { sub: 'ana', uid: '20', roles: ['USER'] }],
      ['sin sub', { uid: 20, roles: ['USER'] }],
      ['sin roles conocidos', { sub: 'ana', uid: 20, roles: ['OTRO'] }],
      ['nulo', null],
    ])('debería devolver null %s', (_caso, claims) => {
      expect(actorDesdeClaims(claims)).toBeNull();
    });
  });

  describe('personaDesdeUsuario', () => {
    it('debería usar username como nombre y marcar activo', () => {
      expect(personaDesdeUsuario({ id: 5, username: 'beto', email: 'b@t', roles: ['TECNICO'] }))
        .toEqual({ id: 5, nombre: 'beto', email: 'b@t', rol: 'tecnico', activo: true });
    });

    it('debería devolver null si authcore no encontró al usuario', () => {
      expect(personaDesdeUsuario(null)).toBeNull();
    });
  });
});
