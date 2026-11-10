package com.ticketsti.soporte.domain.exception;

/** Un dato no cumple una regla del dominio (formato, rango, campo obligatorio). */
public class ValorInvalidoException extends DominioException {

    public ValorInvalidoException(String mensaje) {
        super(mensaje);
    }
}
