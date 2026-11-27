package com.ticketsti.soporte.infrastructure.config;

import com.ticketsti.soporte.application.port.out.*;
import com.ticketsti.soporte.application.service.*;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Raíz de composición. El dominio y la aplicación no llevan anotaciones de Spring (Semana 5, DIP):
 * es esta clase, en el borde, la que los construye y les entrega sus dependencias.
 */
@Configuration
public class BeanConfig {

    @Bean
    Clock reloj(@Value("${negocio.zona-horaria}") String zona) {
        return Clock.system(ZoneId.of(zona));
    }

    @Bean
    PoliticaAsignacion politicaAsignacion() {
        return new PoliticaAsignacion();
    }

    @Bean
    PoliticaAcceso politicaAcceso() {
        return new PoliticaAcceso();
    }

    @Bean
    TecnicoService tecnicoService(TecnicoRepositoryPort tecnicos, TransaccionPort transaccion, PoliticaAcceso acceso) {
        return new TecnicoService(tecnicos, transaccion, acceso);
    }

    @Bean
    TicketService ticketService(TicketRepositoryPort tickets, TecnicoRepositoryPort tecnicos, TransaccionPort transaccion,
                                Clock reloj, PoliticaAsignacion asignacion, PoliticaAcceso acceso) {
        return new TicketService(tickets, tecnicos, transaccion, reloj, asignacion, acceso);
    }
}
