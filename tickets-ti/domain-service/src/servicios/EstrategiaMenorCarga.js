// Estrategia concreta (CP003): técnico con MENOR cantidad de tickets activos
// en la categoría; desempata la carga global y después el orden recibido (el
// directorio entrega los técnicos por nombre). Otra estrategia (por ejemplo,
// round-robin) sería otra subclase, sin tocar el AsignadorDeTecnicos (OCP).
const { EstrategiaDeAsignacion } = require('../interfaces');

class EstrategiaMenorCarga extends EstrategiaDeAsignacion {
  // candidatos: [{ tecnico, cargaCategoria, cargaGlobal }]
  elegir(candidatos) {
    if (!Array.isArray(candidatos) || candidatos.length === 0) return null;
    const ordenados = candidatos
      .map((c, indice) => ({ ...c, indice }))
      .sort((a, b) => a.cargaCategoria - b.cargaCategoria || a.cargaGlobal - b.cargaGlobal || a.indice - b.indice);
    return ordenados[0].tecnico;
  }
}

module.exports = EstrategiaMenorCarga;
