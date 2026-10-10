package com.pamplona.authcore.infrastructure.config;

import com.pamplona.authcore.application.ports.out.PasswordHasherPort;
import com.pamplona.authcore.application.ports.out.UserRepositoryPort;
import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * Crea un usuario admin al arrancar, SOLO si no existe todavia.
 * Resuelve el problema de "quien asigna el primer rol ADMIN" sin necesitar
 * acceso directo a la base de datos.
 *
 * Las credenciales vienen de ADMIN_USERNAME / ADMIN_PASSWORD (nunca del codigo).
 * Sin ADMIN_PASSWORD no se crea nada.
 */
@Component
public class AdminBootstrapRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepositoryPort userRepository;
    private final PasswordHasherPort passwordHasher;
    private final String adminUsername;
    private final String adminPassword;
    private final String adminEmail;

    public AdminBootstrapRunner(UserRepositoryPort userRepository,
                                PasswordHasherPort passwordHasher,
                                @Value("${authcore.admin.username:admin}") String adminUsername,
                                @Value("${authcore.admin.password:}") String adminPassword,
                                @Value("${authcore.admin.email:}") String adminEmail) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.adminEmail = adminEmail;
    }

    @Override
    public void run(String... args) {
        if (adminPassword == null || adminPassword.isBlank()) {
            log.info("ADMIN_PASSWORD no definido: se omite la creacion del administrador inicial");
            return;
        }
        if (adminPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalStateException("ADMIN_PASSWORD debe tener al menos " + MIN_PASSWORD_LENGTH + " caracteres");
        }
        if (userRepository.findByUsername(adminUsername).isPresent()) {
            return;
        }
        Set<Role> roles = new HashSet<>(Set.of(Role.ADMIN, Role.USER));
        String email = adminEmail == null || adminEmail.isBlank() ? null : adminEmail;
        userRepository.save(new User(null, adminUsername, email, passwordHasher.hash(adminPassword), roles));
        log.warn("Administrador inicial '{}' creado. Cambia su contrasena si el servicio queda expuesto.", adminUsername);
    }
}
