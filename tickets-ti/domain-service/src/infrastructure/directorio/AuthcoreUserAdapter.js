const { UserDirectoryPort } = require('../../application/ports');
const { ErrorDirectorioNoDisponible } = require('../../application/errores');
const { personaDesdeUsuario } = require('../authcore/contratoAuthcore');

// Implementa UserDirectoryPort llamando por HTTP a /internal/* de authcore
// (servicio Java) y traduce sus usuarios { id, username, email, roles } a las
// personas del dominio. domain-service nunca se conecta a la base de usuarios.
class AuthcoreUserAdapter extends UserDirectoryPort {
  // fetchImpl se inyecta para tests; por defecto, el fetch global de Node 18+
  constructor({ baseUrl, internalKey, timeoutMs = 3000, fetchImpl = globalThis.fetch }) {
    super();
    if (!baseUrl || !internalKey) throw new Error('AuthcoreUserAdapter requiere baseUrl e internalKey');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.internalKey = internalKey;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  // Red caída, timeout o 5xx → ErrorDirectorioNoDisponible (los casos de uso
  // degradan). 401 es un error de configuración y se propaga tal cual.
  async _get(ruta) {
    let respuesta;
    try {
      respuesta = await this.fetch(`${this.baseUrl}${ruta}`, {
        headers: { 'X-Internal-Key': this.internalKey, accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ErrorDirectorioNoDisponible(err);
    }
    if (respuesta.status === 404) return null;
    if (respuesta.status === 401) throw new Error('authcore rechazó AUTHCORE_INTERNAL_KEY: revisa la configuración');
    if (!respuesta.ok) throw new ErrorDirectorioNoDisponible(new Error(`authcore respondió ${respuesta.status}`));
    return respuesta.json();
  }

  async obtenerUsuario(id) {
    if (!Number.isInteger(Number(id))) return null;
    return personaDesdeUsuario(await this._get(`/internal/users/${Number(id)}`));
  }

  // authcore no tiene técnicos inactivos: activos y todos son la misma lista
  async listarTecnicosActivos() {
    const tecnicos = await this.listarTecnicos();
    return tecnicos.map(({ id, nombre, email }) => ({ id, nombre, email }));
  }

  async listarTecnicos() {
    return ((await this._get('/internal/tecnicos')) || []).map(personaDesdeUsuario);
  }
}

module.exports = AuthcoreUserAdapter;
