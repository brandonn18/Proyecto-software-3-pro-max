package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.port.out.NotificacionPort;

/**
 * Envía por {@link NotificacionPort} sin que una falla del canal llegue a quien llamó: cuando se avisa, la operación
 * ya quedó guardada, y responder un error haría creer que no se hizo. El adaptador registra sus propios errores.
 */
final class Avisos {

    private final NotificacionPort canal;

    Avisos(NotificacionPort canal) {
        this.canal = canal;
    }

    void enviar(Notificacion notificacion) {
        try {
            canal.notificar(notificacion);
        } catch (RuntimeException e) {
            // mejor esfuerzo: ver el contrato de NotificacionPort
        }
    }
}
