package com.ticketsti.soporte.infrastructure.adapters.in.programacion;

import com.ticketsti.soporte.application.port.in.ResultadoVerificacionSla;
import com.ticketsti.soporte.application.port.in.VerificarSlaUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Adaptador de entrada programado (M-01): en lugar de una petición HTTP, lo dispara el reloj. Igual que un
 * controlador, solo traduce el disparo a un caso de uso; las reglas están en el dominio.
 * La frecuencia se configura con {@code negocio.sla.intervalo-verificacion} (por defecto, cada minuto).
 */
@Component
public class VerificacionSlaProgramada {

    private static final Logger LOG = LoggerFactory.getLogger(VerificacionSlaProgramada.class);

    private final VerificarSlaUseCase verificarSla;

    public VerificacionSlaProgramada(VerificarSlaUseCase verificarSla) {
        this.verificarSla = verificarSla;
    }

    @Scheduled(initialDelayString = "${negocio.sla.intervalo-verificacion:PT1M}",
            fixedDelayString = "${negocio.sla.intervalo-verificacion:PT1M}")
    public void ejecutar() {
        try {
            ResultadoVerificacionSla r = verificarSla.verificar();
            if (!r.alertados().isEmpty()) LOG.info("SLA al 80 %: {}", r.alertados());
            if (!r.vencidos().isEmpty()) LOG.info("SLA vencido: {}", r.vencidos());
            if (!r.fallidos().isEmpty()) LOG.warn("No se pudo registrar el SLA de {}; se reintenta en la próxima pasada", r.fallidos());
        } catch (RuntimeException e) {
            // si se propaga, el programador lo registra igual; así queda un mensaje claro y la tarea sigue programada
            LOG.error("Falló la verificación de SLA", e);
        }
    }
}
