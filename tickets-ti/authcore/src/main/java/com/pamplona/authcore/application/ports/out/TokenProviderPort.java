package com.pamplona.authcore.application.ports.out;

import com.pamplona.authcore.domain.User;

/**
 * Puerto de salida: generacion de tokens (JWT en la implementacion real).
 */
public interface TokenProviderPort {
    String generateToken(User user);
}
