package com.ticketsti.soporte.contract;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/**
 * Toda implementación del puerto (memoria, JPA…) debe pasar estas mismas pruebas.
 *
 * @Transactional va AQUI y no solo en las subclases JPA: Spring busca la anotacion de clase en la clase que declara
 * el metodo de prueba (esta), asi que sin ella los @Test heredados no corren en transaccion y los datos no se revierten.
 * Los dobles en memoria la ignoran.
 */
@Transactional
public abstract class TicketRepositoryContractTest {

    protected abstract TicketRepositoryPort repo();

    private Ticket guardar(String codigo, String creador, Prioridad prio, String categoria, long minutos) {
        return repo().guardar(Ticket.crear(codigo, "Título " + codigo, "Descripción de " + codigo, TipoTicket.INCIDENTE,
                Categoria.de(categoria), prio, creador, Datos.AHORA.plus(Duration.ofMinutes(minutos))));
    }

    private static FiltroTicket filtro(EstadoTicket e, Prioridad p, String cat, String creador, String asignado) {
        return new FiltroTicket(e, p, cat == null ? null : Categoria.de(cat), null, creador, asignado);
    }

    @Test
    void guardaYRecuperaTodoElTicketConSuHistorial() {
        Ticket t = Datos.ticket();
        t.asignarA("ana", "sistema", true, Datos.AHORA);
        t.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", "Empecé", Datos.AHORA.plusSeconds(60));
        Ticket g = repo().guardar(t);
        assertNotNull(g.getId());
        Ticket r = repo().buscarPorCodigo("TKT-2026-0001").orElseThrow();
        assertEquals(g.getId(), r.getId());
        assertEquals("Impresora sin respuesta", r.getTitulo());
        assertEquals(TipoTicket.INCIDENTE, r.getTipo());
        assertEquals("HARDWARE", r.getCategoria().nombre());
        assertEquals(Prioridad.ALTA, r.getPrioridad());
        assertEquals(EstadoTicket.EN_PROCESO, r.getEstado());
        assertEquals("maria", r.getCreadoPor());
        assertEquals("ana", r.getTecnico());
        assertEquals(t.getVenceSla(), r.getVenceSla());
        assertEquals(0, r.getReaperturas());
        assertEquals(3, r.getHistorial().size());
        assertNull(r.getHistorial().get(0).de());
        assertEquals(EstadoTicket.ASIGNADO, r.getHistorial().get(1).a());
        assertEquals("Empecé", r.getHistorial().get(2).detalle());
        assertEquals(Datos.AHORA.plusSeconds(60), r.getHistorial().get(2).cuando());
    }

