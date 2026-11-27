package com.ticketsti.soporte.application.query;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;

/**
 * M-05: qué página se pide. {@code pagina} empieza en 0; {@code tamano} va de 1 a {@value #TAMANO_MAXIMO}.
 * Un valor fuera de rango es un dato inválido (400): no se corrige en silencio.
 */
public record Paginacion(int pagina, int tamano) {

    public static final int TAMANO_POR_DEFECTO = 20;
    public static final int TAMANO_MAXIMO = 100;

    public Paginacion {
        if (pagina < 0) {
            throw new ValorInvalidoException("La página (page) empieza en 0 y no puede ser negativa");
        }
        if (tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new ValorInvalidoException("El tamaño de página (size) debe estar entre 1 y " + TAMANO_MAXIMO);
        }
    }

    /** Lo que falte toma su valor por defecto: página 0 y tamaño {@value #TAMANO_POR_DEFECTO}. */
    public static Paginacion de(Integer pagina, Integer tamano) {
        return new Paginacion(pagina == null ? 0 : pagina, tamano == null ? TAMANO_POR_DEFECTO : tamano);
    }

    /** Posición del primer elemento de la página (en long: una página muy alta no desborda). */
    public long desde() {
        return (long) pagina * tamano;
    }
}
