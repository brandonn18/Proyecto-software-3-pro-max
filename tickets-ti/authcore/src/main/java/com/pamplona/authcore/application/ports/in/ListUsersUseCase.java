package com.pamplona.authcore.application.ports.in;

import com.pamplona.authcore.domain.User;
import java.util.List;

/**
 * Puerto de entrada: listar usuarios (solo ADMIN).
 */
public interface ListUsersUseCase {
    List<User> listUsers();
}
