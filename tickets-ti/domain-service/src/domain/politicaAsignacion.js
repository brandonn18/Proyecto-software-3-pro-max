// Regla de asignación automática: técnico activo con MENOR cantidad de
// tickets no cerrados en la categoría; desempata la carga global y después
// el orden recibido (el directorio entrega los técnicos por nombre).

// candidatos: [{ tecnico: { id, nombre }, cargaCategoria, cargaGlobal }]
const elegirTecnico = (candidatos) => {
  if (!Array.isArray(candidatos) || candidatos.length === 0) return null;
  const ordenados = candidatos
    .map((c, indice) => ({ ...c, indice }))
    .sort((a, b) =>
      a.cargaCategoria - b.cargaCategoria
      || a.cargaGlobal - b.cargaGlobal
      || a.indice - b.indice);
  return ordenados[0].tecnico;
};

module.exports = { elegirTecnico };
