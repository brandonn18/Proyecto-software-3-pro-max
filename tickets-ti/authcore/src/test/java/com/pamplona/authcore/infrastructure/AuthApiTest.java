package com.pamplona.authcore.infrastructure;

import com.jayway.jsonpath.JsonPath;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato HTTP que consumen el frontend y domain-service, sobre H2 en memoria.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthApiTest {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;

    @Autowired
    private MockMvc mvc;

    @Value("${authcore.jwt.secret}")
    private String jwtSecret;

    @Value("${authcore.internal-key}")
    private String internalKey;

    @Value("${authcore.admin.password}")
    private String adminPassword;

    private static String unico(String base) {
        return base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private Long registrar(String username, String email) throws Exception {
        String body = "{\"username\":\"%s\",\"password\":\"secreta1\",\"email\":%s}"
                .formatted(username, email == null ? "null" : "\"" + email + "\"");
        String respuesta = mvc.perform(post("/api/auth/register").contentType(JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private String login(String username, String password) throws Exception {
        String body = "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password);
        String respuesta = mvc.perform(post("/api/auth/login").contentType(JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(respuesta, "$.token");
    }

    private Claims leerClaims(String token) {
        return Jwts.parser().verifyWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(token).getPayload();
    }

    @Test
    @DisplayName("debería emitir un JWT con sub, uid y roles que domain-service sabe validar")
    void loginEmiteClaims() throws Exception {
        String username = unico("ana");
        Long id = registrar(username, null);

        Claims claims = leerClaims(login(username, "secreta1"));

        assertThat(claims.getSubject()).isEqualTo(username);
        assertThat(((Number) claims.get("uid")).longValue()).isEqualTo(id);
        assertThat(claims.get("roles", List.class)).containsExactly("USER");
        assertThat(claims.getExpiration()).isNotNull();
    }

    @Test
    @DisplayName("debería responder 401 con credenciales inválidas y 409 con username repetido")
    void erroresDeAutenticacion() throws Exception {
        String username = unico("beto");
        registrar(username, null);

        mvc.perform(post("/api/auth/login").contentType(JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"mala\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").exists());
        mvc.perform(post("/api/auth/register").contentType(JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"secreta1\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("debería validar password mínima y email")
    void validaciones() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(JSON)
                        .content("{\"username\":\"x\",\"password\":\"123\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(JSON)
                        .content("{\"username\":\"x\",\"password\":\"secreta1\",\"email\":\"no-es-email\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("debería crear el admin inicial y permitirle asignar TECNICO")
    void adminAsignaRol() throws Exception {
        String tokenAdmin = login("admin", adminPassword);
        Long id = registrar(unico("tec"), "tec@empresa.com");

        mvc.perform(post("/api/auth/users/" + id + "/roles").header("Authorization", "Bearer " + tokenAdmin)
                        .contentType(JSON).content("{\"role\":\"TECNICO\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/users").header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")].roles[*]").value(org.hamcrest.Matchers.hasItem("TECNICO")))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    @DisplayName("no debería permitir a un USER listar usuarios ni asignar roles")
    void userSinPermisos() throws Exception {
        String username = unico("luis");
        Long id = registrar(username, null);
        String token = login(username, "secreta1");

        mvc.perform(get("/api/auth/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/users/" + id + "/roles").header("Authorization", "Bearer " + token)
                        .contentType(JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("debería exigir X-Internal-Key en /internal")
    void internalExigeClave() throws Exception {
        mvc.perform(get("/internal/tecnicos")).andExpect(status().isUnauthorized());
        mvc.perform(get("/internal/tecnicos").header("X-Internal-Key", "otra-clave"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("debería exponer usuarios y técnicos a domain-service sin el hash")
    void internalDirectorio() throws Exception {
        String tokenAdmin = login("admin", adminPassword);
        String username = unico("tecnica");
        Long id = registrar(username, "tecnica@empresa.com");
        mvc.perform(post("/api/auth/users/" + id + "/roles").header("Authorization", "Bearer " + tokenAdmin)
                .contentType(JSON).content("{\"role\":\"TECNICO\"}")).andExpect(status().isNoContent());

        mvc.perform(get("/internal/users/" + id).header("X-Internal-Key", internalKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.email").value("tecnica@empresa.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(get("/internal/users/999999").header("X-Internal-Key", internalKey))
                .andExpect(status().isNotFound());
        mvc.perform(get("/internal/tecnicos").header("X-Internal-Key", internalKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].username").value(org.hamcrest.Matchers.hasItem(username)));
    }

    @Test
    @DisplayName("debería responder el health check sin autenticación")
    void health() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }
}
