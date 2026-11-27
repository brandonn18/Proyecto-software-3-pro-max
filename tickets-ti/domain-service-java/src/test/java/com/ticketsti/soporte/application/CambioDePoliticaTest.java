package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.service.AsignacionPorMenosCriticos;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.testsupport.Datos;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * M-07 (Strategy / OCP): la misma {@code TicketService}, sin tocar una línea, asigna distinto según la política que
 * recibe. Con la política por defecto gana quien tiene menos tickets vigentes; con la alternativa, quien tiene menos
 * tickets CRITICA.
 */
class CambioDePoliticaTest {

    private final Actor maria = Datos.usuario("maria");

    /** ana atiende un ticket CRITICA; beto, dos de prioridad BAJA. Todos vigentes, en hardware. */
    private Escenario conCarga(Escenario e) {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        guardarAsignado(e, "TKT-2026-0001", Prioridad.CRITICA, "ana");
        guardarAsignado(e, "TKT-2026-0002", Prioridad.BAJA, "beto");
        guardarAsignado(e, "TKT-2026-0003", Prioridad.BAJA, "beto");
        return e;
    }

    private static void guardarAsignado(Escenario e, String codigo, Prioridad prioridad, String tecnico) {
        Ticket t = Datos.ticket(codigo, "jose", prioridad);
        t.asignarA(tecnico, "sistema", true, Datos.AHORA);
        e.tickets.guardar(t);
    }

    @Test
    @DisplayName("Política por defecto (menor carga): el ticket nuevo va a ana, que tiene 1 vigente contra 2")
    void porDefectoMenorCarga() {
        Ticket nuevo = conCarga(new Escenario()).crear(maria, "hardware", "media");
        assertEquals("ana", nuevo.getTecnico());
        assertEquals("TKT-2026-0004", nuevo.getCodigo());
    }

    @Test
    @DisplayName("Con la política de menos críticos, el mismo servicio lo asigna a beto, que no tiene críticos")
    void conMenosCriticos() {
        PoliticaAsignacion otra = new AsignacionPorMenosCriticos();
        Ticket nuevo = conCarga(new Escenario(otra)).crear(maria, "hardware", "media");
        assertEquals("beto", nuevo.getTecnico());
    }
}
