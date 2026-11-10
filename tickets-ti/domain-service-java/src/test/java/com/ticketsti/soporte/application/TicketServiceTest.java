package com.ticketsti.soporte.application;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.domain.exception.*;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.testsupport.Datos;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TicketServiceTest {

    private final Escenario e = new Escenario();
    private final Actor maria = Datos.usuario("maria");
    private final Actor admin = Datos.admin();

    // ---------------- crear y asignar (HU-8) ----------------
    @Test
    @DisplayName("Crear: código TKT-AAAA-NNNN consecutivo, dueño, SLA; sin técnicos queda ABIERTO")
    void creaYNumera() {
        Ticket t1 = e.crear(maria, "hardware", "alta");
        Ticket t2 = e.crear(maria, "hardware", "baja");
        assertEquals("TKT-2026-0001", t1.getCodigo());
        assertEquals("TKT-2026-0002", t2.getCodigo());
        assertEquals("maria", t1.getCreadoPor());
        assertEquals(EstadoTicket.ABIERTO, t1.getEstado());
        assertNull(t1.getTecnico());
        assertEquals(Datos.AHORA.plus(Duration.ofHours(8)), t1.getVenceSla());
        assertEquals(Datos.AHORA.plus(Duration.ofHours(72)), t2.getVenceSla());
        assertEquals("HARDWARE", t1.getCategoria().nombre());
    }

    @Test
    void elConsecutivoReiniciaCadaAnio() {
        e.crear(maria, "hardware", "alta");
        e.pasar(Duration.ofDays(120));          // ya es 2027
        Ticket t = e.crear(maria, "hardware", "alta");
        assertEquals("TKT-2027-0001", t.getCodigo());
    }

    @Test
    @DisplayName("Asigna al técnico con menos tickets abiertos; en empate, el de menor nombre")
    void asignaAlDeMenosCarga() {
        e.tecnico("beto", "hardware");
        e.tecnico("ana", "hardware");
        Ticket t1 = e.crear(maria, "hardware", "alta");
        Ticket t2 = e.crear(maria, "hardware", "alta");
        Ticket t3 = e.crear(maria, "hardware", "alta");
        assertEquals("ana", t1.getTecnico());
        assertEquals("beto", t2.getTecnico());
        assertEquals("ana", t3.getTecnico());
        assertEquals(EstadoTicket.ASIGNADO, t1.getEstado());
        assertEquals("Asignado automáticamente a ana", t1.getHistorial().get(1).detalle());
    }

    @Test
    @DisplayName("La carga se mide por categoría: lo que atiende en otra categoría no cuenta")
    void laCargaEsPorCategoria() {
        e.tecnico("ana", "hardware", "software");
        e.tecnico("beto", "hardware");
        e.crear(maria, "software", "media");          // solo ana atiende software
        e.crear(maria, "software", "media");
        assertEquals("ana", e.crear(maria, "hardware", "media").getTecnico());   // en hardware ambos tienen 0
        assertEquals("beto", e.crear(maria, "hardware", "media").getTecnico());  // ana ya tiene 1 en hardware
    }

    @Test
    void losTicketsResueltosYaNoCuentan() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        Ticket t1 = e.crear(maria, "hardware", "alta");     // ana
        e.crear(maria, "hardware", "alta");                 // beto
        e.resolver(t1);                                     // ana queda en 0
        assertEquals("ana", e.crear(maria, "hardware", "alta").getTecnico());
    }

    @Test
    void sinTecnicosEnLaCategoriaQuedaAbiertoSinError() {
        e.tecnico("ana", "redes");
        Ticket t = e.crear(maria, "hardware", "alta");
        assertEquals(EstadoTicket.ABIERTO, t.getEstado());
        assertNull(t.getTecnico());
    }

    @Test
    @DisplayName("Si faltan campos, el mensaje los lista todos y no se guarda nada")
    void listaLosFaltantes() {
        ValorInvalidoException ex = assertThrows(ValorInvalidoException.class,
                () -> e.ticketService.crear(maria, new CrearTicketCommand(" ", null, null, "", null)));
        for (String campo : List.of("título", "descripción", "tipo", "categoría", "prioridad")) {
            assertTrue(ex.getMessage().contains(campo));
        }
        assertEquals(0, e.ticketService.consultar(admin, ConsultarTicketsQuery.sinFiltros()).size());
    }

    @Test
    void rechazaTipoOPrioridadDesconocidos() {
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.crear(maria,
                new CrearTicketCommand("Título", "Descripción larga", "queja", "redes", "alta")));
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.crear(maria,
                new CrearTicketCommand("Título", "Descripción larga", "incidente", "redes", "urgente")));
        assertEquals(0, e.ticketService.consultar(admin, ConsultarTicketsQuery.sinFiltros()).size());
    }

    // ---------------- cambiar estado (HU-9) ----------------
    @Test
    void elTecnicoAsignadoRecorreElCiclo() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        Actor ana = Datos.tecnico("ana");
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "EN_PROCESO", null));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_espera", "Esperando repuesto"));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        Ticket r = e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "resuelto", null));
        assertEquals(EstadoTicket.RESUELTO, r.getEstado());
        assertEquals(6, e.ticketService.porCodigo(admin, t.getCodigo()).getHistorial().size());
        assertEquals("ana", r.getHistorial().get(5).por());
        Ticket c = e.ticketService.cambiarEstado(admin, new CambiarEstadoCommand(t.getCodigo(), "cerrado", null));
        assertEquals(EstadoTicket.CERRADO, c.getEstado());
    }

    @Test
    void otroTecnicoOElDuenoNoCambianElEstado() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        AccesoDenegadoException ex = assertThrows(AccesoDenegadoException.class, () ->
                e.ticketService.cambiarEstado(Datos.tecnico("beto"), new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null)));
        assertEquals("Sin permiso para modificar este ticket", ex.getMessage());
        assertThrows(AccesoDenegadoException.class, () ->
                e.ticketService.cambiarEstado(maria, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null)));
        assertEquals(EstadoTicket.ASIGNADO, e.ticketService.porCodigo(admin, t.getCodigo()).getEstado());
    }

    @Test
    void rechazaTransicionesFueraDelCiclo() {
        e.tecnico("ana", "hardware");
        Ticket asignado = e.crear(maria, "hardware", "alta");
        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.cambiarEstado(Datos.tecnico("ana"),
                new CambiarEstadoCommand(asignado.getCodigo(), "resuelto", null)));
        Ticket abierto = e.crear(maria, "redes", "alta");        // sin técnico
        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.cambiarEstado(admin,
                new CambiarEstadoCommand(abierto.getCodigo(), "resuelto", null)));
        assertEquals(EstadoTicket.ASIGNADO, e.ticketService.porCodigo(admin, asignado.getCodigo()).getEstado());
        assertEquals(EstadoTicket.ABIERTO, e.ticketService.porCodigo(admin, abierto.getCodigo()).getEstado());
    }

    @Test
    void cambiarEstadoValidaDatosYExistencia() {
        assertThrows(TicketNoEncontradoException.class, () -> e.ticketService.cambiarEstado(admin,
                new CambiarEstadoCommand("TKT-2026-0999", "en_proceso", null)));
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.cambiarEstado(admin,
                new CambiarEstadoCommand(t.getCodigo(), "terminado", null)));
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.cambiarEstado(admin,
                new CambiarEstadoCommand(t.getCodigo(), " ", null)));
    }

    // ---------------- reabrir (HU-10) ----------------
    @Test
    @DisplayName("El dueño reabre un ticket resuelto: vuelve a ABIERTO, sin técnico y con el SLA reiniciado")
    void reabre() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.pasar(Duration.ofHours(5));
        e.resolver(t);
        e.pasar(Duration.ofHours(1));
        Ticket r = e.ticketService.reabrir(maria, new ReabrirTicketCommand(t.getCodigo(), "El problema volvió"));
        assertEquals(EstadoTicket.ABIERTO, r.getEstado());
        assertNull(r.getTecnico());
        assertEquals(1, r.getReaperturas());
        assertEquals(Datos.AHORA.plus(Duration.ofHours(6 + 8)), r.getVenceSla());
    }

    @Test
    void elAdminTambienReabreYElMotivoEsObligatorio() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.resolver(t);
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.reabrir(maria, new ReabrirTicketCommand(t.getCodigo(), " ")));
        assertEquals(EstadoTicket.RESUELTO, e.ticketService.porCodigo(admin, t.getCodigo()).getEstado());
        assertEquals(EstadoTicket.ABIERTO, e.ticketService.reabrir(admin, new ReabrirTicketCommand(t.getCodigo(), "Por solicitud")).getEstado());
    }

    @Test
    void noReabreQuienNoEsDuenoNiAdmin() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.resolver(t);
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.reabrir(Datos.usuario("jose"), new ReabrirTicketCommand(t.getCodigo(), "x")));
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.reabrir(Datos.tecnico("ana"), new ReabrirTicketCommand(t.getCodigo(), "x")));
    }

    @Test
    void soloSeReabreUnTicketTerminado() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.reabrir(maria, new ReabrirTicketCommand(t.getCodigo(), "x")));
    }

    // ---------------- reasignar (HU-11) ----------------
    @Test
    void elAdminReasigna() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "redes");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.ticketService.cambiarEstado(Datos.tecnico("ana"), new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        Ticket r = e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "beto"));
        assertEquals("beto", r.getTecnico());
        assertEquals(EstadoTicket.EN_PROCESO, r.getEstado());
        assertEquals("Reasignado de ana a beto", r.getHistorial().get(r.getHistorial().size() - 1).detalle());
        // ya no es de ana
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.cambiarEstado(Datos.tecnico("ana"),
                new CambiarEstadoCommand(t.getCodigo(), "en_espera", null)));
    }

    @Test
    void reasignarUnTicketAbiertoLoAsigna() {
        e.tecnico("beto", "redes");
        Ticket t = e.crear(maria, "hardware", "alta");      // nadie atiende hardware
        assertEquals(EstadoTicket.ASIGNADO, e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "beto")).getEstado());
    }

    @Test
    void reasignarTienePermisoYReglas() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");       // ana
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.reasignar(Datos.tecnico("ana"), new ReasignarTicketCommand(t.getCodigo(), "beto")));
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.reasignar(maria, new ReasignarTicketCommand(t.getCodigo(), "beto")));
        assertThrows(TecnicoNoEncontradoException.class, () -> e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "zoe")));
        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "ana")));
        assertThrows(TicketNoEncontradoException.class, () -> e.ticketService.reasignar(admin, new ReasignarTicketCommand("TKT-2026-0999", "beto")));
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), " ")));
        e.resolver(t);
        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "beto")));
        assertEquals("ana", e.ticketService.porCodigo(admin, t.getCodigo()).getTecnico());
    }

    // ---------------- consultar (HU-12) ----------------
    private void escenarioDeConsulta() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        e.crear(maria, "hardware", "alta");                       // 0001 -> ana
        e.pasar(Duration.ofMinutes(1));
        e.crear(maria, "hardware", "baja");                       // 0002 -> beto
        e.pasar(Duration.ofMinutes(1));
        e.crear(Datos.usuario("jose"), "hardware", "alta");       // 0003 -> ana
        e.pasar(Duration.ofMinutes(1));
        e.crear(Datos.tecnico("ana"), "software", "media");       // 0004 -> nadie; creado por ana
    }

    private static List<String> codigos(List<Ticket> ts) {
        return ts.stream().map(Ticket::getCodigo).toList();
    }

    @Test
    @DisplayName("Cada rol ve lo suyo: usuario lo que creó, técnico lo asignado (y lo que creó), admin todo")
    void visibilidadPorRol() {
        escenarioDeConsulta();
        ConsultarTicketsQuery todo = ConsultarTicketsQuery.sinFiltros();
        assertEquals(List.of("TKT-2026-0002", "TKT-2026-0001"), codigos(e.ticketService.consultar(maria, todo)));
        assertEquals(List.of("TKT-2026-0003"), codigos(e.ticketService.consultar(Datos.usuario("jose"), todo)));
        assertEquals(List.of("TKT-2026-0002"), codigos(e.ticketService.consultar(Datos.tecnico("beto"), todo)));
        assertEquals(List.of("TKT-2026-0004", "TKT-2026-0003", "TKT-2026-0001"), codigos(e.ticketService.consultar(Datos.tecnico("ana"), todo)));
        assertEquals(4, e.ticketService.consultar(admin, todo).size());
        assertEquals(0, e.ticketService.consultar(Datos.usuario("nadie"), todo).size());
    }

    @Test
    void filtrosCombinables() {
        escenarioDeConsulta();
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0002", "TKT-2026-0001"), codigos(e.ticketService.consultar(admin,
                new ConsultarTicketsQuery("asignado", null, null, null))));
        assertEquals(List.of("TKT-2026-0003", "TKT-2026-0001"), codigos(e.ticketService.consultar(admin,
                new ConsultarTicketsQuery(null, "alta", "hardware", "incidente"))));
        assertEquals(List.of("TKT-2026-0001"), codigos(e.ticketService.consultar(maria,
                new ConsultarTicketsQuery(null, "ALTA", null, null))));
        assertEquals(List.of("TKT-2026-0004"), codigos(e.ticketService.consultar(admin,
                new ConsultarTicketsQuery("abierto", null, null, null))));
        assertEquals(0, e.ticketService.consultar(admin, new ConsultarTicketsQuery(null, null, "redes", null)).size());
        assertEquals(0, e.ticketService.consultar(admin, new ConsultarTicketsQuery(null, null, null, "solicitud")).size());
    }

    @Test
    void unFiltroDesconocidoEsUnError() {
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.consultar(admin, new ConsultarTicketsQuery("terminado", null, null, null)));
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.consultar(admin, new ConsultarTicketsQuery(null, "urgente", null, null)));
        assertThrows(ValorInvalidoException.class, () -> e.ticketService.consultar(admin, new ConsultarTicketsQuery(null, null, null, "queja")));
    }

    @Test
    void detalleSegunPermiso() {
        escenarioDeConsulta();
        assertEquals("TKT-2026-0001", e.ticketService.porCodigo(maria, "TKT-2026-0001").getCodigo());
        assertEquals("TKT-2026-0001", e.ticketService.porCodigo(Datos.tecnico("ana"), "tkt-2026-0001").getCodigo());
        assertEquals("TKT-2026-0001", e.ticketService.porCodigo(admin, "TKT-2026-0001").getCodigo());
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.porCodigo(Datos.usuario("jose"), "TKT-2026-0001"));
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.porCodigo(Datos.tecnico("beto"), "TKT-2026-0001"));
        assertThrows(TicketNoEncontradoException.class, () -> e.ticketService.porCodigo(admin, "TKT-2026-0999"));
    }
}
