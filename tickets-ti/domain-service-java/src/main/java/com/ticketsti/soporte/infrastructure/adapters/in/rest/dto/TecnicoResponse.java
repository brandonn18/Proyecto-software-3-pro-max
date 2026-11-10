package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.Comparator;
import java.util.List;

public record TecnicoResponse(Long id, String username, List<String> categorias) {

    public static TecnicoResponse de(Tecnico t) {
        return new TecnicoResponse(t.getId(), t.getUsername(),
                t.getCategorias().stream().map(Categoria::nombre).sorted(Comparator.naturalOrder()).toList());
    }
}
