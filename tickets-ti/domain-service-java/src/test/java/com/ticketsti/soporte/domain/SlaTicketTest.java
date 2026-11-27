package com.ticketsti.soporte.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** M-01 (RF-09): alerta al consumir el 80 % del SLA y marcado de vencidos, una sola vez por ciclo de SLA. */
class SlaTicketTest {

    private static final Instant T0 = Datos.AHORA;

    /** ALTA: 8 h = 480 min. 79 % = 379 min 12 s; 80 % = 384 min. */
    private static final Instant AL_79 = T0.plusSeconds(480 * 60 * 79 / 100);
    private static final Instant AL_80 = T0.plus(Duration.ofMinutes(384));
    private static final Instant AL_90 = T0.plus(Duration.ofMinutes(432));
    private static final Instant VENCE = T0.plus(Duration.ofHours(8));

    private Ticket enProceso() {
        Ticket t = Datos.ticket();                       // ALTA, creado en T0
        t.asignarA("ana", "sistema", true, T0);
        t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0);
        return t;
    }

    @ParameterizedTest
    @EnumSource(Prioridad.class)
    @DisplayName("La alerta corresponde al 80 % del plazo de cada prioridad")
    void momentoDeLaAlerta(Prioridad prioridad) {
        Ticket t = Datos.ticket("TKT-2026-0001", "maria", prioridad);
        long segundos80 = prioridad.horasSla() * 3600L * 80 / 100;
        assertEquals(T0.plusSeconds(segundos80), t.momentoAlertaSla());
    }

    @Test
    @DisplayName("Al 79 % no pasa nada; al 80 % se alerta y queda en el historial, sin cambiar estado ni técnico")
    void alertaAlOchentaPorCiento() {
        Ticket t = enProceso();
        int lineas = t.getHistorial().size();

        assertEquals(Optional.empty(), t.verificarSla(AL_79));
        assertNull(t.getAlertaSlaEn());
        assertEquals(lineas, t.getHistorial().size());

        assertEquals(Optional.of(EventoSla.ALERTA_80), t.verificarSla(AL_80));
        assertEquals(AL_80, t.getAlertaSlaEn());
        assertNull(t.getSlaVencidoEn());
        assertEquals(EstadoTicket.EN_PROCESO, t.getEstado());
        assertEquals("ana", t.getTecnico());

        CambioTicket linea = t.getHistorial().get(lineas);
        assertEquals(EstadoTicket.EN_PROCESO, linea.de());
        assertEquals(EstadoTicket.EN_PROCESO, linea.a());
        assertEquals("sistema", linea.por());
        assertEquals(AL_80, linea.cuando());
        assertTrue(linea.detalle().contains("80 %"), linea.detalle());
    }

    @Test
    @DisplayName("La alerta no se repite: una segunda verificación antes del vencimiento no hace nada")
    void noAlertaDosVeces() {
        Ticket t = enProceso();
        t.verificarSla(AL_80);
        int lineas = t.getHistorial().size();

        assertEquals(Optional.empty(), t.verificarSla(AL_80));
        assertEquals(Optional.empty(), t.verificarSla(AL_90));
        assertEquals(AL_80, t.getAlertaSlaEn());
        assertEquals(lineas, t.getHistorial().size());
    }

    @Test
    @DisplayName("Al llegar al vencimiento se marca vencido una sola vez")
    void marcaVencido() {
        Ticket t = enProceso();
        t.verificarSla(AL_80);

        assertEquals(Optional.of(EventoSla.VENCIDO), t.verificarSla(VENCE));
        assertEquals(VENCE, t.getSlaVencidoEn());
        assertEquals(AL_80, t.getAlertaSlaEn());
        assertEquals("SLA vencido", t.getHistorial().get(t.getHistorial().size() - 1).detalle());

        int lineas = t.getHistorial().size();
        assertEquals(Optional.empty(), t.verificarSla(VENCE.plus(Duration.ofDays(3))));
        assertEquals(VENCE, t.getSlaVencidoEn());
        assertEquals(lineas, t.getHistorial().size());
    }

    @Test
    @DisplayName("Si ya venció sin alerta previa, solo se marca vencido: no llega una alerta atrasada")
    void vencidoSinAlertaPrevia() {
        Ticket t = enProceso();
        Instant tarde = VENCE.plus(Duration.ofHours(2));

        assertEquals(Optional.of(EventoSla.VENCIDO), t.verificarSla(tarde));
        assertNull(t.getAlertaSlaEn());
        assertEquals(tarde, t.getSlaVencidoEn());
        assertEquals(Optional.empty(), t.verificarSla(tarde.plusSeconds(60)));
        assertNull(t.getAlertaSlaEn());
    }

    @Test
    @DisplayName("Consultar el evento pendiente no modifica el ticket")
    void consultarNoModifica() {
        Ticket t = enProceso();
        int lineas = t.getHistorial().size();

        assertEquals(Optional.of(EventoSla.ALERTA_80), t.eventoSlaPendiente(AL_80));
        assertEquals(Optional.of(EventoSla.VENCIDO), t.eventoSlaPendiente(VENCE));
        assertNull(t.getAlertaSlaEn());
        assertNull(t.getSlaVencidoEn());
        assertEquals(lineas, t.getHistorial().size());
    }

    @Test
    @DisplayName("Los tickets resueltos o cerrados no se alertan ni se marcan, aunque haya pasado el plazo")
    void terminadosNoCuentan() {
        Ticket resuelto = enProceso();
        resuelto.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0.plusSeconds(60));
        assertEquals(Optional.empty(), resuelto.verificarSla(AL_80));
        assertEquals(Optional.empty(), resuelto.verificarSla(VENCE));

        Ticket cerrado = enProceso();
        cerrado.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0.plusSeconds(60));
        cerrado.cambiarEstado(EstadoTicket.CERRADO, "admin", null, T0.plusSeconds(120));
        assertEquals(Optional.empty(), cerrado.verificarSla(VENCE.plus(Duration.ofDays(1))));
        assertNull(cerrado.getSlaVencidoEn());
    }

    @Test
    @DisplayName("Los tickets ABIERTO sin técnico también se vigilan")
    void abiertoSinTecnico() {
        Ticket t = Datos.ticket();
        assertEquals(Optional.of(EventoSla.ALERTA_80), t.verificarSla(AL_80));
        assertEquals(EstadoTicket.ABIERTO, t.getEstado());
        assertNull(t.getTecnico());
    }

    @Test
    @DisplayName("Reabrir reinicia el SLA y sus marcas: el nuevo plazo vuelve a alertar y a vencer")
    void reabrirReiniciaLasMarcas() {
        Ticket t = enProceso();
        t.verificarSla(AL_80);
        t.verificarSla(VENCE);
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, VENCE.plusSeconds(60));

        Instant reapertura = VENCE.plus(Duration.ofHours(1));
        t.reabrir("Volvió a fallar", "maria", reapertura);
        assertNull(t.getAlertaSlaEn());
        assertNull(t.getSlaVencidoEn());
        assertEquals(reapertura.plus(Duration.ofMinutes(384)), t.momentoAlertaSla());

        assertEquals(Optional.empty(), t.verificarSla(reapertura.plus(Duration.ofMinutes(383))));
        assertEquals(Optional.of(EventoSla.ALERTA_80), t.verificarSla(reapertura.plus(Duration.ofMinutes(384))));
        assertEquals(Optional.of(EventoSla.VENCIDO), t.verificarSla(reapertura.plus(Duration.ofHours(8))));
    }
}
