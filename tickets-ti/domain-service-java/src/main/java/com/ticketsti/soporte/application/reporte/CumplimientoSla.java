package com.ticketsti.soporte.application.reporte;

import com.ticketsti.soporte.domain.model.Prioridad;
import java.time.Instant;
import java.util.Map;

/**
 * Reporte de cumplimiento de SLA (M-03). Un ticket terminado cuenta dentro del plazo si su última resolución fue antes
 * del vencimiento de su SLA vigente; uno reabierto se mide con su nuevo plazo.
 *
 * @param porPrioridad     las cuatro prioridades, aunque no tengan tickets terminados
 * @param vigentesVencidos vigentes cuyo SLA ya venció en {@code generadoEn}
 * @param vigentesEnRiesgo vigentes que pasaron el 80 % del plazo sin vencer todavía
 */
public record CumplimientoSla(Instant generadoEn, Cumplimiento total, Map<Prioridad, Cumplimiento> porPrioridad,
                              long vigentesVencidos, long vigentesEnRiesgo) { }
