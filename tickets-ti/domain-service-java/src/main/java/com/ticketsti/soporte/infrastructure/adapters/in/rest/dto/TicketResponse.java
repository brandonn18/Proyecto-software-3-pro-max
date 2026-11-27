package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.domain.model.Ticket;
import java.time.Instant;
import java.util.List;

public record TicketResponse(String codigo, String titulo, String descripcion, String tipo, String categoria,
                             String prioridad, String estado, String creadoPor, String tecnico, Instant creadoEn,
                             Instant venceSla, int reaperturas, List<CambioResponse> historial) {

    public static TicketResponse de(Ticket t) {
        return new TicketResponse(t.getCodigo(), t.getTitulo(), t.getDescripcion(), t.getTipo().name(),
                t.getCategoria().nombre(), t.getPrioridad().name(), t.getEstado().name(), t.getCreadoPor(), t.getTecnico(),
                t.getCreadoEn(), t.getVenceSla(), t.getReaperturas(), t.getHistorial().stream().map(CambioResponse::de).toList());
    }
}
