package com.ticketsti.soporte.application.port.in;

import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
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

    /** Todos los tickets que el actor puede ver y cumplen los filtros, más recientes primero. */
    List<Ticket> consultar(Actor actor, ConsultarTicketsQuery consulta);

    /** M-05: lo mismo que {@link #consultar}, cortado en una página, con el total. */
    Pagina<Ticket> consultarPagina(Actor actor, ConsultarTicketsQuery consulta, Paginacion paginacion);
}