    @Test
    void actualizaUnTicketExistente() {
        Ticket g = repo().guardar(Datos.ticket());
        g.asignarA("ana", "sistema", true, Datos.AHORA);
        repo().guardar(g);
        Ticket r = repo().buscarPorCodigo("TKT-2026-0001").orElseThrow();
        assertEquals(g.getId(), r.getId());
        assertEquals("ana", r.getTecnico());
        assertEquals(2, r.getHistorial().size());
        r.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, Datos.AHORA);
        r.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, Datos.AHORA);
        r.reabrir("Volvió", "maria", Datos.AHORA.plusSeconds(3600));
        repo().guardar(r);
        Ticket otra = repo().buscarPorCodigo("TKT-2026-0001").orElseThrow();
        assertNull(otra.getTecnico());
        assertEquals(1, otra.getReaperturas());
        assertEquals(5, otra.getHistorial().size());
        assertEquals(1, repo().buscar(filtro(null, null, null, null, null)).size());
    }

    @Test
    void inexistenteDevuelveVacio() {
        assertTrue(repo().buscarPorCodigo("TKT-2026-0099").isEmpty());
    }

    @Test
    void siguienteConsecutivoPorAnio() {
        assertEquals(1, repo().siguienteConsecutivo(2026));
        guardar("TKT-2026-0001", "maria", Prioridad.ALTA, "redes", 0);
        guardar("TKT-2026-0007", "maria", Prioridad.ALTA, "redes", 1);
        guardar("TKT-2025-0050", "maria", Prioridad.ALTA, "redes", 2);
        assertEquals(8, repo().siguienteConsecutivo(2026));
        assertEquals(51, repo().siguienteConsecutivo(2025));
        assertEquals(1, repo().siguienteConsecutivo(2027));
    }

    @Test
    void cuentaLosTicketsVigentesPorTecnicoYCategoria() {
        Ticket a = guardar("TKT-2026-0001", "m", Prioridad.ALTA, "hardware", 0);
        a.asignarA("ana", "s", true, Datos.AHORA);
        repo().guardar(a);
        Ticket b = guardar("TKT-2026-0002", "m", Prioridad.ALTA, "hardware", 1);
        b.asignarA("ana", "s", true, Datos.AHORA);
        repo().guardar(b);
        Ticket c = guardar("TKT-2026-0003", "m", Prioridad.ALTA, "software", 2);   // otra categoría
        c.asignarA("ana", "s", true, Datos.AHORA);
        repo().guardar(c);
        Ticket d = guardar("TKT-2026-0004", "m", Prioridad.ALTA, "hardware", 3);
        d.asignarA("beto", "s", true, Datos.AHORA);
        d.cambiarEstado(EstadoTicket.EN_PROCESO, "beto", null, Datos.AHORA);
        d.cambiarEstado(EstadoTicket.RESUELTO, "beto", null, Datos.AHORA);          // ya no cuenta
        repo().guardar(d);
        guardar("TKT-2026-0005", "m", Prioridad.ALTA, "hardware", 4);              // sin técnico

        Collection<String> usuarios = List.of("ana", "beto", "carla");
        Map<String, Long> carga = repo().contarVigentesPorTecnico(Categoria.de("hardware"), usuarios);
        assertEquals(2L, carga.getOrDefault("ana", 0L).longValue());
        assertEquals(0L, carga.getOrDefault("beto", 0L).longValue());
        assertEquals(0L, carga.getOrDefault("carla", 0L).longValue());
        assertEquals(1L, repo().contarVigentesPorTecnico(Categoria.de("software"), usuarios).getOrDefault("ana", 0L).longValue());
    }

    @Test
    void buscaConFiltrosCombinadosYMasRecientesPrimero() {
        guardar("TKT-2026-0001", "maria", Prioridad.ALTA, "hardware", 0);
        guardar("TKT-2026-0002", "maria", Prioridad.BAJA, "hardware", 1);
        guardar("TKT-2026-0003", "jose", Prioridad.ALTA, "software", 2);
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0002", "TKT-2026-0001"), codigos(filtro(null, null, null, null, null)));
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0001"), codigos(filtro(null, Prioridad.ALTA, null, null, null)));
        assertEquals(List.of("TKT-2026-0001"), codigos(filtro(null, Prioridad.ALTA, "hardware", null, null)));
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0002", "TKT-2026-0001"), codigos(filtro(EstadoTicket.ABIERTO, null, null, null, null)));
        assertEquals(0, codigos(filtro(EstadoTicket.CERRADO, null, null, null, null)).size());
        assertEquals(List.of("TKT-2026-0002", "TKT-2026-0001"), codigos(filtro(null, null, null, "maria", null)));
        assertEquals(List.of("TKT-2026-0003"), codigos(new FiltroTicket(null, null, null, TipoTicket.INCIDENTE, "jose", null)));
        assertEquals(0, codigos(new FiltroTicket(null, null, null, TipoTicket.SOLICITUD, null, null)).size());
    }

    @Test
    void visibilidadPorCreadorOAsignado() {
        guardar("TKT-2026-0001", "maria", Prioridad.ALTA, "hardware", 0);
        Ticket b = guardar("TKT-2026-0002", "jose", Prioridad.ALTA, "hardware", 1);
        b.asignarA("ana", "s", true, Datos.AHORA);
        repo().guardar(b);
        Ticket c = guardar("TKT-2026-0003", "ana", Prioridad.ALTA, "software", 2);
        // creador O asignado: ana ve lo que creó (0003) y lo que tiene asignado (0002)
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0002"), codigos(filtro(null, null, null, "ana", "ana")));
        assertEquals(List.of("TKT-2026-0002"), codigos(filtro(null, null, null, null, "ana")));
        assertNotNull(c.getId());
    }

    @Test
    void guardaLasMarcasDeSla() {
        Ticket t = Datos.ticket();                                       // ALTA: 80 % a los 384 min, vence a las 8 h
        Instant alerta = Datos.AHORA.plus(Duration.ofMinutes(384));
        Instant vence = Datos.AHORA.plus(Duration.ofHours(8));
        t.verificarSla(alerta);
        t.verificarSla(vence);
        repo().guardar(t);

        Ticket r = repo().buscarPorCodigo("TKT-2026-0001").orElseThrow();
        assertEquals(alerta, r.getAlertaSlaEn());
        assertEquals(vence, r.getSlaVencidoEn());
        assertEquals(3, r.getHistorial().size());
        assertEquals("SLA vencido", r.getHistorial().get(2).detalle());

        Ticket sinMarcas = repo().guardar(Datos.ticket("TKT-2026-0002", "maria", Prioridad.BAJA));
        assertNull(repo().buscarPorCodigo(sinMarcas.getCodigo()).orElseThrow().getAlertaSlaEn());
        assertNull(repo().buscarPorCodigo(sinMarcas.getCodigo()).orElseThrow().getSlaVencidoEn());
    }

    @Test
    void buscaLosVigentesSinSlaVencidoPorVencimiento() {
        guardar("TKT-2026-0001", "m", Prioridad.BAJA, "hardware", 0);       // vence a las 72 h
        guardar("TKT-2026-0002", "m", Prioridad.CRITICA, "hardware", 1);    // vence a las 4 h: primero
        Ticket vencido = guardar("TKT-2026-0003", "m", Prioridad.ALTA, "hardware", 2);
        vencido.verificarSla(Datos.AHORA.plus(Duration.ofHours(9)));
        repo().guardar(vencido);                                            // ya marcado: no vuelve
        Ticket resuelto = guardar("TKT-2026-0004", "m", Prioridad.MEDIA, "hardware", 3);
        resuelto.asignarA("ana", "s", true, Datos.AHORA);
        resuelto.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, Datos.AHORA);
        resuelto.cambiarEstado(EstadoTicket.RESUELTO, "ana", null, Datos.AHORA);
        repo().guardar(resuelto);                                           // terminado: no vuelve
        Ticket enEspera = guardar("TKT-2026-0005", "m", Prioridad.ALTA, "hardware", 4);
        enEspera.asignarA("ana", "s", true, Datos.AHORA);
        enEspera.cambiarEstado(EstadoTicket.EN_PROCESO, "ana", null, Datos.AHORA);
        enEspera.cambiarEstado(EstadoTicket.EN_ESPERA, "ana", null, Datos.AHORA);
        repo().guardar(enEspera);                                           // vigente: sí vuelve

        assertEquals(List.of("TKT-2026-0002", "TKT-2026-0005", "TKT-2026-0001"),
                repo().buscarVigentesSinSlaVencido().stream().map(Ticket::getCodigo).toList());
    }

    @Test
    void buscaPorPaginasConElTotal() {
        for (int i = 1; i <= 5; i++) {
            guardar(String.format("TKT-2026-%04d", i), i % 2 == 0 ? "jose" : "maria", i <= 3 ? Prioridad.ALTA : Prioridad.BAJA,
                    "hardware", i);
        }
        FiltroTicket todos = filtro(null, null, null, null, null);
        assertEquals(new Pagina<>(List.of("TKT-2026-0005", "TKT-2026-0004"), 5), codigos(todos, new Paginacion(0, 2)));
        assertEquals(new Pagina<>(List.of("TKT-2026-0003", "TKT-2026-0002"), 5), codigos(todos, new Paginacion(1, 2)));
        assertEquals(new Pagina<>(List.of("TKT-2026-0001"), 5), codigos(todos, new Paginacion(2, 2)));
        assertEquals(new Pagina<>(List.of(), 5), codigos(todos, new Paginacion(3, 2)), "fuera de rango: vacía, con el total");

        // el total respeta los filtros y la visibilidad, que se aplican antes de paginar
        assertEquals(new Pagina<>(List.of("TKT-2026-0003"), 3), codigos(filtro(null, Prioridad.ALTA, null, null, null), new Paginacion(0, 1)));
        assertEquals(new Pagina<>(List.of("TKT-2026-0005", "TKT-2026-0003", "TKT-2026-0001"), 3),
                codigos(filtro(null, null, null, "maria", null), new Paginacion(0, 10)));
    }

    private Pagina<String> codigos(FiltroTicket f, Paginacion p) {
        Pagina<Ticket> pagina = repo().buscar(f, p);
        return new Pagina<>(pagina.elementos().stream().map(Ticket::getCodigo).toList(), pagina.total());
    }

    private List<String> codigos(FiltroTicket f) {
        return repo().buscar(f).stream().map(Ticket::getCodigo).toList();
    }
}
