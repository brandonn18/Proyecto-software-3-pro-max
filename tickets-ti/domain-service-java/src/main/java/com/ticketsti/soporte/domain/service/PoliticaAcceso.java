package com.ticketsti.soporte.domain.service;

import com.ticketsti.soporte.domain.exception.AccesoDenegadoException;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Ticket;

/** Quién puede hacer qué. Toda la regla de permisos en un solo lugar (SRP); los controladores no deciden nada. */
public class PoliticaAcceso {

    public void asegurarAdmin(Actor actor, String operacion) {
        if (!actor.esAdmin()) {
            throw new AccesoDenegadoException("Solo el administrador puede " + operacion);
        }
    }

    /** Ve un ticket: el administrador, quien lo creó y el técnico asignado. */
    public boolean puedeVer(Ticket ticket, Actor actor) {
        return actor.esAdmin()
                || actor.username().equals(ticket.getCreadoPor())
                || (actor.esTecnico() && actor.username().equals(ticket.getTecnico()));
    }

    public void asegurarPuedeVer(Ticket ticket, Actor actor) {
        if (!puedeVer(ticket, actor)) {
            throw new AccesoDenegadoException("Sin permiso para ver este ticket");
        }
    }

    /** Cambia el estado: el administrador o el técnico asignado. */
    public void asegurarPuedeCambiarEstado(Ticket ticket, Actor actor) {
        boolean asignado = actor.esTecnico() && actor.username().equals(ticket.getTecnico());
        if (!actor.esAdmin() && !asignado) {
            throw new AccesoDenegadoException("Sin permiso para modificar este ticket");
        }
    }

    /** Reabre: el administrador o quien creó el ticket. */
    public void asegurarPuedeReabrir(Ticket ticket, Actor actor) {
        if (!actor.esAdmin() && !actor.username().equals(ticket.getCreadoPor())) {
            throw new AccesoDenegadoException("Sin permiso para reabrir este ticket");
        }
    }

    /**
     * Alcance de lo que un actor puede listar. Ambos null = sin restricción (administrador). Si vienen los dos,
     * basta cumplir uno (el técnico ve lo que creó y lo que tiene asignado); si solo viene {@code creadoPor},
     * ve únicamente lo que creó. Debe coincidir con {@link #puedeVer}.
     */
    public record Visibilidad(String creadoPor, String asignadoA) { }

    public Visibilidad visibilidadPara(Actor actor) {
        if (actor.esAdmin()) {
            return new Visibilidad(null, null);
        }
        return new Visibilidad(actor.username(), actor.esTecnico() ? actor.username() : null);
    }
}
