package com.pamplona.authcore.application.exception;

public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String username) {
        super("Ya existe un usuario con username: " + username);
    }
}
