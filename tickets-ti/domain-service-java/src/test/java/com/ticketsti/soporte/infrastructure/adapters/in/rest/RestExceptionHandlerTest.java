package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

class RestExceptionHandlerTest {

    private final RestExceptionHandler handler = new RestExceptionHandler();

    @Test
    @DisplayName("Bloqueo optimista: 409 con mensaje de concurrencia")
    void bloqueoOptimista() {
        var r = handler.concurrencia(new ObjectOptimisticLockingFailureException("TicketEntity", 1L));
        assertThat(r.getStatusCode().value()).isEqualTo(409);
        assertThat(r.getBody().mensaje()).contains("al mismo tiempo");
    }

    @Test
    @DisplayName("Violación de integridad: 409 con mensaje neutro, sin detalles SQL ni concurrencia")
    void integridad() {
        var r = handler.integridad(new DataIntegrityViolationException("Duplicate entry 'x' for key 'uk_tickets_codigo'"));
        assertThat(r.getStatusCode().value()).isEqualTo(409);
        String mensaje = r.getBody().mensaje();
        assertThat(mensaje).doesNotContainIgnoringCase("concurren").doesNotContain("Duplicate").doesNotContain("uk_");
    }
}
