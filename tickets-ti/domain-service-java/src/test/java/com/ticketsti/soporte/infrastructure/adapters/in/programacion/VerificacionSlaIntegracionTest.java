package com.ticketsti.soporte.infrastructure.adapters.in.programacion;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.TecnicoUseCase;
import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.VerificarSlaUseCase;
import com.ticketsti.soporte.application.port.in.command.CambiarEstadoCommand;
import com.ticketsti.soporte.application.port.in.command.CrearTicketCommand;
import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.testsupport.Datos;
import com.ticketsti.soporte.testsupport.RelojAjustable;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * M-01 de punta a punta en la aplicación real: caso de uso -> JPA -> H2, con la transacción de Spring y un reloj
 * ajustable. Usa una base H2 propia, y el programador queda en un intervalo de un día para no cruzarse con la prueba.
 */
@SpringBootTest
class VerificacionSlaIntegracionTest {

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded()));
        registro.add("spring.datasource.url", () -> "jdbc:h2:mem:sla-integracion;MODE=MySQL;DB_CLOSE_DELAY=-1");
        registro.add("negocio.sla.intervalo-verificacion", () -> "P1D");
    }

    @TestConfiguration
    static class RelojDePrueba {
        @Bean
        @Primary
        RelojAjustable relojAjustable() {
            return Datos.relojAjustable();
        }
    }

    @Autowired private TicketUseCase tickets;
    @Autowired private TecnicoUseCase tecnicos;
    @Autowired private VerificarSlaUseCase verificarSla;
    @Autowired private RelojAjustable reloj;

    @Test
    @DisplayName("Alerta al 80 % y vencimiento quedan guardados, sin repetirse ni pisar el cambio de estado del técnico")
    void alertaYVencimientoEnLaBase() {
        tecnicos.registrar(Datos.admin(), new RegistrarTecnicoCommand("ana", List.of("hardware")));
        String codigo = tickets.crear(Datos.usuario("maria"), new CrearTicketCommand("Impresora sin respuesta",
                "La impresora del segundo piso no imprime", "incidente", "hardware", "alta")).getCodigo();

        reloj.avanzar(Duration.ofMinutes(383));                          // ALTA: el 80 % llega a los 384 min
        assertTrue(verificarSla.verificar().sinNovedades());

        reloj.avanzar(Duration.ofMinutes(1));
        assertEquals(List.of(codigo), verificarSla.verificar().alertados());
        Ticket conAlerta = tickets.porCodigo(Datos.admin(), codigo);
        assertEquals(reloj.instant(), conAlerta.getAlertaSlaEn());
        assertNull(conAlerta.getSlaVencidoEn());
        assertTrue(verificarSla.verificar().sinNovedades(), "la alerta no debe repetirse");

        // entre pasadas, el técnico trabaja el ticket: la siguiente marca no debe deshacer su cambio
        tickets.cambiarEstado(Datos.tecnico("ana"), new CambiarEstadoCommand(codigo, "en_proceso", "Revisando"));

        reloj.avanzar(Duration.ofMinutes(96));                            // 8 h: vence
        assertEquals(List.of(codigo), verificarSla.verificar().vencidos());
        Ticket vencido = tickets.porCodigo(Datos.admin(), codigo);
        assertEquals(EstadoTicket.EN_PROCESO, vencido.getEstado());
        assertEquals(reloj.instant(), vencido.getSlaVencidoEn());
        assertEquals(conAlerta.getAlertaSlaEn(), vencido.getAlertaSlaEn());
        assertEquals("SLA vencido", vencido.getHistorial().get(vencido.getHistorial().size() - 1).detalle());
        assertTrue(verificarSla.verificar().sinNovedades(), "el vencimiento no debe repetirse");
    }
}
