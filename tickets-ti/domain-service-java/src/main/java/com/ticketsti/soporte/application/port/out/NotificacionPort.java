package com.ticketsti.soporte.application.port.out;

import com.ticketsti.soporte.application.notificacion.Notificacion;

/**
 * M-02 (RF-10): por aquí los casos de uso avisan creación, asignación, resolución y alertas de SLA, sin saber
 * si el aviso termina en un log, un correo o un Socket.io (cada canal es un adaptador de salida).
 *
 * Contrato: se llama después de guardar el cambio. Es de mejor esfuerzo: una falla al avisar no deshace la operación,
 * así que la implementación registra sus propios errores (quien llama los descarta).
 */
public interface NotificacionPort {
    void notificar(Notificacion notificacion);
}
