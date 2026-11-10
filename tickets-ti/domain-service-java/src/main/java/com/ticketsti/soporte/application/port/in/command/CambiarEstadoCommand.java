package com.ticketsti.soporte.application.port.in.command;

public record CambiarEstadoCommand(String codigo, String estado, String comentario) { }
