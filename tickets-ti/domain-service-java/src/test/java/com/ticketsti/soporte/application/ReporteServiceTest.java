package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.reporte.*;
import com.ticketsti.soporte.domain.exception.AccesoDenegadoException;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-03 (RF-12): reportes de resumen, cumplimiento de SLA y desempeño por técnico, solo para el ADMIN. */
class ReporteServiceTest {

    private final Escenario e = new Escenario();
    private final Actor maria = Datos.usuario("maria");
    private final Actor admin = Datos.admin();

    private static Cumplimiento cumplimiento(long dentro, long fuera, Double porcentaje) {
        return new Cumplimiento(dentro + fuera, dentro, fuera, porcentaje);
    }

    @Test
    @DisplayName("Solo el ADMIN ve los reportes: USER y TECNICO reciben acceso denegado")
    void soloAdmin() {
        for (Actor otro : List.of(maria, Datos.tecnico("ana"))) {
            assertThrows(AccesoDenegadoException.class, () -> e.reporteService.resumen(otro));
            assertThrows(AccesoDenegadoException.class, () -> e.reporteService.cumplimientoSla(otro));
            assertThrows(AccesoDenegadoException.class, () -> e.reporteService.desempenoTecnicos(otro));
        }
        assertDoesNotThrow(() -> e.reporteService.resumen(admin));
    }

    @Test
    @DisplayName("Sin tickets: todo en cero, cada estado y prioridad presente, y sin porcentaje (no hay qué medir)")
    void sinDatos() {
        ResumenTickets r = e.reporteService.resumen(admin);
        assertEquals(0, r.total());
        assertEquals(EstadoTicket.values().length, r.porEstado().size());
        assertTrue(r.porEstado().values().stream().allMatch(n -> n == 0));
        assertEquals(Prioridad.values().length, r.porPrioridad().size());
        assertTrue(r.porCategoria().isEmpty());

        CumplimientoSla s = e.reporteService.cumplimientoSla(admin);
        assertEquals(cumplimiento(0, 0, null), s.total());
        assertEquals(Prioridad.values().length, s.porPrioridad().size());
        assertTrue(e.reporteService.desempenoTecnicos(admin).isEmpty());
    }

    @Test
    @DisplayName("Resumen: totales por estado, prioridad y categoría; vigentes, sin asignar y vencidos sin resolver")
    void resumen() {
        e.tecnico("ana", "hardware");
        e.crear(maria, "hardware", "alta");                         // ASIGNADO
        e.resolver(e.crear(maria, "hardware", "alta"));             // RESUELTO
        e.crear(maria, "redes", "media");                           // ABIERTO, sin técnico
        e.crear(maria, "redes", "critica");                         // ABIERTO, vence a las 4 h
        e.pasar(Duration.ofHours(5));

        ResumenTickets r = e.reporteService.resumen(admin);
        assertEquals(e.reloj.instant(), r.generadoEn());
        assertEquals(4, r.total());
        assertEquals(3, r.vigentes());
        assertEquals(2, r.sinAsignar());
        assertEquals(1, r.vencidosSinResolver());
        assertEquals(2L, r.porEstado().get(EstadoTicket.ABIERTO));
        assertEquals(1L, r.porEstado().get(EstadoTicket.ASIGNADO));
        assertEquals(1L, r.porEstado().get(EstadoTicket.RESUELTO));
        assertEquals(0L, r.porEstado().get(EstadoTicket.CERRADO));
        assertEquals(2L, r.porPrioridad().get(Prioridad.ALTA));
        assertEquals(0L, r.porPrioridad().get(Prioridad.BAJA));
        assertEquals(Map.of("HARDWARE", 2L, "REDES", 2L), r.porCategoria());
    }

