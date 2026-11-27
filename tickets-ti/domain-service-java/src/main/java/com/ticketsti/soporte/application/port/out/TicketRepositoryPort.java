package com.ticketsti.soporte.application.port.out;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface TicketRepositoryPort {

    Ticket guardar(Ticket ticket);

    Optional<Ticket> buscarPorCodigo(String codigo);

    /** El siguiente consecutivo del año (el primero es 1). */
    long siguienteConsecutivo(int anio);

    /** Cuántos tickets vigentes (no resueltos ni cerrados) tiene cada técnico en esa categoría; los que no tienen, no aparecen. */
    Map<String, Long> contarVigentesPorTecnico(Categoria categoria, Collection<String> usernames);

    /** Más recientes primero. */
    List<Ticket> buscar(FiltroTicket filtro);
}
