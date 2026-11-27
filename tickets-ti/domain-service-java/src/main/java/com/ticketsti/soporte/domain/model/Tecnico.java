package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/** Persona que atiende tickets. Su {@code username} es el mismo que tiene en AuthCore (el {@code sub} del JWT). */
public class Tecnico {

    private final Long id;
    private final String username;
    private final Set<Categoria> categorias;

    private Tecnico(Long id, String username, Collection<Categoria> categorias) {
        this.id = id;
        this.username = username;
        this.categorias = Set.copyOf(new LinkedHashSet<>(categorias));
    }

    public static Tecnico registrar(String username, Collection<Categoria> categorias) {
        if (username == null || username.isBlank()) {
            throw new ValorInvalidoException("El usuario del técnico es obligatorio");
        }
        if (username.trim().length() > 60) {
            throw new ValorInvalidoException("El usuario del técnico no puede pasar de 60 caracteres");
        }
        if (categorias == null || categorias.isEmpty()) {
            throw new ValorInvalidoException("El técnico debe atender al menos una categoría");
        }
        return new Tecnico(null, username.trim(), categorias);
    }

    public static Tecnico reconstruir(Long id, String username, Collection<Categoria> categorias) {
        return new Tecnico(id, username, categorias);
    }

    public boolean atiende(Categoria categoria) {
        return categorias.contains(categoria);
    }

    public Long getId() { return id; }

    public String getUsername() { return username; }

    public Set<Categoria> getCategorias() { return categorias; }
}
