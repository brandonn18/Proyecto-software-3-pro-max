package com.ticketsti.soporte.infrastructure.adapters.out.notificacion;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.port.out.NotificacionPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * M-02: primer adaptador de {@link NotificacionPort}. Deja cada aviso en el log del servicio (en la EC2, en
 * {@code journalctl -u domain-service}). Un correo o un Socket.io serían otros adaptadores del mismo puerto, sin tocar
 * los casos de uso.
 */
@Component
public class NotificacionRegistroAdapter implements NotificacionPort {

    private static final Logger LOG = LoggerFactory.getLogger(NotificacionRegistroAdapter.class);

    @Override
    public void notificar(Notificacion n) {
        try {
            LOG.info("Notificación {} {} «{}» prioridad={} creadoPor={} técnico={}: {}",
                    n.tipo(), n.codigo(), enUnaLinea(n.titulo()), n.prioridad(), n.creadoPor(),
                    n.tecnico() == null ? "sin asignar" : n.tecnico(), enUnaLinea(n.detalle()));
        } catch (RuntimeException e) {
            LOG.warn("No se pudo registrar la notificación {} de {}", n.tipo(), n.codigo(), e);
        }
    }

    /** El título y el detalle los escribe un usuario: sin saltos de línea, nadie puede fabricar líneas falsas en el log. */
    private static String enUnaLinea(String texto) {
        return texto == null ? "" : texto.replaceAll("[\\r\\n]+", " ");
    }
}
