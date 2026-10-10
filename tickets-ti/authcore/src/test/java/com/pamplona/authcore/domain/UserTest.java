package com.pamplona.authcore.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    @DisplayName("debería agregar un rol sin duplicarlo")
    void agregaRol() {
        User user = new User(1L, "ana", "hash", Set.of(Role.USER));

        user.addRole(Role.TECNICO);
        user.addRole(Role.TECNICO);

        assertThat(user.getRoles()).containsExactlyInAnyOrder(Role.USER, Role.TECNICO);
        assertThat(user.hasRole(Role.TECNICO)).isTrue();
    }

    @Test
    @DisplayName("no debería exponer su colección interna de roles")
    void rolesInmutablesDesdeFuera() {
        User user = new User(1L, "ana", "hash", Set.of(Role.USER));

        user.getRoles().clear();

        assertThat(user.getRoles()).containsExactly(Role.USER);
    }

    @Test
    @DisplayName("debería aceptar roles nulos como conjunto vacío y email opcional")
    void rolesNulos() {
        User user = new User(null, "ana", null, "hash", null);

        assertThat(user.getRoles()).isEmpty();
        assertThat(user.getEmail()).isNull();
    }
}
