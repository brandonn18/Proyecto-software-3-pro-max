package com.ticketsti.soporte.infrastructure.adapters.out.persistence.mapper;

import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.CambioEmbeddable;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TicketEntity;

public final class TicketMapper {

    private TicketMapper() { }

    public static Ticket aDominio(TicketEntity e) {
        var historial = e.getHistorial().stream().map(c -> new CambioTicket(
                c.getDe() == null ? null : EstadoTicket.valueOf(c.getDe()), EstadoTicket.valueOf(c.getA()),
                c.getPor(), c.getCuando(), c.getDetalle())).toList();
        return Ticket.reconstruir(e.getId(), e.getCodigo(), e.getTitulo(), e.getDescripcion(), TipoTicket.valueOf(e.getTipo()),
                Categoria.de(e.getCategoria()), Prioridad.valueOf(e.getPrioridad()), e.getCreadoPor(), e.getCreadoEn(),
                EstadoTicket.valueOf(e.getEstado()), e.getTecnico(), e.getVenceSla(), e.getReaperturas(), historial);
    }

    /** Copia el estado del dominio a la entidad (nueva o ya cargada). El historial solo crece: se reescribe completo. */
    public static void copiarA(TicketEntity e, Ticket t) {
        // «TKT-2026-0007» -> año 2026, consecutivo 7
        String[] partes = t.getCodigo().split("-");
        e.setCodigo(t.getCodigo());
        e.setAnio(Integer.parseInt(partes[1]));
        e.setConsecutivo(Long.parseLong(partes[2]));
        e.setTitulo(t.getTitulo());
        e.setDescripcion(t.getDescripcion());
        e.setTipo(t.getTipo().name());
        e.setCategoria(t.getCategoria().nombre());
        e.setPrioridad(t.getPrioridad().name());
        e.setEstado(t.getEstado().name());
        e.setCreadoPor(t.getCreadoPor());
        e.setTecnico(t.getTecnico());
        e.setCreadoEn(t.getCreadoEn());
        e.setVenceSla(t.getVenceSla());
        e.setReaperturas(t.getReaperturas());
        e.getHistorial().clear();
        for (CambioTicket c : t.getHistorial()) {
            e.getHistorial().add(new CambioEmbeddable(c.de() == null ? null : c.de().name(), c.a().name(), c.por(), c.cuando(), c.detalle()));
        }
    }
}
