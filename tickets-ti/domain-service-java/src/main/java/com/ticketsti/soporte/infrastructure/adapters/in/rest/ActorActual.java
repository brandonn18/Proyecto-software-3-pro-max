package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.infrastructure.security.UsuarioAutenticado;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Convierte la identidad que dejó el filtro JWT en el {@link Actor} del dominio. Los controladores no deciden permisos. */
final class ActorActual {

    private ActorActual() { }

    static Actor obtener() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioAutenticado u) {
            return Actor.de(u.username(), u.roles());
        }
        throw new IllegalStateException("No hay un usuario autenticado en la petición");
    }
}
