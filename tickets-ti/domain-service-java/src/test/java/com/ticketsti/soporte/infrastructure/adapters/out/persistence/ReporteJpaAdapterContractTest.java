package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.contract.ReporteQueryContractTest;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import jakarta.persistence.EntityManager;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import({TicketRepositoryAdapter.class, ReporteJpaAdapter.class})
class ReporteJpaAdapterContractTest extends ReporteQueryContractTest {

    @Autowired
    private TicketRepositoryAdapter ticketsJpa;

    @Autowired
    private ReporteJpaAdapter reportesJpa;

    @Autowired
    private EntityManager em;

    /** Guarda y vacía el contexto de persistencia: así la consulta de reportes lee de la base, no de la memoria de JPA. */
    @Override
    protected TicketRepositoryPort tickets() {
        return new TicketRepositoryPort() {
            public Ticket guardar(Ticket t) { Ticket r = ticketsJpa.guardar(t); em.flush(); em.clear(); return r; }
            public Optional<Ticket> buscarPorCodigo(String c) { return ticketsJpa.buscarPorCodigo(c); }
            public long siguienteConsecutivo(int anio) { return ticketsJpa.siguienteConsecutivo(anio); }
            public Map<String, Long> contarVigentesPorTecnico(Categoria c, Collection<String> u) { return ticketsJpa.contarVigentesPorTecnico(c, u); }
            public List<Ticket> buscar(FiltroTicket f) { return ticketsJpa.buscar(f); }
            public Pagina<Ticket> buscar(FiltroTicket f, Paginacion p) { return ticketsJpa.buscar(f, p); }
            public List<Ticket> buscarVigentesSinSlaVencido() { return ticketsJpa.buscarVigentesSinSlaVencido(); }
        };
    }

    @Override
    protected ReporteQueryPort reportes() {
        return reportesJpa;
    }
}
