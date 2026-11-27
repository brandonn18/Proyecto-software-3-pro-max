package com.ticketsti.soporte.infrastructure.adapters.in.programacion;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.ResultadoVerificacionSla;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** El adaptador programado solo dispara el caso de uso; un error no debe escapar al programador de Spring. */
class VerificacionSlaProgramadaTest {

    @Test
    @DisplayName("Cada ejecución llama una vez al caso de uso")
    void llamaAlCasoDeUso() {
        AtomicInteger llamadas = new AtomicInteger();
        var programada = new VerificacionSlaProgramada(() -> {
            llamadas.incrementAndGet();
            return new ResultadoVerificacionSla(List.of("TKT-2026-0001"), List.of(), List.of());
        });

        programada.ejecutar();
        programada.ejecutar();
        assertEquals(2, llamadas.get());
    }

    @Test
    @DisplayName("Si el caso de uso falla, el error se registra y no se propaga")
    void unErrorNoSePropaga() {
        var programada = new VerificacionSlaProgramada(() -> {
            throw new IllegalStateException("base de datos caída");
        });
        assertDoesNotThrow(programada::ejecutar);
    }
}
