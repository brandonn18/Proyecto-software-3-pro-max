package com.pamplona.authcore.application.service;

import com.pamplona.authcore.application.exception.InvalidCredentialsException;
import com.pamplona.authcore.application.exception.UserAlreadyExistsException;
import com.pamplona.authcore.application.exception.UserNotFoundException;
import com.pamplona.authcore.application.ports.out.PasswordHasherPort;
import com.pamplona.authcore.application.ports.out.TokenProviderPort;
import com.pamplona.authcore.application.ports.out.UserRepositoryPort;
import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.domain.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Casos de uso con dobles en memoria: sin Spring, sin base de datos.
 */
class AuthServiceTest {

    private RepositorioEnMemoria repositorio;
    private AuthService servicio;

    @BeforeEach
    void setUp() {
        repositorio = new RepositorioEnMemoria();
        PasswordHasherPort hasher = new PasswordHasherPort() {
            public String hash(String raw) { return "hash:" + raw; }
            public boolean matches(String raw, String hashed) { return hashed.equals("hash:" + raw); }
        };
        TokenProviderPort tokens = user -> "token-de-" + user.getUsername();
        servicio = new AuthService(repositorio, hasher, tokens);
    }

    @Nested
    class Register {
        @Test
        @DisplayName("debería registrar con rol USER y la contraseña hasheada")
        void registraConRolUser() {
            Long id = servicio.register("ana", "ana@empresa.com", "secreta1");

            User guardado = repositorio.findById(id).orElseThrow();
            assertThat(guardado.getRoles()).containsExactly(Role.USER);
            assertThat(guardado.getPasswordHash()).isEqualTo("hash:secreta1");
            assertThat(guardado.getEmail()).isEqualTo("ana@empresa.com");
        }

        @Test
        @DisplayName("debería guardar un email en blanco como null")
        void emailEnBlancoEsNull() {
            Long id = servicio.register("ana", "  ", "secreta1");

            assertThat(repositorio.findById(id).orElseThrow().getEmail()).isNull();
        }

        @Test
        @DisplayName("no debería registrar un username repetido")
        void rechazaDuplicado() {
            servicio.register("ana", null, "secreta1");

            assertThatThrownBy(() -> servicio.register("ana", null, "otra123"))
                    .isInstanceOf(UserAlreadyExistsException.class);
        }
    }

    @Nested
    class Login {
        @Test
        @DisplayName("debería devolver el token con credenciales válidas")
        void loginValido() {
            servicio.register("ana", null, "secreta1");

            assertThat(servicio.login("ana", "secreta1")).isEqualTo("token-de-ana");
        }

        @Test
        @DisplayName("no debería distinguir entre usuario inexistente y contraseña incorrecta")
        void credencialesInvalidas() {
            servicio.register("ana", null, "secreta1");

            assertThatThrownBy(() -> servicio.login("ana", "mala")).isInstanceOf(InvalidCredentialsException.class);
            assertThatThrownBy(() -> servicio.login("nadie", "secreta1")).isInstanceOf(InvalidCredentialsException.class);
        }
    }

    @Nested
    class Roles {
        @Test
        @DisplayName("debería asignar TECNICO conservando los roles previos")
        void asignaRol() {
            Long id = servicio.register("beto", null, "secreta1");

            servicio.assignRole(id, Role.TECNICO);

            assertThat(servicio.getUser(id).getRoles()).containsExactlyInAnyOrder(Role.USER, Role.TECNICO);
        }

        @Test
        @DisplayName("debería fallar al asignar rol a un usuario inexistente")
        void asignaRolInexistente() {
            assertThatThrownBy(() -> servicio.assignRole(99L, Role.ADMIN)).isInstanceOf(UserNotFoundException.class);
        }

        @Test
        @DisplayName("debería listar solo los usuarios con el rol pedido, ordenados por username")
        void listaPorRol() {
            Long zoe = servicio.register("zoe", null, "secreta1");
            servicio.register("ana", null, "secreta1");
            Long beto = servicio.register("beto", null, "secreta1");
            servicio.assignRole(zoe, Role.TECNICO);
            servicio.assignRole(beto, Role.TECNICO);

            List<String> tecnicos = servicio.listUsersByRole(Role.TECNICO).stream().map(User::getUsername).toList();

            assertThat(tecnicos).containsExactly("beto", "zoe");
        }
    }

    /** Doble de UserRepositoryPort que imita el orden del adaptador JPA. */
    static class RepositorioEnMemoria implements UserRepositoryPort {
        private final Map<Long, User> usuarios = new LinkedHashMap<>();
        private long secuencia = 1;

        public User save(User user) {
            if (user.getId() == null) user.setId(secuencia++);
            usuarios.put(user.getId(), user);
            return user;
        }

        public Optional<User> findByUsername(String username) {
            return usuarios.values().stream().filter(u -> u.getUsername().equals(username)).findFirst();
        }

        public Optional<User> findById(Long id) {
            return Optional.ofNullable(usuarios.get(id));
        }

        public List<User> findAll() {
            return new ArrayList<>(usuarios.values());
        }

        public List<User> findByRole(Role role) {
            return usuarios.values().stream().filter(u -> u.hasRole(role))
                    .sorted(Comparator.comparing(User::getUsername)).toList();
        }
    }
}
