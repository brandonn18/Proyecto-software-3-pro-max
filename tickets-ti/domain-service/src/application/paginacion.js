const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

const _enteroPositivo = (valor, porDefecto) => {
  const n = parseInt(valor, 10);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
};

// Normaliza page/limit de la query: valores inválidos caen al defecto y
// limit se topa en 100 para que nadie pida la tabla completa.
const normalizarPaginacion = ({ page, limit } = {}) => ({
  page: _enteroPositivo(page, 1),
  limit: Math.min(_enteroPositivo(limit, LIMITE_POR_DEFECTO), LIMITE_MAXIMO),
});

const construirMeta = (total, { page, limit }) => ({ total, page, limit, totalPages: Math.ceil(total / limit) });

module.exports = { normalizarPaginacion, construirMeta, LIMITE_MAXIMO };
