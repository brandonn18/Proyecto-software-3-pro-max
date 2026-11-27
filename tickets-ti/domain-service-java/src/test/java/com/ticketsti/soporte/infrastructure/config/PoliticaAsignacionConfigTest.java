package com.ticketsti.soporte.infrastructure.config;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.service.AsignacionPorMenorCarga;
import com.ticketsti.soporte.domain.service.AsignacionPorMenosCriticos;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-07: la política de asignación se elige con negocio.asignacion.politica; un valor desconocido no deja arrancar. */
class PoliticaAsignacionConfigTest {

    private final BeanConfig config = new BeanConfig();

    @Test
    @DisplayName("menor-carga (por defecto) y menos-criticos, sin importar mayúsculas ni espacios")
    void nombresValidos() {
        assertInstanceOf(AsignacionPorMenorCarga.class, config.politicaAsignacion("menor-carga"));
        assertInstanceOf(AsignacionPorMenosCriticos.class, config.politicaAsignacion("menos-criticos"));
        assertInstanceOf(AsignacionPorMenosCriticos.class, config.politicaAsignacion("  MENOS-CRITICOS "));
    }

    @Test
    @DisplayName("Un nombre desconocido falla al arrancar, con los valores válidos en el mensaje")
    void nombreDesconocido() {
        var error = assertThrows(IllegalArgumentException.class, () -> config.politicaAsignacion("al-azar"));
        assertTrue(error.getMessage().contains("menor-carga") && error.getMessage().contains("menos-criticos"),
                error.getMessage());
    }
}
