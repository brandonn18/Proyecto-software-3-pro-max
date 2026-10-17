// Objeto de valor Paginacion: page/limit ya normalizados.
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

const _enteroPositivo = (valor, porDefecto) => {
  const n = parseInt(valor, 10);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
};

class Paginacion {
  #page;
  #limit;

  // Valores inválidos caen al defecto y limit se topa en 100 para que nadie
  // pida la tabla completa.
  constructor({ page, limit } = {}) {
    this.#page = _enteroPositivo(page, 1);
    this.#limit = Math.min(_enteroPositivo(limit, LIMITE_POR_DEFECTO), LIMITE_MAXIMO);
  }

  get page() { return this.#page; }

  get limit() { return this.#limit; }

  get offset() { return (this.#page - 1) * this.#limit; }

  meta(total) {
    return { total, page: this.#page, limit: this.#limit, totalPages: Math.ceil(total / this.#limit) };
  }
}

module.exports = Paginacion;
