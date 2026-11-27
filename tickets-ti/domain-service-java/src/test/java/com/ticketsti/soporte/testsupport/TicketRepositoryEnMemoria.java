package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.*;

/** Doble de prueba: guarda copias, así un objeto modificado no cambia lo ya guardado. */
public class TicketRepositoryEnMemoria implements TicketRepositoryPort {

    private final Map<Long, Ticket> filas = new TreeMap<>();
    private long siguiente = 1;

    private static Ticket copiar(long id, Ticket t) {
        return Ticket.reconstruir(id, t.getCodigo(), t.getTitulo(), t.getDescripcion(), t.getTipo(), t.getCategoria(),
                t.getPrioridad(), t.getCreadoPor(), t.getCreadoEn(), t.getEstado(), t.getTecnico(), t.getVenceSla(),
                t.getReaperturas(), t.getAlertaSlaEn(), t.getSlaVencidoEn(), t.getHistorial());
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

    /** Último reservado por año: igual que el contador del adaptador JPA, no repite aunque el ticket no se haya guardado aún. */
    private final Map<Integer, Long> reservados = new HashMap<>();

    @Override
    public long siguienteConsecutivo(int anio) {
        String prefijo = "TKT-" + anio + "-";
        long maximoUsado = filas.values().stream().map(Ticket::getCodigo).filter(c -> c.startsWith(prefijo))
                .mapToLong(c -> Long.parseLong(c.substring(prefijo.length()))).max().orElse(0);
        long siguiente = Math.max(reservados.getOrDefault(anio, 0L), maximoUsado) + 1;
        reservados.put(anio, siguiente);
        return siguiente;
    }

    @Override
    public Map<String, CargaTecnico> cargaPorTecnico(Categoria categoria, Collection<String> usernames) {
        Map<String, CargaTecnico> r = new HashMap<>();
        for (Ticket t : filas.values()) {
            if (t.getTecnico() != null && usernames.contains(t.getTecnico()) && t.getCategoria().equals(categoria)
                    && t.getEstado().estaVigente()) {
                long critico = t.getPrioridad() == Prioridad.CRITICA ? 1 : 0;
                r.merge(t.getTecnico(), new CargaTecnico(1, critico),
                        (a, b) -> new CargaTecnico(a.vigentes() + b.vigentes(), a.criticos() + b.criticos()));
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

    @Override
    public Pagina<Ticket> buscar(FiltroTicket f, Paginacion p) {
        List<Ticket> todos = buscar(f);
        int desde = (int) Math.min(p.desde(), todos.size());
        int hasta = (int) Math.min(p.desde() + p.tamano(), todos.size());
        return new Pagina<>(todos.subList(desde, hasta), todos.size());
    }

    @Override
    public List<Ticket> buscarVigentesSinSlaVencido() {
        return filas.values().stream()
                .filter(t -> t.getEstado().estaVigente() && t.getSlaVencidoEn() == null)
                .sorted(Comparator.comparing(Ticket::getVenceSla).thenComparing(Ticket::getId))
                .map(t -> copiar(t.getId(), t))
                .toList();
    }
}
