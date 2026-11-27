package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.CrearTicketCommand;
import com.ticketsti.soporte.testsupport.Datos;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * M-05: contrato HTTP de la paginación de {@code GET /api/tickets}. Sin {@code page} ni {@code size} la respuesta es la
 * misma lista de antes; {@code X-Total-Count} va siempre. Cada prueba usa una categoría propia, así no depende de las demás.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TicketsPaginadosRestTest {

    private static final String SECRETO = Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded());

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> SECRETO);
        registro.add("spring.datasource.url", () -> "jdbc:h2:mem:paginacion-rest;MODE=MySQL;DB_CLOSE_DELAY=-1");
        registro.add("negocio.sla.intervalo-verificacion", () -> "P1D");
    }

    @Autowired private MockMvc mvc;
    @Autowired private TicketUseCase tickets;

    private static int secuencia = 0;
    private String categoria;
    private final List<String> creados = new ArrayList<>();

    private String bearer(String usuario, String... roles) {
        Instant ahora = Instant.now();
        return "Bearer " + Jwts.builder().subject(usuario).claim("roles", List.of(roles))
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(Duration.ofHours(1))))
                .signWith(Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRETO)), Jwts.SIG.HS384).compact();
    }

    private String admin() { return bearer("admin", "ADMIN", "USER"); }

    /** Cinco tickets de una categoría propia, creados en orden: el último es el más reciente. */
    @BeforeEach
    void cincoTickets() {
        categoria = "PAGINA" + (++secuencia);
        for (int i = 0; i < 5; i++) {
            creados.add(tickets.crear(Datos.usuario("maria"), new CrearTicketCommand("Impresora sin respuesta",
                    "La impresora del segundo piso no imprime", "incidente", categoria, "media")).getCodigo());
        }
    }

    @Test
    @DisplayName("Sin page ni size: la lista completa de siempre, con X-Total-Count")
    void sinPaginarComoAntes() throws Exception {
        mvc.perform(get("/api/tickets").param("categoria", categoria).header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "5"))
                .andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[0].codigo").value(creados.get(4)));
    }

    @Test
    @DisplayName("Con page y size: la página pedida, más recientes primero; fuera de rango, vacía con el total")
    void porPaginas() throws Exception {
        mvc.perform(get("/api/tickets").param("categoria", categoria).param("page", "0").param("size", "2")
                        .header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "5"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].codigo").value(creados.get(4)))
                .andExpect(jsonPath("$[1].codigo").value(creados.get(3)));

        mvc.perform(get("/api/tickets").param("categoria", categoria).param("page", "2").param("size", "2")
                        .header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].codigo").value(creados.get(0)));

        mvc.perform(get("/api/tickets").param("categoria", categoria).param("page", "7").param("size", "2")
                        .header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "5"))
                .andExpect(jsonPath("$.length()").value(0));

        // solo size: página 0
        mvc.perform(get("/api/tickets").param("categoria", categoria).param("size", "3").header("Authorization", admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @DisplayName("Valores inválidos: 400 con un mensaje que nombra el parámetro")
    void valoresInvalidos() throws Exception {
        mvc.perform(get("/api/tickets").param("size", "101").header("Authorization", admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("size")));
        mvc.perform(get("/api/tickets").param("size", "0").header("Authorization", admin()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/tickets").param("page", "-1").header("Authorization", admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("page")));
        mvc.perform(get("/api/tickets").param("page", "uno").header("Authorization", admin()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/tickets").param("pagina", "1").header("Authorization", admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("page")));
    }
}
