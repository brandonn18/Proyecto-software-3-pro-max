package com.pamplona.authcore.application.ports.in;

/**
 * Puerto de entrada: registrar un nuevo usuario. email puede ser null.
 */
public interface RegisterUserUseCase {
    Long register(String username, String email, String rawPassword);
}
