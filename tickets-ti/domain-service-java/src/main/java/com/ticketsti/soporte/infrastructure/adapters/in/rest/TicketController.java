package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** HU-8 a HU-12. El controlador solo traduce HTTP a casos de uso: no contiene reglas de negocio ni de permisos. */
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketUseCase tickets;

    public TicketController(TicketUseCase tickets) {
        this.tickets = tickets;
    }

    @PostMapping
    public ResponseEntity<TicketResponse> crear(@RequestBody TicketRequest r) {
        var t = tickets.crear(ActorActual.obtener(),
                new CrearTicketCommand(r.titulo(), r.descripcion(), r.tipo(), r.categoria(), r.prioridad()));
        return ResponseEntity.created(URI.create("/api/tickets/" + t.getCodigo())).body(TicketResponse.de(t));
    }

    private static final Set<String> PARAMETROS = Set.of("estado", "prioridad", "categoria", "tipo", "page", "size");

    /** M-05: cuántos tickets cumplen la consulta en total, antes de cortar en páginas. Va en toda respuesta de la lista. */
    static final String TOTAL = "X-Total-Count";

    /**
     * Sin {@code page} ni {@code size} devuelve la lista completa, como antes de M-05. Con cualquiera de los dos, una
     * página ({@code page} desde 0; {@code size} de 1 a 100, 20 por defecto). En ambos casos, el total va en {@value #TOTAL}.
     */
    @GetMapping
    public ResponseEntity<List<TicketResponse>> consultar(HttpServletRequest peticion,
                                                          @RequestParam(required = false) String estado,
                                                          @RequestParam(required = false) String prioridad,
                                                          @RequestParam(required = false) String categoria,
                                                          @RequestParam(required = false) String tipo,
                                                          @RequestParam(required = false) Integer page,
                                                          @RequestParam(required = false) Integer size) {
        for (String nombre : peticion.getParameterMap().keySet()) {
            if (!PARAMETROS.contains(nombre)) {
                throw new ValorInvalidoException("Parámetro desconocido: '" + nombre
                        + "' (use estado, prioridad, categoria, tipo, page o size)");
            }
        }
        var consulta = new ConsultarTicketsQuery(estado, prioridad, categoria, tipo);
        Pagina<Ticket> resultado = page == null && size == null
                ? Pagina.completa(tickets.consultar(ActorActual.obtener(), consulta))
                : tickets.consultarPagina(ActorActual.obtener(), consulta, Paginacion.de(page, size));
        return ResponseEntity.ok()
                .header(TOTAL, String.valueOf(resultado.total()))
                .body(resultado.map(TicketResponse::de).elementos());
    }

    @GetMapping("/{codigo}")
    public TicketResponse obtener(@PathVariable String codigo) {
        return TicketResponse.de(tickets.porCodigo(ActorActual.obtener(), codigo));
    }

    @PatchMapping("/{codigo}/status")
    public TicketResponse cambiarEstado(@PathVariable String codigo, @RequestBody CambioEstadoRequest r) {
        return TicketResponse.de(tickets.cambiarEstado(ActorActual.obtener(), new CambiarEstadoCommand(codigo, r.estado(), r.comentario())));
    }

    @PostMapping("/{codigo}/reopen")
    public TicketResponse reabrir(@PathVariable String codigo, @RequestBody ReaperturaRequest r) {
        return TicketResponse.de(tickets.reabrir(ActorActual.obtener(), new ReabrirTicketCommand(codigo, r.motivo())));
    }

    @PostMapping("/{codigo}/assign")
    public TicketResponse reasignar(@PathVariable String codigo, @RequestBody ReasignacionRequest r) {
        return TicketResponse.de(tickets.reasignar(ActorActual.obtener(), new ReasignarTicketCommand(codigo, r.tecnico())));
    }
}
