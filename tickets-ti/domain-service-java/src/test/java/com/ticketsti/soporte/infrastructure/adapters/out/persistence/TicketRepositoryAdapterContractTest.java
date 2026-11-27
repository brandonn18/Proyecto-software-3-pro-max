package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.contract.TicketRepositoryContractTest;
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
@Import(TicketRepositoryAdapter.class)
class TicketRepositoryAdapterContractTest extends TicketRepositoryContractTest {

    @Autowired
    private TicketRepositoryAdapter adaptador;
    @Autowired
    private EntityManager em;

    @Override
    protected TicketRepositoryPort repo() {
        return new TicketRepositoryPort() {
            public Ticket guardar(Ticket t) { Ticket r = adaptador.guardar(t); em.flush(); em.clear(); return r; }
            public Optional<Ticket> buscarPorCodigo(String c) { return adaptador.buscarPorCodigo(c); }
            public long siguienteConsecutivo(int anio) { return adaptador.siguienteConsecutivo(anio); }
            public Map<String, Long> contarVigentesPorTecnico(Categoria c, Collection<String> u) { return adaptador.contarVigentesPorTecnico(c, u); }
            public List<Ticket> buscar(FiltroTicket f) { return adaptador.buscar(f); }
        };
    }
}
