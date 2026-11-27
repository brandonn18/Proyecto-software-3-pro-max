package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.application.reporte.CumplimientoSla;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** {@code GET /api/reportes/sla}. */
public record CumplimientoSlaResponse(Instant generadoEn, CumplimientoResponse total,
                                      Map<String, CumplimientoResponse> porPrioridad,
                                      long vigentesVencidos, long vigentesEnRiesgo) {

    public static CumplimientoSlaResponse de(CumplimientoSla s) {
        Map<String, CumplimientoResponse> porPrioridad = new LinkedHashMap<>();
        s.porPrioridad().forEach((p, c) -> porPrioridad.put(p.name(), CumplimientoResponse.de(c)));
        return new CumplimientoSlaResponse(s.generadoEn(), CumplimientoResponse.de(s.total()), porPrioridad,
                s.vigentesVencidos(), s.vigentesEnRiesgo());
    }
}
