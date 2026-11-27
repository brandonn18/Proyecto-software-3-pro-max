package com.ticketsti.soporte.domain.exception;

public class TicketNoEncontradoException extends NoEncontradoException {

    public TicketNoEncontradoException(String codigo) {
        super("No existe el ticket " + codigo);
    }
}
