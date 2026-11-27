package com.ticketsti.soporte.application.port.in;

/**
 * M-01 (RF-09): revisa los tickets vigentes, alerta los que consumieron el 80 % del SLA y marca los vencidos.
 * No tiene actor: lo dispara el sistema (un adaptador programado), no una persona, así que no pasa por PoliticaAcceso.
 */
@FunctionalInterface
public interface VerificarSlaUseCase {
    ResultadoVerificacionSla verificar();
}
