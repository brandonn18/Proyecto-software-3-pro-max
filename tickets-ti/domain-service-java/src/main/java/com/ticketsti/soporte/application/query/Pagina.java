package com.ticketsti.soporte.application.query;

import java.util.List;
import java.util.function.Function;

/**
 * M-05: una página de resultados.
 *
 * @param total cuántos elementos cumplen la consulta en total, sin cortar en páginas
 */
public record Pagina<T>(List<T> elementos, long total) {

    public Pagina {
        elementos = List.copyOf(elementos);
    }

    /** Una «página» con todos los resultados. */
    public static <T> Pagina<T> completa(List<T> elementos) {
        return new Pagina<>(elementos, elementos.size());
    }

    public <R> Pagina<R> map(Function<? super T, ? extends R> conversion) {
        return new Pagina<>(elementos.stream().<R>map(conversion).toList(), total);
    }
}
