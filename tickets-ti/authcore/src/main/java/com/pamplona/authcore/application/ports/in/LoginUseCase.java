package com.pamplona.authcore.application.ports.in;

/**
 * Puerto de entrada: autenticar un usuario y obtener un JWT.
 */
public interface LoginUseCase {
    String login(String username, String rawPassword);
}
