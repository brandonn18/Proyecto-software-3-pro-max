// Errores de la aplicación. Los modelos lanzan ErrorDominio; lib/ lanza
// ErrorDirectorioNoDisponible; middlewares/errorHandler.js los traduce a HTTP.
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

class ErrorDirectorioNoDisponible extends Error {
  constructor(causa) {
    super('El directorio de usuarios (authcore) no está disponible');
    this.name = 'ErrorDirectorioNoDisponible';
    this.causa = causa;
  }
}

module.exports = {
  CODIGOS, ErrorDominio, errorValidacion, noEncontrado, ErrorDirectorioNoDisponible,
};
