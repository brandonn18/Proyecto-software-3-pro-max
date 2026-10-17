// Inyección de dependencias con verificación: cada servicio declara qué clase
// abstracta (o concreta) espera y falla al construirse si no la recibe.
class Dependencias {
  // deps: objeto recibido | contrato: { nombre: Clase }
  static exigir(deps, contrato) {
    Object.entries(contrato).forEach(([nombre, Clase]) => {
      if (!(deps?.[nombre] instanceof Clase)) throw new TypeError(`${nombre} debe ser una instancia de ${Clase.name}`);
    });
    return deps;
  }
}

// Efectos secundarios no críticos (emails): un fallo se registra pero no
// revierte la operación principal, igual que en el monolito.
class TareasEnSegundoPlano {
  #logger;

  constructor(logger = console) {
    this.#logger = logger;
  }

  lanzar(contexto, tarea) {
    Promise.resolve()
      .then(tarea)
      .catch((err) => this.#logger.error(`[${contexto}]`, err.message));
  }
}

module.exports = { Dependencias, TareasEnSegundoPlano };
