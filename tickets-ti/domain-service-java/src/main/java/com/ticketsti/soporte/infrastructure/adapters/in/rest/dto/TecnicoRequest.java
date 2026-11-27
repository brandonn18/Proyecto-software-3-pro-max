package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import java.util.List;

public record TecnicoRequest(String username, List<String> categorias) { }
