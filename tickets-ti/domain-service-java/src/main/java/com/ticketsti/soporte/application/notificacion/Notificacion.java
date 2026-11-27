package com.ticketsti.soporte.application.notificacion;

import com.ticketsti.soporte.domain.model.CambioTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.model.Ticket;
import java.time.Instant;

/**
 * Lo que se avisa: el hecho y los datos del ticket en ese momento. No dice a quién avisar: eso lo decide cada
 * adaptador (correo al creador, Socket.io al técnico...), así un canal nuevo no obliga a tocar los casos de uso.
 *
 * Vive fuera de {@code port.out} porque ahí solo hay interfaces (lo exige {@code ArquitecturaHexagonalTest}).
 *
 * @param tecnico técnico asignado, o null
 * @param cuando  momento del hecho (el de la línea del historial que lo originó)
 * @param detalle texto de esa línea del historial
 */
public record Notificacion(TipoNotificacion tipo, String codigo, String titulo, Prioridad prioridad,
                           String creadoPor, String tecnico, Instant cuando, String detalle) {

    /** La notificación de un hecho que quedó como la línea {@code linea} del historial del ticket. */
    public static Notificacion de(TipoNotificacion tipo, Ticket ticket, CambioTicket linea) {
        return new Notificacion(tipo, ticket.getCodigo(), ticket.getTitulo(), ticket.getPrioridad(),
                ticket.getCreadoPor(), ticket.getTecnico(), linea.cuando(), linea.detalle());
    }

    /** La notificación del último cambio del ticket. */
    public static Notificacion delUltimoCambio(TipoNotificacion tipo, Ticket ticket) {
        var historial = ticket.getHistorial();
        return de(tipo, ticket, historial.get(historial.size() - 1));
    }
}
