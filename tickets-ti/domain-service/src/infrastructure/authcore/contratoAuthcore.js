// Traducción entre el contrato de authcore (Java/Spring)
// y el lenguaje del dominio de tickets. Es el ÚNICO lugar que conoce los nombres
// de roles y claims de authcore: middleware HTTP, Socket.io y AuthcoreUserAdapter
// lo reutilizan.
//
// JWT de authcore: { sub: username, uid: number, roles: ['ADMIN'|'TECNICO'|'USER'] }
// Usuario de /internal: { id, username, email, roles }
const { ROLES } = require('../../domain/catalogos');

// Un usuario puede acumular roles (assignRole agrega, no reemplaza): manda el de
// mayor privilegio.
const PRIORIDAD_ROLES = Object.freeze([
  ['ADMIN', ROLES.ADMIN],
  ['TECNICO', ROLES.TECNICO],
  ['USER', ROLES.USUARIO],
]);

const rolDesdeRoles = (roles) => {
  if (!Array.isArray(roles)) return null;
  const encontrado = PRIORIDAD_ROLES.find(([role]) => roles.includes(role));
  return encontrado ? encontrado[1] : null;
};

// null si el token no trae los claims mínimos (firma válida pero contrato roto)
const actorDesdeClaims = (claims) => {
  const rol = rolDesdeRoles(claims?.roles);
  if (!Number.isInteger(claims?.uid) || !rol || typeof claims.sub !== 'string' || !claims.sub) return null;
  return { id: claims.uid, rol, nombre: claims.sub, email: null };
};

// authcore no maneja cuentas inactivas: todo usuario existente está activo
const personaDesdeUsuario = (usuario) => {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: usuario.username,
    email: usuario.email || null,
    rol: rolDesdeRoles(usuario.roles),
    activo: true,
  };
};

module.exports = { rolDesdeRoles, actorDesdeClaims, personaDesdeUsuario };
