package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.application.reporte.ResumenTickets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** {@code GET /api/reportes/resumen}. Los mapas usan el nombre del estado, la prioridad o la categoría como clave. */
public record ResumenResponse(Instant generadoEn, long total, long vigentes, long sinAsignar, long vencidosSinResolver,
                              Map<String, Long> porEstado, Map<String, Long> porPrioridad,
                              Map<String, Long> porCategoria) {

    public static ResumenResponse de(ResumenTickets r) {
        return new ResumenResponse(r.generadoEn(), r.total(), r.vigentes(), r.sinAsignar(), r.vencidosSinResolver(),
                porNombre(r.porEstado()), porNombre(r.porPrioridad()), r.porCategoria());
    }

    /** Conserva el orden del enum (ABIERTO… CERRADO; CRITICA… BAJA). */
    static <E extends Enum<E>, V> Map<String, V> porNombre(Map<E, V> mapa) {
        Map<String, V> r = new LinkedHashMap<>();
        mapa.forEach((clave, valor) -> r.put(clave.name(), valor));
        return r;
    }
}
