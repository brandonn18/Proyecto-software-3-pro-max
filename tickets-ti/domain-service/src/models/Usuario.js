// MODELO Usuario: no tiene tabla aquí. Su fuente de datos es authcore, vía el
// cliente HTTP de lib/authcore/ (domain-service no toca la base de usuarios).
const { ErrorDirectorioNoDisponible } = require('./apoyo/errores');
const { servicios } = require('./apoyo/servicios');

class Usuario {
  // → { id, nombre, email, rol, activo } | null
  static buscar(id) {
    return servicios.directorio.obtenerUsuario(id);
  }

  // → [{ id, nombre, email }] ordenados por nombre
  static tecnicosActivos() {
    return servicios.directorio.listarTecnicosActivos();
  }

  static tecnicos({ incluirInactivos = false } = {}) {
    return servicios.directorio.listarTecnicos({ incluirInactivos });
  }

  // Para la asignación automática: si authcore no responde, no hay candidatos
  static async tecnicosActivosODegradar() {
    try {
      return await this.tecnicosActivos();
    } catch (err) {
      if (!(err instanceof ErrorDirectorioNoDisponible)) throw err;
      servicios.logger.error('[Usuario]', 'authcore no disponible; el ticket queda abierto');
      return [];
    }
  }

  static esTecnicoActivo(persona) {
    return Boolean(persona) && persona.rol === 'tecnico' && persona.activo;
  }
}

module.exports = { Usuario };
