package com.pamplona.authcore.application.ports.in;

import com.pamplona.authcore.domain.User;

/**
 * Puerto de entrada: consultar un usuario por id (directorio para domain-service).
 */
public interface GetUserUseCase {
    User getUser(Long id);
}
