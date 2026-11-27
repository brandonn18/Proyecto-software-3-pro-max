package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.port.out.TransaccionPort;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Todo lo que haga el caso de uso dentro de ejecutar() es una sola unidad: o se guarda completo o no se guarda nada. */
@Component
public class TransaccionSpringAdapter implements TransaccionPort {

    private final TransactionTemplate plantilla;

    public TransaccionSpringAdapter(PlatformTransactionManager manager) {
        this.plantilla = new TransactionTemplate(manager);
    }

    @Override
    public <T> T ejecutar(Supplier<T> trabajo) {
        return plantilla.execute(estado -> trabajo.get());   // una RuntimeException revierte todo
    }
}
