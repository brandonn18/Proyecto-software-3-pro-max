import { usuarioDesdeToken, rolDesdeRoles } from '../utils/sesion';

// Token sin firmar con la forma del JWT de authcore (el navegador no valida firma)
const base64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const tokenCon = (claims) => `${base64Url({ alg: 'HS256' })}.${base64Url(claims)}.firma`;
const enUnaHora = () => Math.floor(Date.now() / 1000) + 3600;

describe('sesion', () => {
  test('debería leer uid, sub y el rol de mayor privilegio', () => {
    const token = tokenCon({ sub: 'ana', uid: 20, roles: ['USER', 'TECNICO'], exp: enUnaHora() });
    expect(usuarioDesdeToken(token)).toEqual({
      id: 20, username: 'ana', nombre: 'ana', rol: 'tecnico', roles: ['USER', 'TECNICO'],
    });
  });

  test('debería decodificar usernames con tildes', () => {
    const token = tokenCon({ sub: 'maría', uid: 11, roles: ['USER'], exp: enUnaHora() });
    expect(usuarioDesdeToken(token).nombre).toBe('maría');
  });

  test.each([
    ['expirado', tokenCon({ sub: 'ana', uid: 20, roles: ['USER'], exp: 1 })],
    ['sin roles conocidos', tokenCon({ sub: 'ana', uid: 20, roles: ['OTRO'], exp: enUnaHora() })],
    ['sin uid', tokenCon({ sub: 'ana', roles: ['USER'], exp: enUnaHora() })],
    ['malformado', 'no-es-un-jwt'],
    ['vacío', null],
  ])('no debería crear sesión con un token %s', (_caso, token) => {
    expect(usuarioDesdeToken(token)).toBeNull();
  });

  test('debería priorizar ADMIN sobre los demás roles', () => {
    expect(rolDesdeRoles(['USER', 'ADMIN', 'TECNICO'])).toBe('administrador');
  });
});
