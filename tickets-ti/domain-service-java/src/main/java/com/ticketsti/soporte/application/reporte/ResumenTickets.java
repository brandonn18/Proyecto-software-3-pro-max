package com.ticketsti.soporte.application.reporte;

import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import java.time.Instant;
import java.util.Map;

/**
 * Reporte de resumen (M-03). Los mapas por estado y por prioridad traen todas las claves, aunque valgan 0.
 *
 * @param vigentes            no resueltos ni cerrados
 * @param sinAsignar          vigentes sin técnico
 * @param vencidosSinResolver vigentes cuyo SLA ya venció en {@code generadoEn}
 * @param porCategoria        por nombre de categoría, en orden alfabético
 */
public record ResumenTickets(Instant generadoEn, long total, long vigentes, long sinAsignar, long vencidosSinResolver,
                             Map<EstadoTicket, Long> porEstado, Map<Prioridad, Long> porPrioridad,
                             Map<String, Long> porCategoria) { }
