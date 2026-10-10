package com.pamplona.authcore.application.ports.in;

import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import java.util.List;

/**
 * Puerto de entrada: listar los usuarios que tienen un rol (ej. tecnicos
 * para la asignacion de tickets en domain-service).
 */
public interface ListUsersByRoleUseCase {
    List<User> listUsersByRole(Role role);
}
