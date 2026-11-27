package com.ticketsti.soporte.infrastructure.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Clave compartida con AuthCore (Base64). Llega por variable de entorno JWT_SECRET_BASE64. */
@ConfigurationProperties(prefix = "seguridad.jwt")
public record JwtProperties(String secretBase64) { }
