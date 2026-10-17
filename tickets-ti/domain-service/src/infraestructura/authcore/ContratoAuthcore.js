// Traducción entre el contrato de authcore (Java/Spring) y los objetos de
// domain-service. Es la ÚNICA clase que conoce los nombres de roles y claims
// de authcore.
//
// JWT de authcore: { sub: username, uid: number, roles: ['ADMIN'|'TECNICO'|'USER'] }
// Usuario de /internal: { id, username, email, roles }
const { ROLES } = require('../../valores/catalogos');
const { FabricaDeActores } = require('../../entidades/actores');
const PersonaDelDirectorio = require('../../entidades/PersonaDelDirectorio');

// Un usuario puede acumular roles (assignRole agrega, no reemplaza): manda el de
// mayor privilegio.
const PRIORIDAD_ROLES = Object.freeze([
  ['ADMIN', ROLES.ADMIN],
  ['TECNICO', ROLES.TECNICO],
  ['USER', ROLES.USUARIO],
]);

class ContratoAuthcore {
  static rolDesdeRoles(roles) {
    if (!Array.isArray(roles)) return null;
    const encontrado = PRIORIDAD_ROLES.find(([role]) => roles.includes(role));
    return encontrado ? encontrado[1] : null;
  }

  // → Administrador | Tecnico | Solicitante, o null si el token no trae los
  // claims mínimos (firma válida pero contrato roto)
  static actorDesdeClaims(claims) {
    const rol = ContratoAuthcore.rolDesdeRoles(claims?.roles);
    if (!Number.isInteger(claims?.uid) || !rol || typeof claims.sub !== 'string' || !claims.sub) return null;
    return FabricaDeActores.crear({ id: claims.uid, nombre: claims.sub, rol });
  }

  // authcore no maneja cuentas inactivas: todo usuario existente está activo
  static personaDesdeUsuario(usuario) {
    if (!usuario) return null;
    return new PersonaDelDirectorio({
      id: usuario.id, nombre: usuario.username, email: usuario.email || null, rol: ContratoAuthcore.rolDesdeRoles(usuario.roles), activo: true,
    });
  }
}

module.exports = ContratoAuthcore;
