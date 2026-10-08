// Errores de dominio. No conocen HTTP: los controllers traducen `codigo`
// a un status (VALIDACION → 400, ACCESO_DENEGADO → 403, etc.).
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

module.exports = { ErrorDominio, CODIGOS, errorValidacion };
