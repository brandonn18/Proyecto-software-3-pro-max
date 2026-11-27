package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** La sonda de salud es pública; ninguna otra ruta lo es. El secreto se genera en ejecución. */
@SpringBootTest
@AutoConfigureMockMvc
class HealthRestTest {

    private static final String SECRETO = Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded());

    @DynamicPropertySource
    static void secretoDePrueba(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> SECRETO);
    }

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("GET /api/health responde 200 UP sin token")
    void saludSinToken() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Otras rutas siguen sin ser públicas")
    void otrasRutasNoSonPublicas() throws Exception {
        mvc.perform(get("/api/tickets")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tecnicos")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/health/otra")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/health")).andExpect(status().isUnauthorized());
    }
}
