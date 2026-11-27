package com.ticketsti.soporte.application.service;

import static com.ticketsti.soporte.application.notificacion.TipoNotificacion.*;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.application.port.out.NotificacionPort;
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
 * Los avisos (M-02) salen después de la transacción: solo se notifica lo que quedó guardado.
 */
public class TicketService implements TicketUseCase {

    private final TicketRepositoryPort tickets;
    private final TecnicoRepositoryPort tecnicos;
    private final TransaccionPort transaccion;
    private final Clock reloj;
    private final PoliticaAsignacion asignacion;
    private final PoliticaAcceso acceso;
    private final Avisos avisos;

    public TicketService(TicketRepositoryPort tickets, TecnicoRepositoryPort tecnicos, TransaccionPort transaccion,
                         Clock reloj, PoliticaAsignacion asignacion, PoliticaAcceso acceso,
                         NotificacionPort notificaciones) {
        this.tickets = tickets;
        this.tecnicos = tecnicos;
        this.transaccion = transaccion;
        this.reloj = reloj;
        this.asignacion = asignacion;
        this.acceso = acceso;
        this.avisos = new Avisos(notificaciones);
    }

    @Override
    public Ticket crear(Actor actor, CrearTicketCommand c) {
        Validacion.exigir("título", c.titulo(), "descripción", c.descripcion(), "tipo", c.tipo(),
                "categoría", c.categoria(), "prioridad", c.prioridad());
        TipoTicket tipo = TipoTicket.de(c.tipo());
        Categoria categoria = Categoria.de(c.categoria());
        Prioridad prioridad = Prioridad.de(c.prioridad());
        Ticket creado = transaccion.ejecutar(() -> {
            Instant ahora = reloj.instant();
            int anio = LocalDate.ofInstant(ahora, reloj.getZone()).getYear();
            String codigo = Ticket.formatoCodigo(anio, tickets.siguienteConsecutivo(anio));
            Ticket ticket = Ticket.crear(codigo, c.titulo(), c.descripcion(), tipo, categoria, prioridad, actor.username(), ahora);
            asignarAutomaticamente(ticket, categoria, ahora);
            return tickets.guardar(ticket);
        });
        avisos.enviar(Notificacion.de(TICKET_CREADO, creado, creado.getHistorial().get(0)));
        if (creado.getTecnico() != null) avisos.enviar(Notificacion.delUltimoCambio(TICKET_ASIGNADO, creado));
        return creado;
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
        Ticket cambiado = transaccion.ejecutar(() -> {
            Ticket ticket = cargar(c.codigo());
            acceso.asegurarPuedeCambiarEstado(ticket, actor);
            ticket.cambiarEstado(nuevo, actor.username(), c.comentario(), reloj.instant());
            return tickets.guardar(ticket);
        });
        if (nuevo == EstadoTicket.RESUELTO) avisos.enviar(Notificacion.delUltimoCambio(TICKET_RESUELTO, cambiado));
        return cambiado;
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
        Ticket reasignado = transaccion.ejecutar(() -> {
            Ticket ticket = cargar(c.codigo());
            Tecnico destino = tecnicos.buscarPorUsername(c.tecnico().trim())
                    .orElseThrow(() -> new TecnicoNoEncontradoException(c.tecnico().trim()));
            ticket.asignarA(destino.getUsername(), actor.username(), false, reloj.instant());
            return tickets.guardar(ticket);
        });
        avisos.enviar(Notificacion.delUltimoCambio(TICKET_ASIGNADO, reasignado));
        return reasignado;
    }

    @Override
    public Ticket porCodigo(Actor actor, String codigo) {
        Ticket ticket = cargar(codigo);
        acceso.asegurarPuedeVer(ticket, actor);
        return ticket;
    }

    @Override
    public List<Ticket> consultar(Actor actor, ConsultarTicketsQuery q) {
        return tickets.buscar(filtro(actor, q));
    }

    @Override
    public Pagina<Ticket> consultarPagina(Actor actor, ConsultarTicketsQuery q, Paginacion paginacion) {
        return tickets.buscar(filtro(actor, q), paginacion);
    }

    /** Los filtros pedidos más la visibilidad del rol: se aplican antes de paginar, así el total solo cuenta lo visible. */
    private FiltroTicket filtro(Actor actor, ConsultarTicketsQuery q) {
        EstadoTicket estado = q.estado() == null || q.estado().isBlank() ? null : EstadoTicket.de(q.estado());
        Prioridad prioridad = q.prioridad() == null || q.prioridad().isBlank() ? null : Prioridad.de(q.prioridad());
        TipoTicket tipo = q.tipo() == null || q.tipo().isBlank() ? null : TipoTicket.de(q.tipo());
        Categoria categoria = q.categoria() == null || q.categoria().isBlank() ? null : Categoria.de(q.categoria());
        PoliticaAcceso.Visibilidad alcance = acceso.visibilidadPara(actor);
        return new FiltroTicket(estado, prioridad, categoria, tipo, alcance.creadoPor(), alcance.asignadoA());
    }

    private Ticket cargar(String codigo) {
        return tickets.buscarPorCodigo(codigo.trim().toUpperCase())
                .orElseThrow(() -> new TicketNoEncontradoException(codigo));
    }
}
