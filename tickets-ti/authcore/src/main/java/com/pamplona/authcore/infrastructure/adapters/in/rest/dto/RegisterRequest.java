package com.pamplona.authcore.infrastructure.adapters.in.rest.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "username es obligatorio")
        @Size(max = 100, message = "username admite maximo 100 caracteres") String username,
        @NotBlank(message = "password es obligatorio")
        @Size(min = 6, message = "password debe tener al menos 6 caracteres") String password,
        // Opcional: domain-service lo usa para enviar notificaciones por correo
        @Email(message = "email invalido")
        @Size(max = 150, message = "email admite maximo 150 caracteres") String email
) {}
