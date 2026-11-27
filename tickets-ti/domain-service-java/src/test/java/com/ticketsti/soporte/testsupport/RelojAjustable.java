package com.ticketsti.soporte.testsupport;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/** Reloj de pruebas que se puede adelantar: sirve para probar plazos (SLA) sin esperar. */
public class RelojAjustable extends Clock {

    private Instant ahora;
    private final ZoneId zona;

    public RelojAjustable(Instant inicio, ZoneId zona) {
        this.ahora = inicio;
        this.zona = zona;
    }

    public void avanzar(Duration d) {
        ahora = ahora.plus(d);
    }

    @Override public ZoneId getZone() { return zona; }

    @Override public Clock withZone(ZoneId z) { return new RelojAjustable(ahora, z); }

    @Override public Instant instant() { return ahora; }
}
