// Jerarquía de errores (herencia). Cada subclase dice QUÉ salió mal; el
// ManejadorDeErrores HTTP decide el status según la clase (polimorfismo con
// instanceof), así el dominio no conoce HTTP.

class ErrorDeDominio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = new.target.name;
  }
}

class ErrorDeValidacion extends ErrorDeDominio {}

class ErrorDeTransicion extends ErrorDeDominio {}

class ErrorDeAcceso extends ErrorDeDominio {}

class ErrorNoEncontrado extends ErrorDeDominio {}

// Infraestructura → servicios: el directorio de authcore no respondió
class ErrorDirectorioNoDisponible extends Error {
  constructor(causa) {
    super('El directorio de usuarios (authcore) no está disponible');
    this.name = 'ErrorDirectorioNoDisponible';
    this.causa = causa;
  }
}

// Infraestructura → servicios: otro ticket ya tomó ese ID
class ErrorIdDuplicado extends Error {
  constructor(id) {
    super(`Ya existe un ticket con id ${id}`);
    this.name = 'ErrorIdDuplicado';
    this.id = id;
  }
}

// Lo lanza un método abstracto que la subclase no sobrescribió
class ErrorNoImplementado extends Error {
  constructor(objeto, metodo) {
    super(`${objeto.constructor.name} no implementa ${metodo}`);
    this.name = 'ErrorNoImplementado';
  }
}

module.exports = {
  ErrorDeDominio, ErrorDeValidacion, ErrorDeTransicion, ErrorDeAcceso, ErrorNoEncontrado,
  ErrorDirectorioNoDisponible, ErrorIdDuplicado, ErrorNoImplementado,
};
