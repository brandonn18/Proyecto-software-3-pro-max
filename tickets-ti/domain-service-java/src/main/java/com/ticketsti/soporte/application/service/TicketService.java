package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.application.port.out.TransaccionPort;
import com.ticketsti.soporte.domain.exception.TecnicoNoEncontradoException;
import com.ticketsti.soporte.domain.exception.TicketNoEncontradoException;
import com.ticketsti.soporte.domain.model.*;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Casos de uso de tickets. Orden de validación en cada operación: datos obligatorios (400) -> existencia (404)
 * -> permiso (403) -> regla de estado (409). No contiene reglas de negocio propias: delega en el dominio.
 */
public class TicketService implements TicketUseCase {

    private final TicketRepositoryPort tickets;
    private final TecnicoRepositoryPort tecnicos;
    private final TransaccionPort transaccion;
    private final Clock reloj;
    private final PoliticaAsignacion asignacion;
    private final PoliticaAcceso acceso;

    public TicketService(TicketRepositoryPort tickets, TecnicoRepositoryPort tecnicos, TransaccionPort transaccion,
                         Clock reloj, PoliticaAsignacion asignacion, PoliticaAcceso acceso) {
        this.tickets = tickets;
        this.tecnicos = tecnicos;
        this.transaccion = transaccion;
        this.reloj = reloj;
        this.asignacion = asignacion;
        this.acceso = acceso;
    }

    @Override
    public Ticket crear(Actor actor, CrearTicketCommand c) {
        Validacion.exigir("título", c.titulo(), "descripción", c.descripcion(), "tipo", c.tipo(),
                "categoría", c.categoria(), "prioridad", c.prioridad());
        TipoTicket tipo = TipoTicket.de(c.tipo());
        Categoria categoria = Categoria.de(c.categoria());
        Prioridad prioridad = Prioridad.de(c.prioridad());
        return transaccion.ejecutar(() -> {
            Instant ahora = reloj.instant();
            int anio = LocalDate.ofInstant(ahora, reloj.getZone()).getYear();
            String codigo = Ticket.formatoCodigo(anio, tickets.siguienteConsecutivo(anio));
            Ticket ticket = Ticket.crear(codigo, c.titulo(), c.descripcion(), tipo, categoria, prioridad, actor.username(), ahora);
            asignarAutomaticamente(ticket, categoria, ahora);
            return tickets.guardar(ticket);
        });
    }

    private void asignarAutomaticamente(Ticket ticket, Categoria categoria, Instant ahora) {
        List<Tecnico> candidatos = tecnicos.buscarPorCategoria(categoria);
        if (candidatos.isEmpty()) return;                       // sin técnicos: queda ABIERTO, sin error
        Map<String, Long> carga = tickets.contarVigentesPorTecnico(categoria,
                candidatos.stream().map(Tecnico::getUsername).toList());
        Optional<Tecnico> elegido = asignacion.elegir(candidatos, carga);
        elegido.ifPresent(t -> ticket.asignarA(t.getUsername(), "sistema", true, ahora));
    }

    @Override
    public Ticket cambiarEstado(Actor actor, CambiarEstadoCommand c) {
        Validacion.exigir("código", c.codigo(), "estado", c.estado());
        EstadoTicket nuevo = EstadoTicket.de(c.estado());
        return transaccion.ejecutar(() -> {
            Ticket ticket = cargar(c.codigo());
            acceso.asegurarPuedeCambiarEstado(ticket, actor);
            ticket.cambiarEstado(nuevo, actor.username(), c.comentario(), reloj.instant());
            return tickets.guardar(ticket);
        });
    }

    @Override
    public Ticket reabrir(Actor actor, ReabrirTicketCommand c) {
        Validacion.exigir("código", c.codigo());
        return transaccion.ejecutar(() -> {
            Ticket ticket = cargar(c.codigo());
            acceso.asegurarPuedeReabrir(ticket, actor);
            ticket.reabrir(c.motivo(), actor.username(), reloj.instant());
            return tickets.guardar(ticket);
        });
    }

    @Override
    public Ticket reasignar(Actor actor, ReasignarTicketCommand c) {
        acceso.asegurarAdmin(actor, "reasignar tickets");
        Validacion.exigir("código", c.codigo(), "técnico", c.tecnico());
        return transaccion.ejecutar(() -> {
            Ticket ticket = cargar(c.codigo());
            Tecnico destino = tecnicos.buscarPorUsername(c.tecnico().trim())
                    .orElseThrow(() -> new TecnicoNoEncontradoException(c.tecnico().trim()));
            ticket.asignarA(destino.getUsername(), actor.username(), false, reloj.instant());
            return tickets.guardar(ticket);
        });
    }

    @Override
    public Ticket porCodigo(Actor actor, String codigo) {
        Ticket ticket = cargar(codigo);
        acceso.asegurarPuedeVer(ticket, actor);
        return ticket;
    }

    @Override
    public List<Ticket> consultar(Actor actor, ConsultarTicketsQuery q) {
        EstadoTicket estado = q.estado() == null || q.estado().isBlank() ? null : EstadoTicket.de(q.estado());
        Prioridad prioridad = q.prioridad() == null || q.prioridad().isBlank() ? null : Prioridad.de(q.prioridad());
        TipoTicket tipo = q.tipo() == null || q.tipo().isBlank() ? null : TipoTicket.de(q.tipo());
        Categoria categoria = q.categoria() == null || q.categoria().isBlank() ? null : Categoria.de(q.categoria());
        PoliticaAcceso.Visibilidad alcance = acceso.visibilidadPara(actor);
        return tickets.buscar(new FiltroTicket(estado, prioridad, categoria, tipo, alcance.creadoPor(), alcance.asignadoA()));
    }

    private Ticket cargar(String codigo) {
        return tickets.buscarPorCodigo(codigo.trim().toUpperCase())
                .orElseThrow(() -> new TicketNoEncontradoException(codigo));
    }
}
