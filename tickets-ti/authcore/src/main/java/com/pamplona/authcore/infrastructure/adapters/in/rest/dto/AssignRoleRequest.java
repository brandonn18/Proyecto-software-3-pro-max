package com.pamplona.authcore.infrastructure.adapters.in.rest.dto;

import com.pamplona.authcore.domain.Role;
import jakarta.validation.constraints.NotNull;

public record AssignRoleRequest(
        @NotNull(message = "role es obligatorio") Role role
) {}
