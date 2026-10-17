// Errores compartidos por las tres capas (módulo transversal).
// Negocio lanza ErrorDominio; datos lanza ErrorIdDuplicado y
// ErrorDirectorioNoDisponible; presentación traduce todos a HTTP.
const CODIGOS = Object.freeze({
  VALIDACION: 'VALIDACION',
  TRANSICION_INVALIDA: 'TRANSICION_INVALIDA',
  ACCESO_DENEGADO: 'ACCESO_DENEGADO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
});

class ErrorDominio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}

const errorValidacion = (mensaje) => new ErrorDominio(CODIGOS.VALIDACION, mensaje);

const noEncontrado = (mensaje) => new ErrorDominio(CODIGOS.NO_ENCONTRADO, mensaje);

class ErrorIdDuplicado extends Error {
  constructor(id) {
    super(`Ya existe un ticket con id ${id}`);
    this.name = 'ErrorIdDuplicado';
    this.id = id;
  }
}

class ErrorDirectorioNoDisponible extends Error {
  constructor(causa) {
    super('El directorio de usuarios (authcore) no está disponible');
    this.name = 'ErrorDirectorioNoDisponible';
    this.causa = causa;
  }
}

module.exports = {
  CODIGOS, ErrorDominio, errorValidacion, noEncontrado, ErrorIdDuplicado, ErrorDirectorioNoDisponible,
};
