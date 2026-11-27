package com.ticketsti.soporte.application.port.out;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface TicketRepositoryPort {

    Ticket guardar(Ticket ticket);

    Optional<Ticket> buscarPorCodigo(String codigo);

    /**
     * Reserva el siguiente consecutivo del año (el primero es 1) para la transacción en curso. M-06: dos creaciones
     * simultáneas nunca reciben el mismo número, y nunca se repite uno ya usado. Si la transacción se revierte, el número
     * no se consume.
     */
    long siguienteConsecutivo(int anio);

    /** Cuántos tickets vigentes (no resueltos ni cerrados) tiene cada técnico en esa categoría; los que no tienen, no aparecen. */
    Map<String, Long> contarVigentesPorTecnico(Categoria categoria, Collection<String> usernames);

    /** Más recientes primero. */
    List<Ticket> buscar(FiltroTicket filtro);

    /** M-05: una página de {@link #buscar(FiltroTicket)}, en el mismo orden, con el total de lo que cumple el filtro. */
    Pagina<Ticket> buscar(FiltroTicket filtro, Paginacion paginacion);

    /** Tickets vigentes que todavía no se marcaron como vencidos (M-01), el que vence antes primero. */
    List<Ticket> buscarVigentesSinSlaVencido();
}
