package com.ticketsti.soporte.application;

import static com.ticketsti.soporte.application.notificacion.TipoNotificacion.*;
import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.service.TicketService;
import com.ticketsti.soporte.domain.exception.AccesoDenegadoException;
import com.ticketsti.soporte.domain.exception.TicketEstadoInvalidoException;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.testsupport.*;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-02 (RF-10): los casos de uso avisan por {@code NotificacionPort} sin conocer el adaptador que lo implementa. */
class NotificacionesTest {

    private final Escenario e = new Escenario();
    private final Actor maria = Datos.usuario("maria");
    private final Actor admin = Datos.admin();

    @Test
    @DisplayName("Crear con técnico notifica la creación y la asignación automática, con los datos del ticket")
    void creacionYAsignacion() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");

        assertEquals(List.of(TICKET_CREADO, TICKET_ASIGNADO), e.notificaciones.tipos());
        Notificacion creado = e.notificaciones.enviadas().get(0);
        assertEquals(t.getCodigo(), creado.codigo());
        assertEquals("Impresora sin respuesta", creado.titulo());
        assertEquals(Prioridad.ALTA, creado.prioridad());
        assertEquals("maria", creado.creadoPor());
        assertEquals("Ticket creado", creado.detalle());
        assertEquals(Datos.AHORA, creado.cuando());

        Notificacion asignado = e.notificaciones.ultima();
        assertEquals("ana", asignado.tecnico());
        assertEquals("Asignado automáticamente a ana", asignado.detalle());
    }

    @Test
    @DisplayName("Sin técnicos en la categoría solo se notifica la creación")
    void sinTecnicos() {
        e.crear(maria, "redes", "media");
        assertEquals(List.of(TICKET_CREADO), e.notificaciones.tipos());
        assertNull(e.notificaciones.ultima().tecnico());
    }

    @Test
    @DisplayName("Solo el paso a RESUELTO se notifica; los demás cambios de estado no")
    void resolucion() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.notificaciones.limpiar();
        Actor ana = Datos.tecnico("ana");

        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_espera", "Esperando repuesto"));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        assertTrue(e.notificaciones.enviadas().isEmpty());

        e.pasar(Duration.ofHours(2));
        e.ticketService.cambiarEstado(ana, new CambiarEstadoCommand(t.getCodigo(), "resuelto", "Se cambió el tóner"));
        assertEquals(List.of(TICKET_RESUELTO), e.notificaciones.tipos());
        Notificacion n = e.notificaciones.ultima();
        assertEquals("maria", n.creadoPor());
        assertEquals("ana", n.tecnico());
        assertEquals("Se cambió el tóner", n.detalle());
        assertEquals(Datos.AHORA.plus(Duration.ofHours(2)), n.cuando());

        e.ticketService.cambiarEstado(admin, new CambiarEstadoCommand(t.getCodigo(), "cerrado", null));
        assertEquals(List.of(TICKET_RESUELTO), e.notificaciones.tipos(), "cerrar no se notifica");
    }

    @Test
    @DisplayName("Reasignar notifica la asignación al nuevo técnico, con el técnico anterior en el detalle")
    void reasignacion() {
        e.tecnico("ana", "hardware");
        e.tecnico("beto", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");           // empate: ana
        e.notificaciones.limpiar();

        e.ticketService.reasignar(admin, new ReasignarTicketCommand(t.getCodigo(), "beto"));
        assertEquals(List.of(TICKET_ASIGNADO), e.notificaciones.tipos());
        assertEquals("beto", e.notificaciones.ultima().tecnico());
        assertEquals("Reasignado de ana a beto", e.notificaciones.ultima().detalle());
    }

    @Test
    @DisplayName("Una operación rechazada no notifica nada")
    void rechazadaNoNotifica() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.notificaciones.limpiar();

        assertThrows(TicketEstadoInvalidoException.class, () -> e.ticketService.cambiarEstado(Datos.tecnico("ana"),
                new CambiarEstadoCommand(t.getCodigo(), "resuelto", null)));
        assertThrows(AccesoDenegadoException.class, () -> e.ticketService.reasignar(maria,
                new ReasignarTicketCommand(t.getCodigo(), "ana")));
        assertTrue(e.notificaciones.enviadas().isEmpty());
    }

    @Test
    @DisplayName("Las alertas de SLA de M-01 se notifican una vez: al 80 % y al vencer")
    void alertasDeSla() {
        e.tecnico("ana", "hardware");
        Ticket t = e.crear(maria, "hardware", "alta");
        e.notificaciones.limpiar();

        e.pasar(Duration.ofMinutes(384));
        e.slaService.verificar();
        e.pasar(Duration.ofMinutes(30));
        e.slaService.verificar();
        assertEquals(List.of(SLA_ALERTA_80), e.notificaciones.tipos());
        assertEquals(t.getCodigo(), e.notificaciones.ultima().codigo());
        assertEquals("ana", e.notificaciones.ultima().tecnico());
        assertEquals(Datos.AHORA.plus(Duration.ofMinutes(384)), e.notificaciones.ultima().cuando());

        e.pasar(Duration.ofHours(2));
        e.slaService.verificar();
        e.slaService.verificar();
        assertEquals(List.of(SLA_ALERTA_80, SLA_VENCIDO), e.notificaciones.tipos());
        assertEquals("SLA vencido", e.notificaciones.ultima().detalle());
    }

    @Test
    @DisplayName("Si el canal de notificaciones falla, la operación igual queda guardada")
    void fallaDelCanalNoDeshaceLaOperacion() {
        e.tecnico("ana", "hardware");
        e.notificaciones.fallar();

        Ticket t = assertDoesNotThrow(() -> e.crear(maria, "hardware", "alta"));
        assertEquals(EstadoTicket.ASIGNADO, e.tickets.buscarPorCodigo(t.getCodigo()).orElseThrow().getEstado());

        e.pasar(Duration.ofHours(9));
        var r = assertDoesNotThrow(() -> e.slaService.verificar());
        assertEquals(List.of(t.getCodigo()), r.vencidos());
        assertNotNull(e.tickets.buscarPorCodigo(t.getCodigo()).orElseThrow().getSlaVencidoEn());
    }

    @Test
    @DisplayName("Si no se pudo guardar, no se notifica: el aviso va después de guardar")
    void sinGuardarNoHayAviso() {
        TicketRepositoryEnMemoria noGuarda = new TicketRepositoryEnMemoria() {
            @Override
            public Ticket guardar(Ticket t) {
                throw new IllegalStateException("base de datos caída (simulado)");
            }
        };
        NotificacionesEnMemoria notificaciones = new NotificacionesEnMemoria();
        TicketService servicio = new TicketService(noGuarda, new TecnicoRepositoryEnMemoria(), new TransaccionDirecta(),
                Datos.relojFijo(), new PoliticaAsignacion(), new PoliticaAcceso(), notificaciones);

        assertThrows(IllegalStateException.class, () -> servicio.crear(maria, new CrearTicketCommand(
                "Impresora sin respuesta", "La impresora del segundo piso no imprime", "incidente", "hardware", "alta")));
        assertTrue(notificaciones.enviadas().isEmpty());
    }
}
