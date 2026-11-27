package com.ticketsti.soporte.application.port.out;

import java.util.function.Supplier;

/**
 * Ejecuta un bloque de trabajo de forma atómica: o se aplica todo, o no se aplica nada (HU-10).
 * Así la capa de aplicación no necesita importar @Transactional de Spring.
 */
public interface TransaccionPort {

    <T> T ejecutar(Supplier<T> trabajo);
}
