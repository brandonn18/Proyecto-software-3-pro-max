package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.util.Locale;
import java.util.Set;

/**
 * Ciclo de vida: abierto -> asignado -> en_proceso <-> en_espera -> resuelto -> cerrado.
 * Las transiciones válidas son DATOS (un mapa), no condicionales repartidos: agregar un estado es agregar una línea (OCP).
 * ABIERTO -> ASIGNADO no es una transición manual: ocurre al asignar un técnico.
 */
public enum EstadoTicket {
    ABIERTO, ASIGNADO, EN_PROCESO, EN_ESPERA, RESUELTO, CERRADO;

    public Set<EstadoTicket> siguientes() {
        switch (this) {
            case ASIGNADO:   return Set.of(EN_PROCESO);
            case EN_PROCESO: return Set.of(EN_ESPERA, RESUELTO);
            case EN_ESPERA:  return Set.of(EN_PROCESO);
            case RESUELTO:   return Set.of(CERRADO);
            default:         return Set.of();
        }
    }

    public boolean puedePasarA(EstadoTicket nuevo) {
        return siguientes().contains(nuevo);
    }

    /** "Abierto" en el sentido de carga de trabajo: todavía no está resuelto ni cerrado. */
    public boolean estaVigente() {
        return this != RESUELTO && this != CERRADO;
    }

    public static EstadoTicket de(String texto) {
        try {
            return valueOf(texto.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValorInvalidoException("Estado desconocido: '" + texto
                    + "' (use ABIERTO, ASIGNADO, EN_PROCESO, EN_ESPERA, RESUELTO o CERRADO)");
        }
    }
}
