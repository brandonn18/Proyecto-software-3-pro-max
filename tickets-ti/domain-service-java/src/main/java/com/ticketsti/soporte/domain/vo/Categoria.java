package com.ticketsti.soporte.domain.vo;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.util.Locale;

/** Categoría de soporte (REDES, SOFTWARE...). Se normaliza a mayúsculas para que «redes» y «REDES» sean la misma. */
public record Categoria(String nombre) {

    public Categoria {
        if (nombre == null || nombre.isBlank()) {
            throw new ValorInvalidoException("La categoría es obligatoria");
        }
        nombre = nombre.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        if (nombre.length() < 2 || nombre.length() > 40) {
            throw new ValorInvalidoException("La categoría debe tener entre 2 y 40 caracteres");
        }
    }

    public static Categoria de(String texto) {
        return new Categoria(texto);
    }

    @Override
    public String toString() {
        return nombre;
    }
}