    @Test
    @DisplayName("Cumplimiento de SLA: dentro y fuera del plazo, por prioridad; vigentes vencidos y en riesgo")
    void cumplimientoSla() {
        e.tecnico("ana", "hardware");
        Ticket aTiempo = e.crear(maria, "hardware", "alta");
        Ticket tarde = e.crear(maria, "hardware", "alta");
        e.crear(maria, "redes", "critica");                         // vence a las 4 h: vencido al final
        e.pasar(Duration.ofHours(2));
        e.resolver(aTiempo);                                        // 2 h de 8: dentro del plazo
        e.pasar(Duration.ofMinutes(220));                           // 5 h 40 min
        e.crear(maria, "redes", "critica");                         // al final lleva 200 de 240 min: en riesgo
        e.pasar(Duration.ofMinutes(200));                           // 9 h
        e.resolver(tarde);                                          // 9 h de 8: fuera del plazo

        CumplimientoSla s = e.reporteService.cumplimientoSla(admin);
        assertEquals(cumplimiento(1, 1, 50.0), s.total());
        assertEquals(cumplimiento(1, 1, 50.0), s.porPrioridad().get(Prioridad.ALTA));
        assertEquals(cumplimiento(0, 0, null), s.porPrioridad().get(Prioridad.CRITICA));
        assertEquals(1, s.vigentesVencidos());
        assertEquals(1, s.vigentesEnRiesgo());
    }

    @Test
    @DisplayName("Un ticket reabierto se mide con su nuevo plazo y cuenta una sola vez")
    void reabiertoConNuevoPlazo() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.pasar(Duration.ofHours(9));
        e.resolver(t);
        assertEquals(cumplimiento(0, 1, 0.0), e.reporteService.cumplimientoSla(admin).total());

        e.pasar(Duration.ofHours(1));
        e.ticketService.reabrir(maria, new ReabrirTicketCommand(t.getCodigo(), "Volvió a fallar"));
        assertEquals(cumplimiento(0, 0, null), e.reporteService.cumplimientoSla(admin).total(), "reabierto: vigente");

        e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "ana"));
        e.pasar(Duration.ofHours(1));
        Actor ana = Datos.tecnico("ana");
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "resuelto", "Ahora sí"));
        assertEquals(cumplimiento(1, 0, 100.0), e.reporteService.cumplimientoSla(admin).total());
    }

    @Test
    @DisplayName("Desempeño: cada técnico registrado, con vigentes, cumplimiento y tiempo promedio de resolución")
    void desempenoPorTecnico() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        e.tecnico("carla", "redes");
        Ticket t1 = e.crear(maria, "hardware", "alta");
        Ticket t2 = e.crear(maria, "hardware", "alta");
        Ticket t3 = e.crear(maria, "hardware", "alta");
        assertEquals(List.of("ana", "beto", "ana"), List.of(t1.getTecnico(), t2.getTecnico(), t3.getTecnico()));
        e.pasar(Duration.ofHours(2));
        e.resolver(t1);                                             // 120 min: dentro del plazo
        e.pasar(Duration.ofHours(8));
        e.resolver(t3);                                             // 600 min: fuera del plazo

        List<DesempenoTecnico> d = e.reporteService.desempenoTecnicos(admin);
        assertEquals(List.of("ana", "beto", "carla"), d.stream().map(DesempenoTecnico::tecnico).toList());
        assertEquals(new DesempenoTecnico("ana", 0, cumplimiento(1, 1, 50.0), 360L), d.get(0));
        assertEquals(new DesempenoTecnico("beto", 1, cumplimiento(0, 0, null), null), d.get(1));
        assertEquals(new DesempenoTecnico("carla", 0, cumplimiento(0, 0, null), null), d.get(2));
    }

    @Test
    @DisplayName("El porcentaje se redondea a un decimal")
    void porcentajeRedondeado() {
        assertEquals(66.7, Cumplimiento.de(2, 1).porcentaje());
        assertEquals(33.3, Cumplimiento.de(1, 2).porcentaje());
        assertNull(Cumplimiento.de(0, 0).porcentaje());
    }
}
