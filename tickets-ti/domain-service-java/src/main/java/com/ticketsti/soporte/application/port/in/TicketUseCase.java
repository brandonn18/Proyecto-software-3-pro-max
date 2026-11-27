package com.ticketsti.soporte.application.port.in;

import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Ticket;
import java.util.List;

/** Lo que el servicio OFRECE sobre tickets. Los adaptadores de entrada (REST, programador...) solo conocen esto. */
public interface TicketUseCase {

    Ticket crear(Actor actor, CrearTicketCommand comando);

    Ticket cambiarEstado(Actor actor, CambiarEstadoCommand comando);

    Ticket reabrir(Actor actor, ReabrirTicketCommand comando);

    Ticket reasignar(Actor actor, ReasignarTicketCommand comando);

    Ticket porCodigo(Actor actor, String codigo);

    List<Ticket> consultar(Actor actor, ConsultarTicketsQuery consulta);
}
