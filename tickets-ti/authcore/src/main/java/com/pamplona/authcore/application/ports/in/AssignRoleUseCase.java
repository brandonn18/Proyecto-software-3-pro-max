package com.pamplona.authcore.application.ports.in;

import com.pamplona.authcore.domain.Role;

/**
 * Puerto de entrada: asignar un rol a un usuario existente.
 */
public interface AssignRoleUseCase {
    void assignRole(Long userId, Role role);
}
