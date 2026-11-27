package com.ticketsti.soporte.application.port.out;

import com.ticketsti.soporte.application.reporte.FilaReporte;
import java.util.List;

/**
 * M-03: puerto de solo lectura para los reportes, separado de {@link TicketRepositoryPort}. Los reportes no cargan
 * tickets completos ni pueden modificarlos: leen una fila liviana por ticket y calculan en la aplicación.
 */
public interface ReporteQueryPort {
    /** Una fila por ticket, en cualquier orden. */
    List<FilaReporte> filas();
}
