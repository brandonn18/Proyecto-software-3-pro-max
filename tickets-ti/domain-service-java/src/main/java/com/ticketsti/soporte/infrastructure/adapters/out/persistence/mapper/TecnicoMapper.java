package com.ticketsti.soporte.infrastructure.adapters.out.persistence.mapper;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TecnicoEntity;

public final class TecnicoMapper {

    private TecnicoMapper() { }

    public static Tecnico aDominio(TecnicoEntity e) {
        return Tecnico.reconstruir(e.getId(), e.getUsername(), e.getCategorias().stream().map(Categoria::de).toList());
    }

    public static void copiarA(TecnicoEntity e, Tecnico t) {
        e.setUsername(t.getUsername());
        e.getCategorias().clear();
        t.getCategorias().forEach(c -> e.getCategorias().add(c.nombre()));
    }
}
