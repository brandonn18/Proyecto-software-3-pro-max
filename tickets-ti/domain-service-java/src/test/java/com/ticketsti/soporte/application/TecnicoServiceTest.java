package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.domain.exception.*;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TecnicoServiceTest {

    private final Escenario e = new Escenario();

    @Test
    void elAdminRegistraUnTecnicoConSusCategorias() {
        Tecnico t = e.tecnicoService.registrar(Datos.admin(), new RegistrarTecnicoCommand(" ana ", List.of("hardware", "Redes")));
        assertNotNull(t.getId());
        assertEquals("ana", t.getUsername());
        assertTrue(t.atiende(Categoria.de("HARDWARE")));
        assertTrue(t.atiende(Categoria.de("redes")));
        assertEquals(1, e.tecnicoService.listar(Datos.admin()).size());
    }

    @Test
    void soloElAdminRegistraYLista() {
        assertThrows(AccesoDenegadoException.class,
                () -> e.tecnicoService.registrar(Datos.tecnico("ana"), new RegistrarTecnicoCommand("ana", List.of("redes"))));
        assertThrows(AccesoDenegadoException.class,
                () -> e.tecnicoService.registrar(Datos.usuario("maria"), new RegistrarTecnicoCommand("ana", List.of("redes"))));
        assertThrows(AccesoDenegadoException.class, () -> e.tecnicoService.listar(Datos.usuario("maria")));
        assertEquals(0, e.tecnicoService.listar(Datos.admin()).size());
    }

    @Test
    @DisplayName("Si faltan datos, el mensaje lista todos los faltantes")
    void listaLosFaltantes() {
        ValorInvalidoException ex = assertThrows(ValorInvalidoException.class,
                () -> e.tecnicoService.registrar(Datos.admin(), new RegistrarTecnicoCommand(" ", null)));
        assertTrue(ex.getMessage().contains("usuario"));
        assertTrue(ex.getMessage().contains("categorías"));
        assertThrows(ValorInvalidoException.class,
                () -> e.tecnicoService.registrar(Datos.admin(), new RegistrarTecnicoCommand("ana", List.of())));
    }

    @Test
    void noSeRegistraDosVecesElMismoUsuario() {
        e.tecnico("ana", "redes");
        assertThrows(TecnicoDuplicadoException.class,
                () -> e.tecnicoService.registrar(Datos.admin(), new RegistrarTecnicoCommand("ana", List.of("software"))));
        assertEquals(1, e.tecnicoService.listar(Datos.admin()).size());
    }
}
