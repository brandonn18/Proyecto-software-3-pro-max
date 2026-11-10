package com.ticketsti.soporte.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.exception.AccesoDenegadoException;
import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.testsupport.Datos;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ValoresYPoliticasTest {

    private final PoliticaAcceso acceso = new PoliticaAcceso();
    private final PoliticaAsignacion asignacion = new PoliticaAsignacion();

    private static Tecnico tec(String user) {
        return Tecnico.reconstruir(1L, user, List.of(Categoria.de("hardware")));
    }

    private static Ticket asignadoA(String tecnico) {
        Ticket t = Datos.ticket();   // creado por «maria»
        t.asignarA(tecnico, "sistema", true, Datos.AHORA);
        return t;
    }

    // ---------- valores ----------
    @Test
    void categoriaSeNormaliza() {
        assertEquals("REDES WIFI", Categoria.de("  redes   wifi ").nombre());
        assertEquals(Categoria.de("redes"), Categoria.de("REDES"));
        assertThrows(ValorInvalidoException.class, () -> Categoria.de(" "));
        assertThrows(ValorInvalidoException.class, () -> Categoria.de("a"));
        assertThrows(ValorInvalidoException.class, () -> Categoria.de("x".repeat(41)));
    }

    @Test
    void enumsAceptanMinusculasYRechazanDesconocidos() {
        assertEquals(EstadoTicket.EN_PROCESO, EstadoTicket.de(" en_proceso "));
        assertEquals(Prioridad.CRITICA, Prioridad.de("critica"));
        assertEquals(TipoTicket.SOLICITUD, TipoTicket.de("Solicitud"));
        assertThrows(ValorInvalidoException.class, () -> EstadoTicket.de("terminado"));
        assertThrows(ValorInvalidoException.class, () -> Prioridad.de("urgente"));
        assertThrows(ValorInvalidoException.class, () -> TipoTicket.de("queja"));
    }

    @Test
    void estadosVigentes() {
        assertTrue(EstadoTicket.ABIERTO.estaVigente());
        assertTrue(EstadoTicket.EN_ESPERA.estaVigente());
        assertFalse(EstadoTicket.RESUELTO.estaVigente());
        assertFalse(EstadoTicket.CERRADO.estaVigente());
    }

    @Test
    void actorNormalizaRoles() {
        Actor a = Actor.de(" ana ", List.of("ROLE_TECNICO", "otro", "user"));
        assertEquals("ana", a.username());
        assertTrue(a.esTecnico());
        assertFalse(a.esAdmin());
        assertEquals(2, a.roles().size());
        assertThrows(ValorInvalidoException.class, () -> Actor.de(" ", List.of("ADMIN")));
    }

    @Test
    void tecnicoExigeUsuarioYCategorias() {
        Tecnico t = Tecnico.registrar(" ana ", List.of(Categoria.de("redes")));
        assertEquals("ana", t.getUsername());
        assertTrue(t.atiende(Categoria.de("REDES")));
        assertFalse(t.atiende(Categoria.de("software")));
        assertThrows(ValorInvalidoException.class, () -> Tecnico.registrar(" ", List.of(Categoria.de("redes"))));
        assertThrows(ValorInvalidoException.class, () -> Tecnico.registrar("ana", List.of()));
    }

    // ---------- asignación ----------
    @Test
    void asignaAlDeMenosCarga() {
        var elegido = asignacion.elegir(List.of(tec("ana"), tec("beto")), Map.of("ana", 3L, "beto", 1L));
        assertEquals("beto", elegido.orElseThrow().getUsername());
    }

    @Test
    void siNoHayCargaCuentaCero() {
        var elegido = asignacion.elegir(List.of(tec("ana"), tec("beto")), Map.of("ana", 2L));
        assertEquals("beto", elegido.orElseThrow().getUsername());
    }

    @Test
    void enEmpateGanaElNombreMenor() {
        assertEquals("ana", asignacion.elegir(List.of(tec("beto"), tec("ana"), tec("carla")), Map.of()).orElseThrow().getUsername());
    }

    @Test
    void sinCandidatosNoHayAsignacion() {
        assertTrue(asignacion.elegir(List.of(), Map.of()).isEmpty());
    }

    // ---------- acceso ----------
    @Test
    @DisplayName("Ver: admin, creador y técnico asignado; nadie más")
    void quienVe() {
        Ticket t = asignadoA("ana");
        assertTrue(acceso.puedeVer(t, Datos.admin()));
        assertTrue(acceso.puedeVer(t, Datos.usuario("maria")));
        assertTrue(acceso.puedeVer(t, Datos.tecnico("ana")));
        assertFalse(acceso.puedeVer(t, Datos.usuario("jose")));
        assertFalse(acceso.puedeVer(t, Datos.tecnico("beto")));
        assertFalse(acceso.puedeVer(t, Datos.usuario("ana")));   // ser «ana» sin el rol de técnico no basta
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarPuedeVer(t, Datos.usuario("jose")));
    }

    @Test
    @DisplayName("Cambiar estado: solo el técnico asignado o el administrador")
    void quienCambiaEstado() {
        Ticket t = asignadoA("ana");
        acceso.asegurarPuedeCambiarEstado(t, Datos.tecnico("ana"));
        acceso.asegurarPuedeCambiarEstado(t, Datos.admin());
        AccesoDenegadoException ex = assertThrows(AccesoDenegadoException.class,
                () -> acceso.asegurarPuedeCambiarEstado(t, Datos.tecnico("beto")));
        assertEquals("Sin permiso para modificar este ticket", ex.getMessage());
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarPuedeCambiarEstado(t, Datos.usuario("maria")));
    }

    @Test
    @DisplayName("Reabrir: solo el dueño o el administrador")
    void quienReabre() {
        Ticket t = asignadoA("ana");
        acceso.asegurarPuedeReabrir(t, Datos.usuario("maria"));
        acceso.asegurarPuedeReabrir(t, Datos.admin());
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarPuedeReabrir(t, Datos.usuario("jose")));
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarPuedeReabrir(t, Datos.tecnico("ana")));
    }

    @Test
    void soloElAdminEsAdmin() {
        acceso.asegurarAdmin(Datos.admin(), "hacer algo");
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarAdmin(Datos.tecnico("ana"), "hacer algo"));
        assertThrows(AccesoDenegadoException.class, () -> acceso.asegurarAdmin(Datos.usuario("maria"), "hacer algo"));
    }

    // ---------- visibilidad al listar ----------
    @Test
    void visibilidadPorRol() {
        var admin = acceso.visibilidadPara(Actor.de("root", List.of("ROLE_ADMIN")));
        assertEquals(new PoliticaAcceso.Visibilidad(null, null), admin);
        var tecnico = acceso.visibilidadPara(Actor.de("ana", List.of("ROLE_TECNICO")));
        assertEquals(new PoliticaAcceso.Visibilidad("ana", "ana"), tecnico);
        var usuario = acceso.visibilidadPara(Actor.de("maria", List.of("ROLE_USER")));
        assertEquals(new PoliticaAcceso.Visibilidad("maria", null), usuario);
    }

    @Test
    void estadosVigentesSonLosNoFinales() {
        assertEquals(java.util.Set.of(EstadoTicket.ABIERTO, EstadoTicket.ASIGNADO, EstadoTicket.EN_PROCESO,
                EstadoTicket.EN_ESPERA), EstadoTicket.vigentes());
    }
}
