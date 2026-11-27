package com.ticketsti.soporte.domain.model;

import java.time.Duration;
import java.time.Instant;

/**
 * Reglas para medir un SLA a partir de su vencimiento y su prioridad. Las usan el ticket (alertas de M-01) y los
 * reportes (M-03), así que la definición de «vencido», «en riesgo» o «a tiempo» vive en un solo lugar.
 */
public final class MedicionSla {

    /** Porcentaje del plazo a partir del cual se alerta (RF-09). */
    public static final int PORCENTAJE_ALERTA = 80;

    private MedicionSla() { }

    /** Inicio del plazo vigente: el vencimiento menos las horas de la prioridad (tras reabrir, el de la reapertura). */
    public static Instant inicio(Prioridad prioridad, Instant venceSla) {
        return venceSla.minus(prioridad.plazo());
    }

    /** Momento en que se consume el {@value #PORCENTAJE_ALERTA} % del plazo. */
    public static Instant momentoAlerta(Prioridad prioridad, Instant venceSla) {
        return venceSla.minus(prioridad.plazo().multipliedBy(100 - PORCENTAJE_ALERTA).dividedBy(100));
    }

    /** Vencido desde el instante mismo del vencimiento. */
    public static boolean vencido(Instant venceSla, Instant ahora) {
        return !ahora.isBefore(venceSla);
    }

    /** Pasó el {@value #PORCENTAJE_ALERTA} % del plazo, pero todavía no venció. */
    public static boolean enRiesgo(Prioridad prioridad, Instant venceSla, Instant ahora) {
        return !vencido(venceSla, ahora) && !ahora.isBefore(momentoAlerta(prioridad, venceSla));
    }

    /** Se resolvió antes de vencer (resolver en el instante del vencimiento ya es tarde, igual que en {@link #vencido}). */
    public static boolean resueltoATiempo(Instant resueltoEn, Instant venceSla) {
        return resueltoEn.isBefore(venceSla);
    }

    /** Cuánto tardó en resolverse, contado desde el inicio del plazo vigente. */
    public static Duration tiempoDeResolucion(Prioridad prioridad, Instant venceSla, Instant resueltoEn) {
        return Duration.between(inicio(prioridad, venceSla), resueltoEn);
    }
}
