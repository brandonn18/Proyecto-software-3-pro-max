package com.ticketsti.soporte.application.query;

import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.model.TipoTicket;
import com.ticketsti.soporte.domain.vo.Categoria;

/**
 * Filtros de búsqueda; null = sin filtro. Visibilidad: si {@code creadoPor} y {@code asignadoA} vienen ambos,
 * basta cumplir uno de los dos (el técnico ve lo que creó y lo que tiene asignado); si ambos son null no se restringe.
 */
public record FiltroTicket(EstadoTicket estado, Prioridad prioridad, Categoria categoria, TipoTicket tipo,
                           String creadoPor, String asignadoA) { }
