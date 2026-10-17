// Cliente HTTP de /internal/* de authcore: la fuente de datos del modelo
// Usuario. domain-service nunca se conecta a la base de usuarios.
const { ErrorDirectorioNoDisponible } = require('../../models/apoyo/errores');
const { personaDesdeUsuario } = require('./contrato');

class DirectorioAuthcore {
  // fetchImpl se inyecta para tests; por defecto, el fetch global de Node 18+
  constructor({ baseUrl, internalKey, timeoutMs = 3000, fetchImpl = globalThis.fetch }) {
    if (!baseUrl || !internalKey) throw new Error('DirectorioAuthcore requiere baseUrl e internalKey');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.internalKey = internalKey;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  // Red caída, timeout o 5xx → ErrorDirectorioNoDisponible (los modelos degradan).
  // 401 es un error de configuración y se propaga tal cual.
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

  // → { id, nombre, email, rol, activo } | null
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

module.exports = DirectorioAuthcore;
