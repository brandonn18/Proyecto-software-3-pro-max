package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ticketsti.soporte.application.port.in.TecnicoUseCase;
import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.CambiarEstadoCommand;
import com.ticketsti.soporte.application.port.in.command.CrearTicketCommand;
import com.ticketsti.soporte.application.port.in.command.RegistrarTecnicoCommand;
import com.ticketsti.soporte.testsupport.Datos;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * M-03: contrato HTTP de los reportes (rutas, permisos y forma del JSON). Usa una base H2 propia, para que los
 * totales no dependan de lo que crean otras pruebas.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ReportesRestTest {

    private static final String SECRETO = Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded());
    private static final List<String> RUTAS = List.of("/api/reportes/resumen", "/api/reportes/sla", "/api/reportes/tecnicos");

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> SECRETO);
        registro.add("spring.datasource.url", () -> "jdbc:h2:mem:reportes-rest;MODE=MySQL;DB_CLOSE_DELAY=-1");
        registro.add("negocio.sla.intervalo-verificacion", () -> "P1D");
    }

    @Autowired private MockMvc mvc;
    @Autowired private TicketUseCase tickets;
    @Autowired private TecnicoUseCase tecnicos;

    private String bearer(String usuario, String... roles) {
        Instant ahora = Instant.now();
        return "Bearer " + Jwts.builder().subject(usuario).claim("roles", List.of(roles))
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(Duration.ofHours(1))))
                .signWith(Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRETO)), Jwts.SIG.HS384).compact();
    }

    private String admin() { return bearer("admin", "ADMIN", "USER"); }

    @Test
    @DisplayName("Solo el ADMIN: sin token 401; USER y TECNICO 403")
    void permisos() throws Exception {
        for (String ruta : RUTAS) {
            mvc.perform(get(ruta)).andExpect(status().isUnauthorized());
            mvc.perform(get(ruta).header("Authorization", bearer("maria", "USER"))).andExpect(status().isForbidden());
            mvc.perform(get(ruta).header("Authorization", bearer("ana", "TECNICO"))).andExpect(status().isForbidden());
            mvc.perform(get(ruta).header("Authorization", admin())).andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("Forma del JSON de los tres reportes")
    void contratoJson() throws Exception {
        tecnicos.registrar(Datos.admin(), new RegistrarTecnicoCommand("ana", List.of("hardware")));
        String resuelto = tickets.crear(Datos.usuario("maria"), new CrearTicketCommand("Impresora sin respuesta",
                "La impresora del segundo piso no imprime", "incidente", "hardware", "alta")).getCodigo();
        tickets.crear(Datos.usuario("maria"), new CrearTicketCommand("Sin red en la sala",
                "No hay conexión en la sala de reuniones", "incidente", "redes", "baja"));
        tickets.cambiarEstado(Datos.tecnico("ana"), new CambiarEstadoCommand(resuelto, "en_proceso", null));
        tickets.cambiarEstado(Datos.tecnico("ana"), new CambiarEstadoCommand(resuelto, "resuelto", "Listo"));

        mvc.perform(get("/api/reportes/resumen").header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generadoEn").value(notNullValue()))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.vigentes").value(1))
                .andExpect(jsonPath("$.sinAsignar").value(1))
                .andExpect(jsonPath("$.vencidosSinResolver").value(0))
                .andExpect(jsonPath("$.porEstado.RESUELTO").value(1))
                .andExpect(jsonPath("$.porEstado.ABIERTO").value(1))
                .andExpect(jsonPath("$.porEstado.CERRADO").value(0))
                .andExpect(jsonPath("$.porPrioridad.ALTA").value(1))
                .andExpect(jsonPath("$.porPrioridad.CRITICA").value(0))
                .andExpect(jsonPath("$.porCategoria.HARDWARE").value(1))
                .andExpect(jsonPath("$.porCategoria.REDES").value(1));

        mvc.perform(get("/api/reportes/sla").header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generadoEn").value(notNullValue()))
                .andExpect(jsonPath("$.total.resueltos").value(1))
                .andExpect(jsonPath("$.total.dentroDelPlazo").value(1))
                .andExpect(jsonPath("$.total.fueraDelPlazo").value(0))
                .andExpect(jsonPath("$.total.porcentaje").value(100.0))
                .andExpect(jsonPath("$.porPrioridad.ALTA.porcentaje").value(100.0))
                .andExpect(jsonPath("$.porPrioridad.CRITICA.resueltos").value(0))
                .andExpect(jsonPath("$.porPrioridad.CRITICA.porcentaje").value(nullValue()))
                .andExpect(jsonPath("$.vigentesVencidos").value(0))
                .andExpect(jsonPath("$.vigentesEnRiesgo").value(0));

        mvc.perform(get("/api/reportes/tecnicos").header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].tecnico").value("ana"))
                .andExpect(jsonPath("$[0].vigentes").value(0))
                .andExpect(jsonPath("$[0].cumplimiento.resueltos").value(1))
                .andExpect(jsonPath("$[0].cumplimiento.dentroDelPlazo").value(1))
                .andExpect(jsonPath("$[0].cumplimiento.porcentaje").value(100.0))
                .andExpect(jsonPath("$[0].minutosPromedioResolucion").value(0));
    }
}
