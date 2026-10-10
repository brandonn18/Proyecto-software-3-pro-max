// Sesión a partir del JWT de authcore (Java): { sub: username, uid, roles, exp }.
// El navegador solo lee el token para pintar la interfaz; quien lo valida de
// verdad es cada servicio con JWT_SECRET.

// Un usuario puede acumular roles: manda el de mayor privilegio
const PRIORIDAD_ROLES = [
  ['ADMIN', 'administrador'],
  ['TECNICO', 'tecnico'],
  ['USER', 'usuario'],
];

export const ROLES_AUTHCORE = { administrador: 'ADMIN', tecnico: 'TECNICO', usuario: 'USER' };

export const rolDesdeRoles = (roles = []) => {
  const encontrado = PRIORIDAD_ROLES.find(([role]) => roles.includes(role));
  return encontrado ? encontrado[1] : null;
};

// base64url → texto UTF-8 (los username pueden tener tildes)
const _decodificarBase64Url = (segmento) => {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const escapado = Array.from(binario, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(escapado);
};

// null si el token falta, está malformado o ya expiró
export const usuarioDesdeToken = (token) => {
  if (!token) return null;
  try {
    const claims = JSON.parse(_decodificarBase64Url(token.split('.')[1]));
    const rol = rolDesdeRoles(claims.roles);
    if (!rol || !claims.sub || !Number.isInteger(claims.uid)) return null;
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;
    return { id: claims.uid, username: claims.sub, nombre: claims.sub, rol, roles: claims.roles };
  } catch {
    return null;
  }
};
