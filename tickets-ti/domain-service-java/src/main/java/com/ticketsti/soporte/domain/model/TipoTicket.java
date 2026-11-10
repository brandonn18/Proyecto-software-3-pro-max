package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import java.util.Locale;

public enum TipoTicket {
    INCIDENTE, SOLICITUD;

    public static TipoTicket de(String texto) {
        try {
            return valueOf(texto.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new ValorInvalidoException("Tipo de ticket desconocido: '" + texto + "' (use INCIDENTE o SOLICITUD)");
        }
    }
}
