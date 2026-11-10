package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.*;

/** Doble de prueba: guarda copias, así un objeto modificado no cambia lo ya guardado. */
public class TicketRepositoryEnMemoria implements TicketRepositoryPort {

    private final Map<Long, Ticket> filas = new TreeMap<>();
    private long siguiente = 1;

    private static Ticket copiar(long id, Ticket t) {
        return Ticket.reconstruir(id, t.getCodigo(), t.getTitulo(), t.getDescripcion(), t.getTipo(), t.getCategoria(),
                t.getPrioridad(), t.getCreadoPor(), t.getCreadoEn(), t.getEstado(), t.getTecnico(), t.getVenceSla(),
                t.getReaperturas(), t.getHistorial());
    }

    @Override
    public Ticket guardar(Ticket t) {
        long id = t.getId() == null ? siguiente++ : t.getId();
        Ticket copia = copiar(id, t);
        filas.put(id, copia);
        return copiar(id, copia);
    }

    @Override
    public Optional<Ticket> buscarPorCodigo(String codigo) {
        return filas.values().stream().filter(t -> t.getCodigo().equals(codigo)).findFirst().map(t -> copiar(t.getId(), t));
    }

    @Override
    public long siguienteConsecutivo(int anio) {
        String prefijo = "TKT-" + anio + "-";
        return filas.values().stream().map(Ticket::getCodigo).filter(c -> c.startsWith(prefijo))
                .mapToLong(c -> Long.parseLong(c.substring(prefijo.length()))).max().orElse(0) + 1;
    }

    @Override
    public Map<String, Long> contarVigentesPorTecnico(Categoria categoria, Collection<String> usernames) {
        Map<String, Long> r = new HashMap<>();
        for (Ticket t : filas.values()) {
            if (t.getTecnico() != null && usernames.contains(t.getTecnico()) && t.getCategoria().equals(categoria)
                    && t.getEstado().estaVigente()) {
                r.merge(t.getTecnico(), 1L, Long::sum);
            }
        }
        return r;
    }

    @Override
    public List<Ticket> buscar(FiltroTicket f) {
        List<Ticket> r = new ArrayList<>();
        for (Ticket t : filas.values()) {
            boolean visible = (f.creadoPor() == null && f.asignadoA() == null)
                    || (f.creadoPor() != null && f.creadoPor().equals(t.getCreadoPor()))
                    || (f.asignadoA() != null && f.asignadoA().equals(t.getTecnico()));
            if (visible
                    && (f.estado() == null || f.estado() == t.getEstado())
                    && (f.prioridad() == null || f.prioridad() == t.getPrioridad())
                    && (f.categoria() == null || f.categoria().equals(t.getCategoria()))
                    && (f.tipo() == null || f.tipo() == t.getTipo())) {
                r.add(copiar(t.getId(), t));
            }
        }
        r.sort(Comparator.comparing(Ticket::getCreadoEn).thenComparing(Ticket::getId).reversed());
        return r;
    }
}
