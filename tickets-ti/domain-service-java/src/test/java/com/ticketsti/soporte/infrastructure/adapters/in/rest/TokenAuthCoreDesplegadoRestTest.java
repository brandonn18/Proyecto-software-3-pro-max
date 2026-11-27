package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

/**
 * Punta a punta con tokens en el formato del AuthCore desplegado: HS256, claim {@code role} (texto con prefijo
 * ROLE_), sin {@code uid} ni {@code roles}. El secreto (48 bytes) se genera al ejecutar; nunca va en el repositorio.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TokenAuthCoreDesplegadoRestTest {

    private static final String SECRETO = Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded());

    @DynamicPropertySource
    static void secretoDePrueba(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> SECRETO);
    }

    @Autowired
    private MockMvc mvc;

    private String tokenReal(String usuario, String role) {
        Instant ahora = Instant.now();
        return Jwts.builder().claim("role", role).subject(usuario)
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(Duration.ofHours(1))))
                .signWith(Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRETO)), Jwts.SIG.HS256).compact();
    }

    private MockHttpServletRequestBuilder con(MockHttpServletRequestBuilder peticion, String token, String json) {
        return peticion.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private String sufijo() { return UUID.randomUUID().toString().substring(0, 8); }

    @Test
    @DisplayName("role=ROLE_ADMIN registra técnicos (201); role=ROLE_USER recibe 403")
    void adminSiUserNo() throws Exception {
        String tec = "tec" + sufijo();
        String cuerpo = "{\"username\":\"" + tec + "\",\"categorias\":[\"redes\"]}";
        mvc.perform(con(post("/api/tecnicos"), tokenReal("admin", "ROLE_USER"), cuerpo)).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/tecnicos"), tokenReal("admin", "ROLE_ADMIN"), cuerpo)).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("role=ROLE_USER crea ticket y role=ROLE_TECNICO asignado lo pasa a en_proceso")
    void usuarioCreaYTecnicoAvanza() throws Exception {
        String s = sufijo(), cat = "CATREAL" + s, tec = "tec" + s;
        mvc.perform(con(post("/api/tecnicos"), tokenReal("admin", "ROLE_ADMIN"),
                "{\"username\":\"" + tec + "\",\"categorias\":[\"" + cat + "\"]}")).andExpect(status().isCreated());

        String creado = mvc.perform(con(post("/api/tickets"), tokenReal("maria" + s, "ROLE_USER"),
                "{\"titulo\":\"Impresora sin respuesta\",\"descripcion\":\"La impresora del segundo piso no imprime\","
                        + "\"tipo\":\"incidente\",\"categoria\":\"" + cat + "\",\"prioridad\":\"alta\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.tecnico").value(tec))
                .andReturn().getResponse().getContentAsString();
        String codigo = JsonPath.read(creado, "$.codigo");

        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), tokenReal(tec, "ROLE_TECNICO"),
                "{\"estado\":\"en_proceso\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("EN_PROCESO"));
    }
}
