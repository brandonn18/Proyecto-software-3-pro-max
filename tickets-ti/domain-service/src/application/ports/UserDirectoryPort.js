const { definirPuerto } = require('./definirPuerto');

/**
 * Directorio de usuarios. Lo implementa AuthcoreUserAdapter (HTTP hacia
 * authcore): domain-service nunca toca la base de datos de usuarios.
 * Si authcore no responde, los métodos lanzan ErrorDirectorioNoDisponible.
 *
 * obtenerUsuario(id)                    → Promise<{ id, nombre, email, rol, activo } | null>
 * listarTecnicosActivos()               → Promise<[{ id, nombre, email }]>  orden: nombre ASC
 * listarTecnicos({ incluirInactivos })  → Promise<[{ id, nombre, email, rol, activo }]>
 */
module.exports = definirPuerto('UserDirectoryPort', ['obtenerUsuario', 'listarTecnicosActivos', 'listarTecnicos']);
