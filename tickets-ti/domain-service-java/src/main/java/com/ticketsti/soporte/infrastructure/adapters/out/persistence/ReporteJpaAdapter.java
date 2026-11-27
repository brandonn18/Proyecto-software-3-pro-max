package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.reporte.FilaReporte;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository.TicketJpaRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** M-03: adaptador de solo lectura para los reportes. Una consulta, una fila liviana por ticket. */
@Component
@Transactional(readOnly = true)
public class ReporteJpaAdapter implements ReporteQueryPort {

    private final TicketJpaRepository jpa;

    public ReporteJpaAdapter(TicketJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public List<FilaReporte> filas() {
        return jpa.filasReporte(EstadoTicket.RESUELTO.name()).stream().map(ReporteJpaAdapter::fila).toList();
    }

    private static FilaReporte fila(Object[] c) {
        return new FilaReporte((String) c[0], EstadoTicket.valueOf((String) c[1]), Prioridad.valueOf((String) c[2]),
                Categoria.de((String) c[3]), (String) c[4], (Instant) c[5], (Instant) c[6]);
    }
}
