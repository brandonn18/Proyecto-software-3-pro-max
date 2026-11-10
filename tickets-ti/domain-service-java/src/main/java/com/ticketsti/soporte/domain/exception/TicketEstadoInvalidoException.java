package com.ticketsti.soporte.domain.exception;

/** El ticket no está en un estado que permita la operación pedida (transición no permitida, reabrir uno abierto...). */
public class TicketEstadoInvalidoException extends DominioException {

    public TicketEstadoInvalidoException(String mensaje) {
        super(mensaje);
    }
}
