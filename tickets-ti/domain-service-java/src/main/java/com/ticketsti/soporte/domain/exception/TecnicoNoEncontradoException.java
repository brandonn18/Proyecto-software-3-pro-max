package com.ticketsti.soporte.domain.exception;

public class TecnicoNoEncontradoException extends NoEncontradoException {

    public TecnicoNoEncontradoException(String username) {
        super("No existe el técnico " + username);
    }
}
