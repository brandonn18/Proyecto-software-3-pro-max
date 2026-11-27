package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/** Quien llama: su nombre de usuario y sus roles, tal como vienen del JWT de AuthCore. */
public record Actor(String username, Set<Rol> roles) {

    public Actor {
        if (username == null || username.isBlank()) {
            throw new ValorInvalidoException("No se pudo identificar al usuario");
        }
        roles = roles.isEmpty() ? Set.of() : Set.copyOf(roles);
    }

    /** Acepta «ADMIN» o «ROLE_ADMIN»; ignora roles que este servicio no conoce. */
    public static Actor de(String username, Collection<String> nombresRol) {
        Set<Rol> roles = EnumSet.noneOf(Rol.class);
        for (String n : nombresRol) {
            String limpio = n.trim().toUpperCase(Locale.ROOT);
            if (limpio.startsWith("ROLE_")) limpio = limpio.substring(5);
            for (Rol r : Rol.values()) {
                if (r.name().equals(limpio)) roles.add(r);
            }
        }
        return new Actor(username.trim(), roles);
    }

    public boolean esAdmin() { return roles.contains(Rol.ADMIN); }

    public boolean esTecnico() { return roles.contains(Rol.TECNICO); }
}
