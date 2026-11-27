package com.ticketsti.soporte.infrastructure.security;

import java.util.List;

/** Lo que el domain service sabe de quien llama: viene del token firmado por AuthCore, no de una base de datos propia. */
public record UsuarioAutenticado(String username, Long uid, List<String> roles) { }
