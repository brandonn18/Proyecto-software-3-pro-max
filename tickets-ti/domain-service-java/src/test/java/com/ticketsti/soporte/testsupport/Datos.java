package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

/** Datos de ejemplo. El reloj fijo es martes 20 de octubre de 2026, 10:00 en Bogotá. */
public final class Datos {

    public static final Instant AHORA = Instant.parse("2026-10-20T15:00:00Z");
    public static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    private Datos() { }

    public static Clock relojFijo() {
        return Clock.fixed(AHORA, BOGOTA);
    }

    public static RelojAjustable relojAjustable() {
        return new RelojAjustable(AHORA, BOGOTA);
    }

    public static Actor admin() { return Actor.de("admin", List.of("ADMIN", "USER")); }

    public static Actor usuario(String nombre) { return Actor.de(nombre, List.of("USER")); }

    public static Actor tecnico(String nombre) { return Actor.de(nombre, List.of("TECNICO")); }

    /** Incidente de hardware, prioridad ALTA, creado por «maria». */
    public static Ticket ticket() {
        return ticket("TKT-2026-0001", "maria", Prioridad.ALTA);
    }

    public static Ticket ticket(String codigo, String creadoPor, Prioridad prioridad) {
        return Ticket.crear(codigo, "Impresora sin respuesta", "La impresora del segundo piso no imprime",
                TipoTicket.INCIDENTE, Categoria.de("hardware"), prioridad, creadoPor, AHORA);
    }
}
