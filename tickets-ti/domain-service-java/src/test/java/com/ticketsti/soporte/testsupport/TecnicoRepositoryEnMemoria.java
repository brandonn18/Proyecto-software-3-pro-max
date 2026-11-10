package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.*;

/** Doble de prueba que guarda copias, como una base de datos real. */
public class TecnicoRepositoryEnMemoria implements TecnicoRepositoryPort {

    private final Map<Long, Tecnico> filas = new TreeMap<>();
    private long siguiente = 1;

    @Override
    public Tecnico guardar(Tecnico t) {
        long id = t.getId() == null ? siguiente++ : t.getId();
        Tecnico copia = Tecnico.reconstruir(id, t.getUsername(), t.getCategorias());
        filas.put(id, copia);
        return copia;
    }

    @Override
    public Optional<Tecnico> buscarPorUsername(String username) {
        return filas.values().stream().filter(t -> t.getUsername().equals(username)).findFirst();
    }

    @Override
    public List<Tecnico> buscarPorCategoria(Categoria categoria) {
        return filas.values().stream().filter(t -> t.atiende(categoria)).toList();
    }

    @Override
    public List<Tecnico> listar() { return new ArrayList<>(filas.values()); }
}
