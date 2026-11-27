package com.ticketsti.soporte.application.notificacion;

/** Hechos que se avisan (M-02, RF-10). */
public enum TipoNotificacion {
    TICKET_CREADO,
    /** Asignación automática al crear, o reasignación por el ADMIN. */
    TICKET_ASIGNADO,
    TICKET_RESUELTO,
    /** M-01: se consumió el 80 % del SLA. */
    SLA_ALERTA_80,
    /** M-01: se cumplió el plazo del SLA sin resolver el ticket. */
    SLA_VENCIDO
}
