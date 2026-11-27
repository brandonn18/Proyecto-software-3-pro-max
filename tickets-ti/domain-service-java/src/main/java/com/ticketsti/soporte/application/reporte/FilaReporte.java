package com.ticketsti.soporte.application.reporte;

import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.time.Instant;

/**
 * Lo mínimo de un ticket que necesitan los reportes (M-03), sin su historial completo.
 *
 * @param tecnico    técnico asignado, o null
 * @param venceSla   vencimiento del SLA vigente (tras reabrir, el nuevo)
 * @param resueltoEn momento de la última vez que pasó a RESUELTO, o null si nunca se resolvió
 */
public record FilaReporte(String codigo, EstadoTicket estado, Prioridad prioridad, Categoria categoria, String tecnico,
                          Instant venceSla, Instant resueltoEn) {

    /** Resuelto o cerrado, con su resolución registrada: es lo que se puede medir contra el SLA. */
    public boolean terminado() {
        return !estado.estaVigente() && resueltoEn != null;
    }
}
