const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) DirectorioDeUsuarios. Directorio de usuarios (authcore). Si no responde, lanza ErrorDirectorioNoDisponible.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * obtenerUsuario(id)                   → Promise<PersonaDelDirectorio|null>
 * listarTecnicosActivos()              → Promise<PersonaDelDirectorio[]>  orden: nombre ASC
 * listarTecnicos({ incluirInactivos }) → Promise<PersonaDelDirectorio[]>
 */
class DirectorioDeUsuarios {
  constructor() {
    if (new.target === DirectorioDeUsuarios) throw new TypeError('DirectorioDeUsuarios es abstracta');
  }

  async obtenerUsuario() { throw new ErrorNoImplementado(this, 'obtenerUsuario'); }

  async listarTecnicosActivos() { throw new ErrorNoImplementado(this, 'listarTecnicosActivos'); }

  async listarTecnicos() { throw new ErrorNoImplementado(this, 'listarTecnicos'); }
}

module.exports = DirectorioDeUsuarios;
