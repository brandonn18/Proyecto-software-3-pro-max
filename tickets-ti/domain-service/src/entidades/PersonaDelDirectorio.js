// Entidad PersonaDelDirectorio: un usuario tal como lo describe authcore
// (con email y si está activo). Distinta de Actor: un Actor hace la petición;
// una persona es alguien a quien se le asigna o se le escribe.
class PersonaDelDirectorio {
  #id;
  #nombre;
  #email;
  #rol;
  #activo;

  constructor({ id, nombre, email = null, rol = null, activo = true }) {
    this.#id = id;
    this.#nombre = nombre;
    this.#email = email;
    this.#rol = rol;
    this.#activo = activo;
  }

  get id() { return this.#id; }

  get nombre() { return this.#nombre; }

  get email() { return this.#email; }

  get rol() { return this.#rol; }

  get activo() { return this.#activo; }

  esTecnicoActivo() { return this.#rol === 'tecnico' && this.#activo; }

  aJSON() { return { id: this.#id, nombre: this.#nombre, email: this.#email, rol: this.#rol, activo: this.#activo }; }
}

module.exports = PersonaDelDirectorio;
