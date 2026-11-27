package com.ticketsti.soporte.infrastructure.adapters.out.notificacion;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.notificacion.TipoNotificacion;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.testsupport.Datos;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

/** El primer adaptador de M-02 deja cada notificación en el log, en una sola línea. */
@ExtendWith(OutputCaptureExtension.class)
class NotificacionRegistroAdapterTest {

    private final NotificacionRegistroAdapter adaptador = new NotificacionRegistroAdapter();

    @Test
    @DisplayName("Registra tipo, código, prioridad, creador, técnico y detalle")
    void registraLaNotificacion(CapturedOutput salida) {
        adaptador.notificar(new Notificacion(TipoNotificacion.TICKET_ASIGNADO, "TKT-2026-0001", "Impresora sin respuesta",
                Prioridad.ALTA, "maria", "ana", Datos.AHORA, "Asignado automáticamente a ana"));

        String linea = salida.getOut().lines().filter(l -> l.contains("TKT-2026-0001")).findFirst().orElseThrow();
        assertTrue(linea.contains("TICKET_ASIGNADO"), linea);
        assertTrue(linea.contains("ALTA"), linea);
        assertTrue(linea.contains("maria"), linea);
        assertTrue(linea.contains("ana"), linea);
        assertTrue(linea.contains("Asignado automáticamente a ana"), linea);
    }

    @Test
    @DisplayName("Un ticket sin técnico se registra como «sin asignar»")
    void sinTecnico(CapturedOutput salida) {
        adaptador.notificar(new Notificacion(TipoNotificacion.TICKET_CREADO, "TKT-2026-0002", "Sin red",
                Prioridad.MEDIA, "jose", null, Datos.AHORA, "Ticket creado"));
        assertTrue(salida.getOut().contains("sin asignar"), salida.getOut());
    }

    @Test
    @DisplayName("Los saltos de línea del texto del usuario no pueden fabricar líneas falsas en el log")
    void noPermiteFalsearElLog(CapturedOutput salida) {
        adaptador.notificar(new Notificacion(TipoNotificacion.TICKET_RESUELTO, "TKT-2026-0003", "Título\r\nERROR falso",
                Prioridad.BAJA, "maria", "ana", Datos.AHORA, "Listo\nINFO usuario admin autorizado"));

        assertFalse(salida.getOut().lines().anyMatch(l -> l.startsWith("ERROR falso") || l.startsWith("INFO usuario")),
                salida.getOut());
        assertTrue(salida.getOut().contains("Listo INFO usuario admin autorizado"), salida.getOut());
    }
}
