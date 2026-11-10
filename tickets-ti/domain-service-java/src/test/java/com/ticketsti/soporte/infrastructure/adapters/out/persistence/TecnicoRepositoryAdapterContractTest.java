package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.contract.TecnicoRepositoryContractTest;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

/** El adaptador JPA pasa EXACTAMENTE las mismas pruebas que el doble en memoria (Liskov). */
@DataJpaTest
@Import(TecnicoRepositoryAdapter.class)
class TecnicoRepositoryAdapterContractTest extends TecnicoRepositoryContractTest {

    @Autowired
    private TecnicoRepositoryAdapter adaptador;
    @Autowired
    private EntityManager em;

    /** Después de cada guardar se vacía la caché de Hibernate: así las lecturas van de verdad a la base de datos. */
    @Override
    protected TecnicoRepositoryPort repo() {
        return new TecnicoRepositoryPort() {
            public Tecnico guardar(Tecnico t) { Tecnico r = adaptador.guardar(t); em.flush(); em.clear(); return r; }
            public Optional<Tecnico> buscarPorUsername(String u) { return adaptador.buscarPorUsername(u); }
            public List<Tecnico> buscarPorCategoria(Categoria c) { return adaptador.buscarPorCategoria(c); }
            public List<Tecnico> listar() { return adaptador.listar(); }
        };
    }
}
