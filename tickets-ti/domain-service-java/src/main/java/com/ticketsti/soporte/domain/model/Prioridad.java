package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/** Cada prioridad trae su plazo de atención (SLA) en horas corridas. */
public enum Prioridad {
    CRITICA(4), ALTA(8), MEDIA(24), BAJA(72);

    private final int horasSla;

    Prioridad(int horasSla) {
        this.horasSla = horasSla;
    }

    public int horasSla() {
        return horasSla;
    }

    /** Momento en que vence el SLA de un ticket que empieza a contar en {@code desde}. */
    public Instant limiteDesde(Instant desde) {
        return desde.plus(Duration.ofHours(horasSla));
    }

    public static Prioridad de(String texto) {
        try {
            return valueOf(texto.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValorInvalidoException("Prioridad desconocida: '" + texto + "' (use CRITICA, ALTA, MEDIA o BAJA)");
        }
    }
}
