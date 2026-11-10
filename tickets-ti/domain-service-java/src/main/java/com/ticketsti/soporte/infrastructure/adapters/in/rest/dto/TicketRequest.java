package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

public record TicketRequest(String titulo, String descripcion, String tipo, String categoria, String prioridad) { }
