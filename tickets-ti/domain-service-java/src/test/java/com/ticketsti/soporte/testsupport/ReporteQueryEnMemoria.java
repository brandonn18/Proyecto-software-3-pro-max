package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.reporte.FilaReporte;
import com.ticketsti.soporte.domain.model.CambioTicket;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Ticket;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/** Doble de prueba del puerto de reportes: arma las filas a partir del repositorio de tickets en memoria. */
public class ReporteQueryEnMemoria implements ReporteQueryPort {

    private final TicketRepositoryEnMemoria tickets;

    public ReporteQueryEnMemoria(TicketRepositoryEnMemoria tickets) {
        this.tickets = tickets;
    }

    @Override
    public List<FilaReporte> filas() {
        return tickets.buscar(new FiltroTicket(null, null, null, null, null, null)).stream()
                .map(ReporteQueryEnMemoria::fila)
                .toList();
    }

    private static FilaReporte fila(Ticket t) {
        Instant resueltoEn = t.getHistorial().stream()
                .filter(c -> c.a() == EstadoTicket.RESUELTO)
                .map(CambioTicket::cuando)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return new FilaReporte(t.getCodigo(), t.getEstado(), t.getPrioridad(), t.getCategoria(), t.getTecnico(),
                t.getVenceSla(), resueltoEn);
    }
}
