package com.ticketsti.soporte.contract;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Toda implementación del puerto (memoria, JPA…) debe pasar estas mismas pruebas. */
public abstract class TecnicoRepositoryContractTest {

    protected abstract TecnicoRepositoryPort repo();

    private Tecnico guardar(String user, String... categorias) {
        return repo().guardar(Tecnico.registrar(user, java.util.Arrays.stream(categorias).map(Categoria::de).toList()));
    }

    @Test
    void guardaYRecupera() {
        Tecnico g = guardar("ana", "hardware", "redes");
        assertNotNull(g.getId());
        Tecnico r = repo().buscarPorUsername("ana").orElseThrow();
        assertEquals(g.getId(), r.getId());
        assertEquals(2, r.getCategorias().size());
        assertTrue(r.atiende(Categoria.de("REDES")));
        assertTrue(repo().buscarPorUsername("zoe").isEmpty());
    }

    @Test
    void buscaPorCategoria() {
        guardar("ana", "hardware", "redes");
        guardar("beto", "hardware");
        guardar("carla", "software");
        assertEquals(2, repo().buscarPorCategoria(Categoria.de("hardware")).size());
        assertEquals(1, repo().buscarPorCategoria(Categoria.de("software")).size());
        assertEquals(0, repo().buscarPorCategoria(Categoria.de("impresoras")).size());
    }

    @Test
    void listaTodos() {
        guardar("ana", "hardware");
        guardar("beto", "redes");
        assertEquals(List.of("ana", "beto"), repo().listar().stream().map(Tecnico::getUsername).toList());
    }
}
