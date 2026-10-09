// JavaScript no tiene interfaces: un puerto es una clase base cuyos métodos
// lanzan "no implementado". Los adaptadores la extienden (o la imitan) y
// verificarPuerto comprueba en la composición que no falte ningún método.

const definirPuerto = (nombre, metodos) => {
  const Puerto = class {};
  Object.defineProperty(Puerto, 'name', { value: nombre });
  metodos.forEach((metodo) => {
    Puerto.prototype[metodo] = function () {
      throw new Error(`${nombre}.${metodo} no implementado por ${this.constructor.name}`);
    };
  });
  Puerto.metodos = Object.freeze([...metodos]);
  return Puerto;
};

const _faltantes = (implementacion, Puerto) =>
  Puerto.metodos.filter((m) => typeof implementacion?.[m] !== 'function' || implementacion[m] === Puerto.prototype[m]);

const verificarPuerto = (implementacion, Puerto, dependencia = Puerto.name) => {
  const faltantes = _faltantes(implementacion, Puerto);
  if (faltantes.length) {
    throw new Error(`La dependencia ${dependencia} no implementa ${Puerto.name}: falta ${faltantes.join(', ')}`);
  }
  return implementacion;
};

module.exports = { definirPuerto, verificarPuerto };
