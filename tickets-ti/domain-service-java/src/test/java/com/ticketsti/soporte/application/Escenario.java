package com.ticketsti.soporte.application;

import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.service.*;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.testsupport.*;
import java.time.Duration;
import java.util.Arrays;

/** Arma los servicios con dobles en memoria: así se prueba la aplicación sin Spring ni base de datos. */
final class Escenario {

    final TicketRepositoryEnMemoria tickets = new TicketRepositoryEnMemoria();
    final TecnicoRepositoryEnMemoria tecnicos = new TecnicoRepositoryEnMemoria();
    final TransaccionDirecta tx = new TransaccionDirecta();
    final RelojAjustable reloj = Datos.relojAjustable();

    final TecnicoService tecnicoService = new TecnicoService(tecnicos, tx, new PoliticaAcceso());
    final TicketService ticketService = new TicketService(tickets, tecnicos, tx, reloj, new PoliticaAsignacion(), new PoliticaAcceso());

    void tecnico(String username, String... categorias) {
        tecnicoService.registrar(Datos.admin(), new RegistrarTecnicoCommand(username, Arrays.asList(categorias)));
    }

    Ticket crear(Actor actor, String categoria, String prioridad) {
        return ticketService.crear(actor, new CrearTicketCommand("Impresora sin respuesta",
                "La impresora del segundo piso no imprime", "incidente", categoria, prioridad));
    }

    /** Lleva el ticket hasta RESUELTO con el técnico asignado. */
    void resolver(Ticket t) {
        Actor tecnico = Datos.tecnico(t.getTecnico());
        ticketService.cambiarEstado(tecnico, new CambiarEstadoCommand(t.getCodigo(), "en_proceso", null));
        ticketService.cambiarEstado(tecnico, new CambiarEstadoCommand(t.getCodigo(), "resuelto", "Listo"));
    }

    void pasar(Duration d) {
        reloj.avanzar(d);
    }
}
