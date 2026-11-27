package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.command.ConsultarTicketsQuery;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.testsupport.Datos;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-05: consulta de tickets por páginas, con el total; la visibilidad y los filtros se aplican antes de paginar. */
class ConsultaPaginadaTest {

    private final Escenario e = new Escenario();
    private final Actor maria = Datos.usuario("maria");
    private final Actor admin = Datos.admin();

    private List<String> codigos(Pagina<Ticket> p) {
        return p.elementos().stream().map(Ticket::getCodigo).toList();
    }

    @Test
    @DisplayName("Devuelve la página pedida, más recientes primero, con el total de lo que cumple el filtro")
    void paginaConTotal() {
        for (int i = 0; i < 5; i++) e.crear(maria, "redes", "media");

        Pagina<Ticket> primera = e.ticketService.consultarPagina(admin, ConsultarTicketsQuery.sinFiltros(), new Paginacion(0, 2));
        assertEquals(List.of("TKT-2026-0005", "TKT-2026-0004"), codigos(primera));
        assertEquals(5, primera.total());

        Pagina<Ticket> ultima = e.ticketService.consultarPagina(admin, ConsultarTicketsQuery.sinFiltros(), new Paginacion(2, 2));
        assertEquals(List.of("TKT-2026-0001"), codigos(ultima));

        Pagina<Ticket> fuera = e.ticketService.consultarPagina(admin, ConsultarTicketsQuery.sinFiltros(), new Paginacion(9, 2));
        assertTrue(fuera.elementos().isEmpty());
        assertEquals(5, fuera.total());
    }

    @Test
    @DisplayName("Un USER solo cuenta y pagina lo suyo; los filtros también se aplican antes de paginar")
    void visibilidadYFiltrosAntesDePaginar() {
        e.crear(maria, "redes", "alta");
        e.crear(Datos.usuario("jose"), "redes", "alta");
        e.crear(maria, "redes", "baja");
        e.crear(maria, "redes", "alta");

        Pagina<Ticket> deMaria = e.ticketService.consultarPagina(maria, ConsultarTicketsQuery.sinFiltros(), new Paginacion(0, 2));
        assertEquals(List.of("TKT-2026-0004", "TKT-2026-0003"), codigos(deMaria));
        assertEquals(3, deMaria.total());

        Pagina<Ticket> altas = e.ticketService.consultarPagina(admin,
                new ConsultarTicketsQuery(null, "alta", null, null), new Paginacion(0, 10));
        assertEquals(List.of("TKT-2026-0004", "TKT-2026-0002", "TKT-2026-0001"), codigos(altas));
        assertEquals(3, altas.total());
    }

    @Test
    @DisplayName("Valores por defecto: página 0 y tamaño 20; el tamaño máximo es 100")
    void valoresPorDefecto() {
        assertEquals(new Paginacion(0, Paginacion.TAMANO_POR_DEFECTO), Paginacion.de(null, null));
        assertEquals(new Paginacion(3, 20), Paginacion.de(3, null));
        assertEquals(new Paginacion(0, 5), Paginacion.de(null, 5));
        assertEquals(20, Paginacion.TAMANO_POR_DEFECTO);
        assertEquals(100, Paginacion.TAMANO_MAXIMO);
        assertDoesNotThrow(() -> new Paginacion(0, 100));
    }

    @Test
    @DisplayName("Página negativa o tamaño fuera de 1..100: datos inválidos (400), con el parámetro en el mensaje")
    void valoresInvalidos() {
        assertTrue(assertThrows(ValorInvalidoException.class, () -> Paginacion.de(-1, null)).getMessage().contains("page"));
        assertTrue(assertThrows(ValorInvalidoException.class, () -> Paginacion.de(null, 0)).getMessage().contains("size"));
        assertTrue(assertThrows(ValorInvalidoException.class, () -> Paginacion.de(null, 101)).getMessage().contains("100"));
    }

    @Test
    @DisplayName("La consulta sin paginar sigue devolviendo todo, como antes")
    void sinPaginarComoAntes() {
        for (int i = 0; i < 3; i++) e.crear(maria, "redes", "media");
        assertEquals(3, e.ticketService.consultar(admin, ConsultarTicketsQuery.sinFiltros()).size());
    }
}
