package com.pamplona.authcore.application.ports.out;

import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida: persistencia de usuarios. El dominio y la aplicacion
 * solo conocen esta interfaz - nunca una implementacion JPA concreta.
 */
public interface UserRepositoryPort {
    User save(User user);
    Optional<User> findByUsername(String username);
    Optional<User> findById(Long id);
    List<User> findAll();
    /** Usuarios con el rol dado, ordenados por username. */
    List<User> findByRole(Role role);
}
