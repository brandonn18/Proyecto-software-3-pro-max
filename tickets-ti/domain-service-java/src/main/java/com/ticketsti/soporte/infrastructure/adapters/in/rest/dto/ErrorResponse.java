package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import java.util.List;

public record ErrorResponse(int status, String error, String mensaje, List<String> detalles) {

    public static ErrorResponse de(int status, String error, String mensaje) {
        return new ErrorResponse(status, error, mensaje, List.of());
    }
}
