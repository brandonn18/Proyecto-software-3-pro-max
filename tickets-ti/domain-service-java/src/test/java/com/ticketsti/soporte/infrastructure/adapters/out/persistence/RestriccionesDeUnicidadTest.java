package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

/** La base de datos es la última defensa cuando dos registros iguales llegan al mismo tiempo. */
@DataJpaTest
@Import({TicketRepositoryAdapter.class, TecnicoRepositoryAdapter.class})
class RestriccionesDeUnicidadTest {

    @Autowired
    private TicketRepositoryAdapter tickets;
    @Autowired
    private TecnicoRepositoryAdapter tecnicos;

    @Test
    @DisplayName("Dos tickets con el mismo código: la base de datos lo rechaza")
    void codigoUnico() {
        tickets.guardar(Datos.ticket("TKT-2026-0001", "maria", com.ticketsti.soporte.domain.model.Prioridad.ALTA));
        assertThrows(DataIntegrityViolationException.class,
                () -> tickets.guardar(Datos.ticket("TKT-2026-0001", "jose", com.ticketsti.soporte.domain.model.Prioridad.BAJA)));
    }

    @Test
    @DisplayName("Dos técnicos con el mismo usuario: la base de datos lo rechaza")
    void usuarioUnico() {
        tecnicos.guardar(Tecnico.registrar("ana", List.of(Categoria.de("redes"))));
        assertThrows(DataIntegrityViolationException.class,
                () -> tecnicos.guardar(Tecnico.registrar("ana", List.of(Categoria.de("software")))));
    }
}
