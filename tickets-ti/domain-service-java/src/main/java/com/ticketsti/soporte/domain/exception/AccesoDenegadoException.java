package com.ticketsti.soporte.domain.exception;

/** La persona está autenticada pero no tiene permiso para esta operación sobre este recurso. */
public class AccesoDenegadoException extends DominioException {

    public AccesoDenegadoException(String mensaje) {
        super(mensaje);
    }
}
