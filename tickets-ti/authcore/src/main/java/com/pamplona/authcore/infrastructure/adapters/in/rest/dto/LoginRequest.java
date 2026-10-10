package com.pamplona.authcore.infrastructure.adapters.in.rest.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "username es obligatorio") String username,
        @NotBlank(message = "password es obligatorio") String password
) {}
