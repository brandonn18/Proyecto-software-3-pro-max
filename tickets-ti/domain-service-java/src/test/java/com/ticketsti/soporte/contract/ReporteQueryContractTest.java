package com.ticketsti.soporte.contract;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.application.reporte.FilaReporte;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * M-03: toda implementación del puerto de reportes (memoria, JPA…) debe devolver las mismas filas.
 * Igual que en {@link TicketRepositoryContractTest}, el @Transactional va aquí para que los @Test heredados se reviertan.
 */
@Transactional
public abstract class ReporteQueryContractTest {

    protected abstract TicketRepositoryPort tickets();

    protected abstract ReporteQueryPort reportes();

    private static final Instant T0 = Datos.AHORA;

    private Map<String, FilaReporte> filasPorCodigo() {
        return reportes().filas().stream().collect(Collectors.toMap(FilaReporte::codigo, Function.identity()));
    }

    @Test
    void sinTicketsNoHayFilas() {
        assertTrue(reportes().filas().isEmpty());
    }

    @Test
    void unaFilaPorTicketConSusDatos() {
        tickets().guardar(Datos.ticket("TKT-2026-0001", "maria", Prioridad.MEDIA));        // ABIERTO, sin técnico
        Ticket asignado = Datos.ticket("TKT-2026-0002", "jose", Prioridad.CRITICA);
        asignado.asignarA("ana", "sistema", true, T0);
        tickets().guardar(asignado);

        Map<String, FilaReporte> filas = filasPorCodigo();
        assertEquals(2, filas.size());

        FilaReporte abierto = filas.get("TKT-2026-0001");
        assertEquals(EstadoTicket.ABIERTO, abierto.estado());
        assertEquals(Prioridad.MEDIA, abierto.prioridad());
        assertEquals(Categoria.de("hardware"), abierto.categoria());
        assertNull(abierto.tecnico());
        assertEquals(T0.plus(Duration.ofHours(24)), abierto.venceSla());
        assertNull(abierto.resueltoEn());

        FilaReporte conTecnico = filas.get("TKT-2026-0002");
        assertEquals(EstadoTicket.ASIGNADO, conTecnico.estado());
        assertEquals("ana", conTecnico.tecnico());
        assertNull(conTecnico.resueltoEn());
    }

    @Test
    void resueltoEnEsLaUltimaResolucion() {
        Ticket resuelto = Datos.ticket("TKT-2026-0001", "maria", Prioridad.ALTA);
        resuelto.asignarA("ana", "sistema", true, T0);
        resuelto.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0.plusSeconds(60));
        resuelto.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0.plusSeconds(3600));
        tickets().guardar(resuelto);

        Ticket cerrado = Datos.ticket("TKT-2026-0002", "maria", Prioridad.ALTA);
        cerrado.asignarA("ana", "sistema", true, T0);
        cerrado.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0.plusSeconds(60));
        cerrado.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0.plusSeconds(1800));
        cerrado.cambiarEstado(EstadoTicket.CERRADO, "admin", null, T0.plusSeconds(7200));   // cerrar no es resolver
        tickets().guardar(cerrado);

        Ticket reabierto = Datos.ticket("TKT-2026-0003", "maria", Prioridad.ALTA);
        reabierto.asignarA("ana", "sistema", true, T0);
        reabierto.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, T0.plusSeconds(60));
        reabierto.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, T0.plusSeconds(600));
        reabierto.reabrir("Volvió", "maria", T0.plusSeconds(900));
        reabierto.asignarA("beto", "admin", false, T0.plusSeconds(960));
        reabierto.cambiarEstado(EstadoTicket.EN_PROCESO, "beto", null, T0.plusSeconds(1000));
        reabierto.cambiarEstado(EstadoTicket.RESUELTO, "beto", null, T0.plusSeconds(5000)); // la última vale
        tickets().guardar(reabierto);

        Map<String, FilaReporte> filas = filasPorCodigo();
        assertEquals(T0.plusSeconds(3600), filas.get("TKT-2026-0001").resueltoEn());
        assertEquals(EstadoTicket.CERRADO, filas.get("TKT-2026-0002").estado());
        assertEquals(T0.plusSeconds(1800), filas.get("TKT-2026-0002").resueltoEn());
        assertEquals(T0.plusSeconds(5000), filas.get("TKT-2026-0003").resueltoEn());
        assertEquals("beto", filas.get("TKT-2026-0003").tecnico());
        assertEquals(T0.plusSeconds(900).plus(Duration.ofHours(8)), filas.get("TKT-2026-0003").venceSla());
    }
}
