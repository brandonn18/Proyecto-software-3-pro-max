package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.application.reporte.DesempenoTecnico;

/** Un renglón de {@code GET /api/reportes/tecnicos}. {@code minutosPromedioResolucion} es null si no resolvió ninguno. */
public record DesempenoTecnicoResponse(String tecnico, long vigentes, CumplimientoResponse cumplimiento,
                                       Long minutosPromedioResolucion) {

    public static DesempenoTecnicoResponse de(DesempenoTecnico d) {
        return new DesempenoTecnicoResponse(d.tecnico(), d.vigentes(), CumplimientoResponse.de(d.cumplimiento()),
                d.minutosPromedioResolucion());
    }
}
