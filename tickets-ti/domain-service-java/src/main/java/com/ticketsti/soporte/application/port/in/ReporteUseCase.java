package com.ticketsti.soporte.application.port.in;

import com.ticketsti.soporte.application.reporte.CumplimientoSla;
import com.ticketsti.soporte.application.reporte.DesempenoTecnico;
import com.ticketsti.soporte.application.reporte.ResumenTickets;
import com.ticketsti.soporte.domain.model.Actor;
import java.util.List;

/** M-03 (RF-12): reportes de gestión. Solo el ADMIN; para cualquier otro rol, acceso denegado (403). */
public interface ReporteUseCase {
    ResumenTickets resumen(Actor actor);
    CumplimientoSla cumplimientoSla(Actor actor);
    /** Un renglón por técnico registrado (y por cualquier otro que tenga tickets), en orden alfabético. */
    List<DesempenoTecnico> desempenoTecnicos(Actor actor);
}
