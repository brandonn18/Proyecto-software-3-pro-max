package com.ticketsti.soporte.application.port.in.command;

import java.util.List;

public record RegistrarTecnicoCommand(String username, List<String> categorias) { }
