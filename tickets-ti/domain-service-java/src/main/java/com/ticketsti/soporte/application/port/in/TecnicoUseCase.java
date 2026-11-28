package com.ticketsti.soporte.application.port.in;

import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Tecnico;
import java.util.List;

public interface TecnicoUseCase {

    Tecnico registrar(Actor actor, RegistrarTecnicoCommand comando);

    List<Tecnico> listar(Actor actor);

    /** Un técnico se identifica por su usuario, el mismo que tiene en AuthCore. Solo el ADMIN lo consulta. */
    Tecnico porUsername(Actor actor, String username);
}
