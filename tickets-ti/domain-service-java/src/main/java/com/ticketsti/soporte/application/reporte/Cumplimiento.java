package com.ticketsti.soporte.application.reporte;

/**
 * Cuántos tickets terminados se resolvieron dentro y fuera del plazo del SLA.
 *
 * @param porcentaje porcentaje resuelto dentro del plazo, con un decimal; null si no hay tickets terminados que medir
 */
public record Cumplimiento(long resueltos, long dentroDelPlazo, long fueraDelPlazo, Double porcentaje) {

    public static Cumplimiento de(long dentroDelPlazo, long fueraDelPlazo) {
        long resueltos = dentroDelPlazo + fueraDelPlazo;
        Double porcentaje = resueltos == 0 ? null : Math.round(dentroDelPlazo * 1000.0 / resueltos) / 10.0;
        return new Cumplimiento(resueltos, dentroDelPlazo, fueraDelPlazo, porcentaje);
    }
}
