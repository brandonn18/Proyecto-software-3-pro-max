package com.ticketsti.soporte.domain.model;

import java.time.Instant;

/** Una línea del historial. {@code de} es null en la creación. */
public record CambioTicket(EstadoTicket de, EstadoTicket a, String por, Instant cuando, String detalle) { }
