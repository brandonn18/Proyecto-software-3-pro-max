package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import com.ticketsti.soporte.application.port.in.TecnicoUseCase;
import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.TecnicoRequest;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.TecnicoResponse;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Técnicos y las categorías que atienden: gestión exclusiva del administrador (HU-8, asignación automática). */
@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

    private final TecnicoUseCase tecnicos;

    public TecnicoController(TecnicoUseCase tecnicos) {
        this.tecnicos = tecnicos;
    }

    @PostMapping
    public ResponseEntity<TecnicoResponse> registrar(@RequestBody TecnicoRequest r) {
        var t = tecnicos.registrar(ActorActual.obtener(), new RegistrarTecnicoCommand(r.username(), r.categorias()));
        return ResponseEntity.created(URI.create("/api/tecnicos/" + t.getId())).body(TecnicoResponse.de(t));
    }

    @GetMapping
    public List<TecnicoResponse> listar() {
        return tecnicos.listar(ActorActual.obtener()).stream().map(TecnicoResponse::de).toList();
    }
}
