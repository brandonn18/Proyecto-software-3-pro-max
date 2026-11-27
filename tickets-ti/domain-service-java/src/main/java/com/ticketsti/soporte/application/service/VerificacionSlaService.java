package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.notificacion.TipoNotificacion;
import com.ticketsti.soporte.application.port.in.ResultadoVerificacionSla;
import com.ticketsti.soporte.application.port.in.VerificarSlaUseCase;
import com.ticketsti.soporte.application.port.out.NotificacionPort;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.application.port.out.TransaccionPort;
import com.ticketsti.soporte.domain.model.EventoSla;
import com.ticketsti.soporte.domain.model.Ticket;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * M-01 (RF-09). Las reglas (umbral del 80 %, vencimiento, no repetir) viven en {@link Ticket}; aquí solo se recorre,
 * se guarda y se informa.
 *
 * Cada ticket se procesa en su propia transacción y se vuelve a leer dentro de ella: así no se pisa un cambio que un
 * usuario haya hecho mientras tanto, y si uno falla (p. ej. conflicto de concurrencia) los demás siguen. Como la marca
 * del evento se guarda en el ticket, una pasada repetida o simultánea no alerta dos veces.
 *
 * M-02: cada evento se notifica después de su transacción, una sola vez (la marca ya quedó guardada).
 */
public class VerificacionSlaService implements VerificarSlaUseCase {

    private final TicketRepositoryPort tickets;
    private final TransaccionPort transaccion;
    private final Clock reloj;
    private final Avisos avisos;

    public VerificacionSlaService(TicketRepositoryPort tickets, TransaccionPort transaccion, Clock reloj,
                                  NotificacionPort notificaciones) {
        this.tickets = tickets;
        this.transaccion = transaccion;
        this.reloj = reloj;
        this.avisos = new Avisos(notificaciones);
    }

    /** Lo que dejó una verificación: el evento y el ticket ya guardado. */
    private record Registro(EventoSla evento, Ticket ticket) { }

    @Override
    public ResultadoVerificacionSla verificar() {
        Instant ahora = reloj.instant();
        List<String> alertados = new ArrayList<>();
        List<String> vencidos = new ArrayList<>();
        List<String> fallidos = new ArrayList<>();

        for (Ticket candidato : tickets.buscarVigentesSinSlaVencido()) {
            if (candidato.eventoSlaPendiente(ahora).isEmpty()) continue;   // sin novedades: no se escribe nada
            String codigo = candidato.getCodigo();
            Optional<Registro> registro;
            try {
                registro = transaccion.ejecutar(() -> registrar(codigo, ahora));
            } catch (RuntimeException e) {
                fallidos.add(codigo);
                continue;
            }
            registro.ifPresent(r -> {
                boolean vencio = r.evento() == EventoSla.VENCIDO;
                (vencio ? vencidos : alertados).add(codigo);
                avisos.enviar(Notificacion.delUltimoCambio(
                        vencio ? TipoNotificacion.SLA_VENCIDO : TipoNotificacion.SLA_ALERTA_80, r.ticket()));
            });
        }
        return new ResultadoVerificacionSla(alertados, vencidos, fallidos);
    }

    private Optional<Registro> registrar(String codigo, Instant ahora) {
        Optional<Ticket> actual = tickets.buscarPorCodigo(codigo);
        if (actual.isEmpty()) return Optional.empty();
        Ticket ticket = actual.get();
        return ticket.verificarSla(ahora).map(evento -> new Registro(evento, tickets.guardar(ticket)));
    }
}
