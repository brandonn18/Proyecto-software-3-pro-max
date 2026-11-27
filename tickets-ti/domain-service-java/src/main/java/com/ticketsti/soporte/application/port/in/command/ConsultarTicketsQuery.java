package com.ticketsti.soporte.application.port.in.command;

/** Todos los filtros son opcionales y se combinan con «y». */
public record ConsultarTicketsQuery(String estado, String prioridad, String categoria, String tipo) {

    public static ConsultarTicketsQuery sinFiltros() {
        return new ConsultarTicketsQuery(null, null, null, null);
    }
}
