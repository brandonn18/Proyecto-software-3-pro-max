package com.ticketsti.soporte.domain.vo;

/**
 * Carga de trabajo de un técnico en una categoría: sus tickets vigentes y, de ellos, cuántos son CRITICA.
 * Es lo que una {@code PoliticaAsignacion} puede mirar para decidir (M-07).
 */
public record CargaTecnico(long vigentes, long criticos) {

    /** La de un técnico sin tickets vigentes en la categoría. */
    public static final CargaTecnico SIN_CARGA = new CargaTecnico(0, 0);
}
