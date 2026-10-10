package com.pamplona.authcore.application.service;

import com.pamplona.authcore.application.exception.InvalidCredentialsException;
import com.pamplona.authcore.application.exception.UserAlreadyExistsException;
import com.pamplona.authcore.application.exception.UserNotFoundException;
import com.pamplona.authcore.application.ports.in.AssignRoleUseCase;
import com.pamplona.authcore.application.ports.in.GetUserUseCase;
import com.pamplona.authcore.application.ports.in.ListUsersByRoleUseCase;
import com.pamplona.authcore.application.ports.in.ListUsersUseCase;
import com.pamplona.authcore.application.ports.in.LoginUseCase;
import com.pamplona.authcore.application.ports.in.RegisterUserUseCase;
import com.pamplona.authcore.application.ports.out.PasswordHasherPort;
import com.pamplona.authcore.application.ports.out.TokenProviderPort;
import com.pamplona.authcore.application.ports.out.UserRepositoryPort;
import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Servicio de aplicacion: implementa los casos de uso (puertos de entrada)
 * usando SOLO los puertos de salida. No importa nada de "infrastructure".
 */
@Service
public class AuthService implements RegisterUserUseCase, LoginUseCase, AssignRoleUseCase, ListUsersUseCase,
        GetUserUseCase, ListUsersByRoleUseCase {

    private final UserRepositoryPort userRepository;
    private final PasswordHasherPort passwordHasher;
    private final TokenProviderPort tokenProvider;

    public AuthService(UserRepositoryPort userRepository,
                        PasswordHasherPort passwordHasher,
                        TokenProviderPort tokenProvider) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.tokenProvider = tokenProvider;
    }

    @Override
    public Long register(String username, String email, String rawPassword) {
        userRepository.findByUsername(username).ifPresent(u -> {
            throw new UserAlreadyExistsException(username);
        });
        Set<Role> defaultRoles = new HashSet<>(Set.of(Role.USER));
        User user = new User(null, username, normalizeEmail(email), passwordHasher.hash(rawPassword), defaultRoles);
        User saved = userRepository.save(user);
        return saved.getId();
    }

    @Override
    public String login(String username, String rawPassword) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordHasher.matches(rawPassword, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return tokenProvider.generateToken(user);
    }

    @Override
    public void assignRole(Long userId, Role role) {
        User user = getUser(userId);
        user.addRole(role);
        userRepository.save(user);
    }

    @Override
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    @Override
    public User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }

    @Override
    public List<User> listUsersByRole(Role role) {
        return userRepository.findByRole(role);
    }

    private static String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim();
    }
}
