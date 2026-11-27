package com.ticketsti.soporte.domain.exception;

public class TecnicoDuplicadoException extends DuplicadoException {

    public TecnicoDuplicadoException(String username) {
        super("Ya existe un técnico con el usuario " + username);
    }
}
