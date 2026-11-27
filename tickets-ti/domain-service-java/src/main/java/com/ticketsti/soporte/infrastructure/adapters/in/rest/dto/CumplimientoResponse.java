package com.ticketsti.soporte.infrastructure.adapters.in.rest.dto;

import com.ticketsti.soporte.application.reporte.Cumplimiento;

/** @param porcentaje null si no hay tickets terminados que medir */
public record CumplimientoResponse(long resueltos, long dentroDelPlazo, long fueraDelPlazo, Double porcentaje) {

    public static CumplimientoResponse de(Cumplimiento c) {
        return new CumplimientoResponse(c.resueltos(), c.dentroDelPlazo(), c.fueraDelPlazo(), c.porcentaje());
    }
}
