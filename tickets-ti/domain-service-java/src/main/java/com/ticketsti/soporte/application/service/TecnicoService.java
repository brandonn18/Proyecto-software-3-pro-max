package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.application.port.in.TecnicoUseCase;
import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.application.port.out.TransaccionPort;
import com.ticketsti.soporte.domain.exception.TecnicoDuplicadoException;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.List;

public class TecnicoService implements TecnicoUseCase {

    private final TecnicoRepositoryPort tecnicos;
    private final TransaccionPort transaccion;
    private final PoliticaAcceso acceso;

    public TecnicoService(TecnicoRepositoryPort tecnicos, TransaccionPort transaccion, PoliticaAcceso acceso) {
        this.tecnicos = tecnicos;
        this.transaccion = transaccion;
        this.acceso = acceso;
    }

    @Override
    public Tecnico registrar(Actor actor, RegistrarTecnicoCommand c) {
        acceso.asegurarAdmin(actor, "registrar técnicos");
        Validacion.exigir("usuario", c.username(), "categorías", c.categorias() == null || c.categorias().isEmpty() ? null : "ok");
        List<Categoria> categorias = c.categorias().stream().map(Categoria::de).toList();
        return transaccion.ejecutar(() -> {
            Tecnico nuevo = Tecnico.registrar(c.username(), categorias);
            if (tecnicos.buscarPorUsername(nuevo.getUsername()).isPresent()) {
                throw new TecnicoDuplicadoException(nuevo.getUsername());
            }
            return tecnicos.guardar(nuevo);
        });
    }

    @Override
    public List<Tecnico> listar(Actor actor) {
        acceso.asegurarAdmin(actor, "consultar los técnicos");
        return tecnicos.listar();
    }
}
