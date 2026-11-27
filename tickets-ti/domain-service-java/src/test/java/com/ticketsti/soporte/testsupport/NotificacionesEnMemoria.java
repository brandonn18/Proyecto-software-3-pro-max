package com.ticketsti.soporte.testsupport;

import com.ticketsti.soporte.application.notificacion.Notificacion;
import com.ticketsti.soporte.application.notificacion.TipoNotificacion;
import com.ticketsti.soporte.application.port.out.NotificacionPort;
import java.util.ArrayList;
import java.util.List;

/** Doble de prueba: guarda las notificaciones en orden. Con {@link #fallar()} simula un canal caído. */
public class NotificacionesEnMemoria implements NotificacionPort {

    private final List<Notificacion> enviadas = new ArrayList<>();
    private boolean falla;

    @Override
    public void notificar(Notificacion notificacion) {
        if (falla) throw new IllegalStateException("canal de notificaciones caído (simulado)");
        enviadas.add(notificacion);
    }

    public void fallar() {
        falla = true;
    }

    public List<Notificacion> enviadas() {
        return List.copyOf(enviadas);
    }

    public List<TipoNotificacion> tipos() {
        return enviadas.stream().map(Notificacion::tipo).toList();
    }

    public Notificacion ultima() {
        return enviadas.get(enviadas.size() - 1);
    }

    public void limpiar() {
        enviadas.clear();
    }
}
