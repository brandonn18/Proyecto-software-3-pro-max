package com.ticketsti.soporte.application.port.out;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.List;
import java.util.Optional;

public interface TecnicoRepositoryPort {

    Tecnico guardar(Tecnico tecnico);

    Optional<Tecnico> buscarPorUsername(String username);

    List<Tecnico> buscarPorCategoria(Categoria categoria);

    List<Tecnico> listar();
}
