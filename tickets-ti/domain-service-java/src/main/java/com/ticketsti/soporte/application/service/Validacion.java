package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.util.ArrayList;
import java.util.List;

/** Ayuda común: revisar todos los campos obligatorios y reportar TODOS los que faltan, no solo el primero. */
final class Validacion {

    private Validacion() { }

    static void exigir(Object... nombreYValor) {
        List<String> faltantes = new ArrayList<>();
        for (int i = 0; i < nombreYValor.length; i += 2) {
            Object valor = nombreYValor[i + 1];
            boolean vacio = valor == null || (valor instanceof String s && s.isBlank());
            if (vacio) faltantes.add((String) nombreYValor[i]);
        }
        if (!faltantes.isEmpty()) {
            throw new ValorInvalidoException("Faltan campos obligatorios: " + String.join(", ", faltantes));
        }
    }
}
