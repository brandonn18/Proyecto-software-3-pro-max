package com.ticketsti.soporte.application.port.in.command;

/** Datos para registrar un ticket. Los textos se validan y convierten en el dominio. */
public record CrearTicketCommand(String titulo, String descripcion, String tipo, String categoria, String prioridad) { }
