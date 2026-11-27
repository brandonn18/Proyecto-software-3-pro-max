package com.ticketsti.soporte.domain.model;

/** Lo que puede pasarle al SLA de un ticket vigente (RF-09). Cada evento ocurre una sola vez por ciclo de SLA. */
public enum EventoSla {
    /** Se consumió el {@value Ticket#PORCENTAJE_ALERTA_SLA} % del plazo. */
    ALERTA_80,
    /** Se cumplió el plazo sin resolver el ticket. */
    VENCIDO
}
