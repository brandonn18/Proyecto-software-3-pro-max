package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.*;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.*;
import java.net.URI;
import java.util.List;
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

    @GetMapping
    public List<TicketResponse> consultar(@RequestParam(required = false) String estado,
                                          @RequestParam(required = false) String prioridad,
                                          @RequestParam(required = false) String categoria,
                                          @RequestParam(required = false) String tipo) {
        return tickets.consultar(ActorActual.obtener(), new ConsultarTicketsQuery(estado, prioridad, categoria, tipo))
                .stream().map(TicketResponse::de).toList();
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
