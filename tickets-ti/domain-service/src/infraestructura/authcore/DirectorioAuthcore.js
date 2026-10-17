// Implementación concreta de DirectorioDeUsuarios: HTTP a /internal/* de
// authcore. domain-service nunca se conecta a la base de usuarios.
const { DirectorioDeUsuarios } = require('../../interfaces');
const { ErrorDirectorioNoDisponible } = require('../../errores');
const ContratoAuthcore = require('./ContratoAuthcore');

class DirectorioAuthcore extends DirectorioDeUsuarios {
  #baseUrl;
  #internalKey;
  #timeoutMs;
  #fetch;

  // fetchImpl se inyecta para tests; por defecto, el fetch global de Node 18+
  constructor({ baseUrl, internalKey, timeoutMs = 3000, fetchImpl = globalThis.fetch }) {
    super();
    if (!baseUrl || !internalKey) throw new Error('DirectorioAuthcore requiere baseUrl e internalKey');
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#internalKey = internalKey;
    this.#timeoutMs = timeoutMs;
    this.#fetch = fetchImpl;
  }

  // Red caída, timeout o 5xx → ErrorDirectorioNoDisponible (los servicios degradan).
  // 401 es un error de configuración y se propaga tal cual.
  async #get(ruta) {
    let respuesta;
    try {
      respuesta = await this.#fetch(`${this.#baseUrl}${ruta}`, {
        headers: { 'X-Internal-Key': this.#internalKey, accept: 'application/json' },
        signal: AbortSignal.timeout(this.#timeoutMs),
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
    return ContratoAuthcore.personaDesdeUsuario(await this.#get(`/internal/users/${Number(id)}`));
  }

  // authcore no tiene técnicos inactivos: activos y todos son la misma lista
  async listarTecnicosActivos() {
    return this.listarTecnicos();
  }

  async listarTecnicos() {
    return ((await this.#get('/internal/tecnicos')) || []).map((u) => ContratoAuthcore.personaDesdeUsuario(u));
  }
}

module.exports = DirectorioAuthcore;
