package com.ticketsti.soporte.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.model.MedicionSla;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Reglas para medir un SLA desde su vencimiento: las usan el ticket (M-01) y los reportes (M-03). */
class MedicionSlaTest {

    private static final Instant INICIO = Datos.AHORA;
    private static final Instant VENCE_ALTA = INICIO.plus(Duration.ofHours(8));

    @Test
    @DisplayName("El inicio del plazo es el vencimiento menos las horas de la prioridad")
    void inicio() {
        assertEquals(INICIO, MedicionSla.inicio(Prioridad.ALTA, VENCE_ALTA));
        assertEquals(INICIO, MedicionSla.inicio(Prioridad.BAJA, INICIO.plus(Duration.ofHours(72))));
    }

    @Test
    @DisplayName("El momento de alerta es el 80 % del plazo")
    void momentoAlerta() {
        assertEquals(INICIO.plus(Duration.ofMinutes(384)), MedicionSla.momentoAlerta(Prioridad.ALTA, VENCE_ALTA));
        assertEquals(INICIO.plus(Duration.ofMinutes(192)),
                MedicionSla.momentoAlerta(Prioridad.CRITICA, INICIO.plus(Duration.ofHours(4))));
    }

    @Test
    @DisplayName("Vencido desde el instante del vencimiento; en riesgo entre el 80 % y el vencimiento")
    void vencidoYEnRiesgo() {
        Instant alerta = INICIO.plus(Duration.ofMinutes(384));
        assertFalse(MedicionSla.vencido(VENCE_ALTA, VENCE_ALTA.minusSeconds(1)));
        assertTrue(MedicionSla.vencido(VENCE_ALTA, VENCE_ALTA));

        assertFalse(MedicionSla.enRiesgo(Prioridad.ALTA, VENCE_ALTA, alerta.minusSeconds(1)));
        assertTrue(MedicionSla.enRiesgo(Prioridad.ALTA, VENCE_ALTA, alerta));
        assertTrue(MedicionSla.enRiesgo(Prioridad.ALTA, VENCE_ALTA, VENCE_ALTA.minusSeconds(1)));
        assertFalse(MedicionSla.enRiesgo(Prioridad.ALTA, VENCE_ALTA, VENCE_ALTA), "vencido ya no es «en riesgo»");
    }

    @Test
    @DisplayName("A tiempo si se resolvió antes de vencer; en el instante del vencimiento ya es tarde")
    void resueltoATiempo() {
        assertTrue(MedicionSla.resueltoATiempo(VENCE_ALTA.minusSeconds(1), VENCE_ALTA));
        assertFalse(MedicionSla.resueltoATiempo(VENCE_ALTA, VENCE_ALTA));
        assertFalse(MedicionSla.resueltoATiempo(VENCE_ALTA.plusSeconds(60), VENCE_ALTA));
    }

    @Test
    @DisplayName("El tiempo de resolución se cuenta desde el inicio del plazo vigente")
    void tiempoDeResolucion() {
        assertEquals(Duration.ofMinutes(90),
                MedicionSla.tiempoDeResolucion(Prioridad.ALTA, VENCE_ALTA, INICIO.plus(Duration.ofMinutes(90))));
    }
}
