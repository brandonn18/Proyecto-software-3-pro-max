package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.ResultadoVerificacionSla;
import com.ticketsti.soporte.application.service.VerificacionSlaService;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.testsupport.Datos;
import com.ticketsti.soporte.testsupport.NotificacionesEnMemoria;
import com.ticketsti.soporte.testsupport.RelojAjustable;
import com.ticketsti.soporte.testsupport.TicketRepositoryEnMemoria;
import com.ticketsti.soporte.testsupport.TransaccionDirecta;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-01: el caso de uso que dispara el programador. Se prueba con reloj ajustable, sin Spring ni base de datos. */
class VerificacionSlaServiceTest {

    private final Escenario e = new Escenario();
    private final Actor maria = Datos.usuario("maria");

    private Ticket guardado(String codigo) {
        return e.tickets.buscarPorCodigo(codigo).orElseThrow();
    }

    @Test
    @DisplayName("ALTA (8 h): al 79 % no hay novedades, al 80 % alerta una vez y al 100 % lo marca vencido una vez")
    void ochentaPorCientoYVencido() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");

        e.pasar(Duration.ofSeconds(480 * 60 * 79 / 100));                 // 79 %
        assertTrue(e.slaService.verificar().sinNovedades());

        e.pasar(Duration.ofMinutes(384).minusSeconds(480 * 60 * 79 / 100)); // justo 80 %
        ResultadoVerificacionSla alerta = e.slaService.verificar();
        assertEquals(List.of(t.getCodigo()), alerta.alertados());
        assertEquals(List.of(), alerta.vencidos());
        assertEquals(e.reloj.instant(), guardado(t.getCodigo()).getAlertaSlaEn());

        int lineas = guardado(t.getCodigo()).getHistorial().size();
        e.pasar(Duration.ofMinutes(30));
        assertTrue(e.slaService.verificar().sinNovedades(), "no debe alertar dos veces");
        assertEquals(lineas, guardado(t.getCodigo()).getHistorial().size());

        e.pasar(Duration.ofMinutes(480 - 384 - 30));                        // 100 %
        ResultadoVerificacionSla vencido = e.slaService.verificar();
        assertEquals(List.of(), vencido.alertados());
        assertEquals(List.of(t.getCodigo()), vencido.vencidos());
        assertEquals(e.reloj.instant(), guardado(t.getCodigo()).getSlaVencidoEn());
        assertEquals(EstadoTicket.ASIGNADO, guardado(t.getCodigo()).getEstado());

        e.pasar(Duration.ofHours(5));
        assertTrue(e.slaService.verificar().sinNovedades(), "no debe marcarlo vencido dos veces");
    }

    @Test
    @DisplayName("Cada prioridad tiene su propio 80 %: a las 3 h 12 min solo alerta el CRITICA (4 h)")
    void cadaPrioridadConSuPlazo() {
        Ticket critica = e.crear(maria, "redes", "critica");
        Ticket baja = e.crear(maria, "redes", "baja");

        e.pasar(Duration.ofMinutes(192));
        ResultadoVerificacionSla r = e.slaService.verificar();
        assertEquals(List.of(critica.getCodigo()), r.alertados());
        assertNull(guardado(baja.getCodigo()).getAlertaSlaEn());
    }

    @Test
    @DisplayName("Los resueltos no se vigilan; si el servicio estuvo detenido, el vencido se marca sin alerta atrasada")
    void resueltosYAtrasados() {
        e.tecnico("ana", "hardware");
        Ticket resuelto = e.crear(maria, "hardware", "alta");
        Ticket olvidado = e.crear(maria, "hardware", "alta");
        e.resolver(resuelto);

        e.pasar(Duration.ofHours(10));
        ResultadoVerificacionSla r = e.slaService.verificar();
        assertEquals(List.of(), r.alertados());
        assertEquals(List.of(olvidado.getCodigo()), r.vencidos());
        assertNull(guardado(resuelto.getCodigo()).getSlaVencidoEn());
        assertNull(guardado(olvidado.getCodigo()).getAlertaSlaEn());
    }

    @Test
    @DisplayName("Si un ticket falla al guardarse, se informa y los demás se procesan igual")
    void unFalloNoDetieneAlResto() {
        TicketRepositoryEnMemoria repo = new TicketRepositoryEnMemoria() {
            @Override
            public Ticket guardar(Ticket t) {
                if ("TKT-2026-0001".equals(t.getCodigo()) && t.getSlaVencidoEn() != null) {
                    throw new IllegalStateException("conflicto de concurrencia simulado");
                }
                return super.guardar(t);
            }
        };
        repo.guardar(Datos.ticket("TKT-2026-0001", "maria", Prioridad.ALTA));
        repo.guardar(Datos.ticket("TKT-2026-0002", "maria", Prioridad.ALTA));
        RelojAjustable reloj = Datos.relojAjustable();
        VerificacionSlaService servicio = new VerificacionSlaService(repo, new TransaccionDirecta(), reloj,
                new NotificacionesEnMemoria());

        reloj.avanzar(Duration.ofHours(9));
        ResultadoVerificacionSla r = servicio.verificar();
        assertEquals(List.of("TKT-2026-0001"), r.fallidos());
        assertEquals(List.of("TKT-2026-0002"), r.vencidos());
        assertFalse(r.sinNovedades());
        assertNull(repo.buscarPorCodigo("TKT-2026-0001").orElseThrow().getSlaVencidoEn());

        // en la siguiente pasada se vuelve a intentar: la marca no quedó guardada
        assertEquals(List.of("TKT-2026-0001"), servicio.verificar().fallidos());
    }
}
