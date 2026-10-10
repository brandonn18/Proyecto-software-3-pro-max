package com.pamplona.authcore.infrastructure.adapters.out.persistence;

import com.pamplona.authcore.application.ports.out.UserRepositoryPort;
import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;

/**
 * Adaptador de salida: implementa el puerto UserRepositoryPort usando JPA.
 * Es el UNICO lugar donde se traduce entre User (dominio) y UserJpaEntity (infraestructura).
 */
@Component
public class UserRepositoryJpaAdapter implements UserRepositoryPort {

    private final UserJpaRepository jpaRepository;

    public UserRepositoryJpaAdapter(UserJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public User save(User user) {
        UserJpaEntity entity = new UserJpaEntity(user.getId(), user.getUsername(), user.getEmail(),
                user.getPasswordHash(), new HashSet<>(user.getRoles()));
        UserJpaEntity saved = jpaRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return jpaRepository.findByUsername(username).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<User> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<User> findByRole(Role role) {
        return jpaRepository.findByRole(role).stream().map(this::toDomain).toList();
    }

    private User toDomain(UserJpaEntity entity) {
        return new User(entity.getId(), entity.getUsername(), entity.getEmail(), entity.getPasswordHash(),
                new HashSet<>(entity.getRoles()));
    }
}
