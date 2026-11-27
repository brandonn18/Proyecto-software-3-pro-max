package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.domain.model.CambioTicket;
import java.time.Instant;

public record CambioResponse(String de, String a, String por, Instant cuando, String detalle) {

    public static CambioResponse de(CambioTicket c) {
        return new CambioResponse(c.de() == null ? null : c.de().name(), c.a().name(), c.por(), c.cuando(), c.detalle());
    }
}
