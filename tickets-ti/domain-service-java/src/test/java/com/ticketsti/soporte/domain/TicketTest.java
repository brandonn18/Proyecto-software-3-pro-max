package com.ticketsti.soporte.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.exception.TicketEstadoInvalidoException;
import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TicketTest {

    private static final Instant T0 = Datos.AHORA;

    private Ticket enProceso() {
        Ticket t = Datos.ticket();
        t.asignarA("ana", "sistema", true, T0);
        t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0);
        return t;
    }

    @Test
    @DisplayName("Un ticket nuevo nace ABIERTO, sin técnico, con SLA y primera línea de historial")
    void nace() {
        Ticket t = Datos.ticket();
        assertEquals(EstadoTicket.ABIERTO, t.getEstado());
        assertNull(t.getTecnico());
        assertEquals("maria", t.getCreadoPor());
        assertEquals(T0.plus(Duration.ofHours(8)), t.getVenceSla());
        assertEquals(0, t.getReaperturas());
        assertEquals(1, t.getHistorial().size());
        assertNull(t.getHistorial().get(0).de());
        assertEquals(EstadoTicket.ABIERTO, t.getHistorial().get(0).a());
    }

    @Test
    void elSlaDependeDeLaPrioridad() {
        assertEquals(T0.plus(Duration.ofHours(4)), Datos.ticket("TKT-2026-0002", "m", Prioridad.CRITICA).getVenceSla());
        assertEquals(T0.plus(Duration.ofHours(8)), Datos.ticket("TKT-2026-0002", "m", Prioridad.ALTA).getVenceSla());
        assertEquals(T0.plus(Duration.ofHours(24)), Datos.ticket("TKT-2026-0002", "m", Prioridad.MEDIA).getVenceSla());
        assertEquals(T0.plus(Duration.ofHours(72)), Datos.ticket("TKT-2026-0002", "m", Prioridad.BAJA).getVenceSla());
    }

    @Test
    void formatoDelCodigo() {
        assertEquals("TKT-2026-0007", Ticket.formatoCodigo(2026, 7));
        assertEquals("TKT-2026-0123", Ticket.formatoCodigo(2026, 123));
        assertEquals("TKT-2027-12345", Ticket.formatoCodigo(2027, 12345));
    }

    @Test
    void validaLosDatosAlCrear() {
        Categoria c = Categoria.de("redes");
        assertThrows(ValorInvalidoException.class, () -> Ticket.crear("TKT-1", "Título", "Descripción larga", TipoTicket.INCIDENTE, c, Prioridad.BAJA, "m", T0));
        assertThrows(ValorInvalidoException.class, () -> Ticket.crear("TKT-2026-0001", "ab", "Descripción larga", TipoTicket.INCIDENTE, c, Prioridad.BAJA, "m", T0));
        assertThrows(ValorInvalidoException.class, () -> Ticket.crear("TKT-2026-0001", "Título", "abcd", TipoTicket.INCIDENTE, c, Prioridad.BAJA, "m", T0));
        assertThrows(ValorInvalidoException.class, () -> Ticket.crear("TKT-2026-0001", "x".repeat(121), "Descripción larga", TipoTicket.INCIDENTE, c, Prioridad.BAJA, "m", T0));
        assertThrows(ValorInvalidoException.class, () -> Ticket.crear("TKT-2026-0001", "Título", "Descripción larga", TipoTicket.INCIDENTE, c, Prioridad.BAJA, " ", T0));
    }

    @Test
    @DisplayName("Asignar un ticket ABIERTO lo pasa a ASIGNADO y lo deja en el historial")
    void asigna() {
        Ticket t = Datos.ticket();
        t.asignarA("ana", "sistema", true, T0);
        assertEquals(EstadoTicket.ASIGNADO, t.getEstado());
        assertEquals("ana", t.getTecnico());
        assertEquals(2, t.getHistorial().size());
        assertEquals("Asignado automáticamente a ana", t.getHistorial().get(1).detalle());
    }

    @Test
    void reasignarConservaElEstadoDeAtencion() {
        Ticket t = enProceso();
        t.asignarA("beto", "admin", false, T0);
        assertEquals(EstadoTicket.EN_PROCESO, t.getEstado());
        assertEquals("beto", t.getTecnico());
        assertEquals("Reasignado de ana a beto", t.getHistorial().get(t.getHistorial().size() - 1).detalle());
    }

    @Test
    void noSeAsignaAlMismoTecnicoNiUnTicketTerminado() {
        Ticket t = enProceso();
        assertThrows(TicketEstadoInvalidoException.class, () -> t.asignarA("ana", "admin", false, T0));
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        assertThrows(TicketEstadoInvalidoException.class, () -> t.asignarA("beto", "admin", false, T0));
        assertEquals("ana", t.getTecnico());
    }

    @Test
    @DisplayName("El ciclo completo: asignado, en_proceso, en_espera, en_proceso, resuelto, cerrado")
    void cicloCompleto() {
        Ticket t = Datos.ticket();
        t.asignarA("ana", "sistema", true, T0);
        t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0);
        t.cambiarEstado(EstadoTicket.EN_ESPERA, "ana", "Esperando repuesto", T0);
        t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0);
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        t.cambiarEstado(EstadoTicket.CERRADO, "admin", null, T0);
        assertEquals(EstadoTicket.CERRADO, t.getEstado());
        assertEquals(7, t.getHistorial().size());
        assertEquals("Esperando repuesto", t.getHistorial().get(3).detalle());
        assertEquals(EstadoTicket.EN_PROCESO, t.getHistorial().get(3).de());
        assertEquals(EstadoTicket.EN_ESPERA, t.getHistorial().get(3).a());
    }

    @Test
    @DisplayName("Una transición fuera del ciclo se rechaza y el ticket no cambia")
    void transicionInvalida() {
        Ticket abierto = Datos.ticket();
        assertThrows(TicketEstadoInvalidoException.class, () -> abierto.cambiarEstado(EstadoTicket.RESUELTO, "x", null, T0));
        assertThrows(TicketEstadoInvalidoException.class, () -> abierto.cambiarEstado(EstadoTicket.ASIGNADO, "x", null, T0));
        assertEquals(EstadoTicket.ABIERTO, abierto.getEstado());
        assertEquals(1, abierto.getHistorial().size());

        Ticket t = enProceso();
        int lineas = t.getHistorial().size();
        assertThrows(TicketEstadoInvalidoException.class, () -> t.cambiarEstado(EstadoTicket.CERRADO, "x", null, T0));
        assertThrows(TicketEstadoInvalidoException.class, () -> t.cambiarEstado(EstadoTicket.ASIGNADO, "x", null, T0));
        assertEquals(EstadoTicket.EN_PROCESO, t.getEstado());
        assertEquals(lineas, t.getHistorial().size());
    }

    @Test
    void unTicketResueltoSoloPuedeCerrarse() {
        Ticket t = enProceso();
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        assertThrows(TicketEstadoInvalidoException.class, () -> t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0));
        t.cambiarEstado(EstadoTicket.CERRADO, "ana", null, T0);
        assertThrows(TicketEstadoInvalidoException.class, () -> t.cambiarEstado(EstadoTicket.ABIERTO, "ana", null, T0));
    }

    @Test
    @DisplayName("Reabrir: vuelve a ABIERTO, sin técnico, con el SLA reiniciado y una reapertura más")
    void reabre() {
        Ticket t = enProceso();
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        Instant despues = T0.plus(Duration.ofHours(10));
        t.reabrir("El problema volvió", "maria", despues);
        assertEquals(EstadoTicket.ABIERTO, t.getEstado());
        assertNull(t.getTecnico());
        assertEquals(despues.plus(Duration.ofHours(8)), t.getVenceSla());
        assertEquals(1, t.getReaperturas());
        assertEquals("Reabierto: El problema volvió", t.getHistorial().get(t.getHistorial().size() - 1).detalle());
    }

    @Test
    void tambienSeReabreUnTicketCerrado() {
        Ticket t = enProceso();
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        t.cambiarEstado(EstadoTicket.CERRADO, "ana", null, T0);
        t.reabrir("Otra vez", "maria", T0);
        assertEquals(EstadoTicket.ABIERTO, t.getEstado());
        t.asignarA("beto", "admin", false, T0);
        assertEquals(EstadoTicket.ASIGNADO, t.getEstado());
    }

    @Test
    void reabrirExigeMotivoYEstadoTerminado() {
        Ticket t = enProceso();
        assertThrows(TicketEstadoInvalidoException.class, () -> t.reabrir("motivo", "maria", T0));
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0);
        assertThrows(ValorInvalidoException.class, () -> t.reabrir(" ", "maria", T0));
        assertThrows(ValorInvalidoException.class, () -> t.reabrir(null, "maria", T0));
        assertEquals(EstadoTicket.RESUELTO, t.getEstado());
        assertEquals(0, t.getReaperturas());
        assertThrows(TicketEstadoInvalidoException.class, () -> Datos.ticket().reabrir("motivo", "maria", T0));
    }

    @Test
    void comentariosYMotivosTienenTope() {
        Ticket t = enProceso();
        String largo = "x".repeat(Ticket.LIMITE_TEXTO + 1);
        assertThrows(ValorInvalidoException.class, () -> t.cambiarEstado(EstadoTicket.EN_ESPERA, "ana", largo, T0));
        assertEquals(EstadoTicket.EN_PROCESO, t.getEstado());
        t.cambiarEstado(EstadoTicket.RESUELTO, "ana", "x".repeat(Ticket.LIMITE_TEXTO), T0);
        assertThrows(ValorInvalidoException.class, () -> t.reabrir(largo, "maria", T0));
        assertEquals(EstadoTicket.RESUELTO, t.getEstado());
    }

    @Test
    void elHistorialNoSeModificaDesdeFuera() {
        Ticket t = Datos.ticket();
        assertThrows(UnsupportedOperationException.class, () -> t.getHistorial().clear());
    }
}
