package com.pamplona.authcore.infrastructure.adapters.in.rest;

import com.pamplona.authcore.application.ports.in.GetUserUseCase;
import com.pamplona.authcore.application.ports.in.ListUsersByRoleUseCase;
import com.pamplona.authcore.domain.Role;
import com.pamplona.authcore.infrastructure.adapters.in.rest.dto.UserResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Adaptador de entrada servicio a servicio: lo consume AuthcoreUserAdapter de
 * domain-service. Lo protege InternalKeyFilter (cabecera X-Internal-Key), no el
 * JWT, porque domain-service tambien consulta usuarios desde tareas programadas
 * (alertas SLA) donde no hay un usuario autenticado.
 * Nunca devuelve el hash de la contrasena.
 */
@RestController
@RequestMapping("/internal")
public class InternalController {

    private final GetUserUseCase getUserUseCase;
    private final ListUsersByRoleUseCase listUsersByRoleUseCase;

    public InternalController(GetUserUseCase getUserUseCase, ListUsersByRoleUseCase listUsersByRoleUseCase) {
        this.getUserUseCase = getUserUseCase;
        this.listUsersByRoleUseCase = listUsersByRoleUseCase;
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(UserResponse.from(getUserUseCase.getUser(id)));
    }

    @GetMapping("/tecnicos")
    public ResponseEntity<List<UserResponse>> listTecnicos() {
        List<UserResponse> tecnicos = listUsersByRoleUseCase.listUsersByRole(Role.TECNICO).stream()
                .map(UserResponse::from).toList();
        return ResponseEntity.ok(tecnicos);
    }
}
