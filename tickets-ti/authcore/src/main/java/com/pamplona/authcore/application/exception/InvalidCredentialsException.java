package com.pamplona.authcore.application.exception;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Usuario o contrasena incorrectos");
    }
}
