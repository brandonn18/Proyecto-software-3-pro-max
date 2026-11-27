package com.ticketsti.soporte.application.port.in;

import java.util.List;

/**
 * Resultado de una pasada de {@link VerificarSlaUseCase}, con los códigos de ticket de cada grupo.
 * @param alertados tickets que acaban de consumir el 80 % de su SLA
 * @param vencidos  tickets que acaban de vencer
 * @param fallidos  tickets que no se pudieron guardar (p. ej. por un cambio concurrente); se reintentan en la próxima pasada
 */
public record ResultadoVerificacionSla(List<String> alertados, List<String> vencidos, List<String> fallidos) {

    public ResultadoVerificacionSla {
        alertados = List.copyOf(alertados);
        vencidos = List.copyOf(vencidos);
        fallidos = List.copyOf(fallidos);
    }

    public boolean sinNovedades() {
        return alertados.isEmpty() && vencidos.isEmpty() && fallidos.isEmpty();
    }
}
