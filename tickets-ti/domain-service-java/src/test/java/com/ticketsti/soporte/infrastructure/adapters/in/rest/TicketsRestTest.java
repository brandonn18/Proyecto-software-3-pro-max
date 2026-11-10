package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
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

/**
 * Prueba de punta a punta (HTTP -> casos de uso -> dominio -> H2) con seguridad JWT real.
 * El secreto se genera al arrancar la prueba (48 bytes aleatorios); nunca se escribe en el repositorio.
 * Cada prueba usa categorías y usuarios propios (por eso el contador), para no depender del orden de ejecución.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TicketsRestTest {

    private static final String SECRETO = Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded());

    @DynamicPropertySource
    static void secretoDePrueba(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> SECRETO);
    }

    private static final AtomicInteger SECUENCIA = new AtomicInteger(0);
    private static final String CODIGO = "TKT-\\d{4}-\\d{4}";

    @Autowired
    private MockMvc mvc;

    private String token(String usuario, String... roles) {
        Instant ahora = Instant.now();
        return Jwts.builder().subject(usuario).claim("uid", 99).claim("roles", List.of(roles))
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(Duration.ofHours(1))))
                .signWith(Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRETO)), Jwts.SIG.HS384).compact();
    }

    private String admin() { return token("admin", "ADMIN", "USER"); }

    private MockHttpServletRequestBuilder con(MockHttpServletRequestBuilder peticion, String token, String json) {
        MockHttpServletRequestBuilder b = peticion.header("Authorization", "Bearer " + token);
        return json == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private String unico(String base) { return base + SECUENCIA.incrementAndGet(); }

    private void registrarTecnico(String usuario, String... categorias) throws Exception {
        String cats = String.join("\",\"", categorias);
        mvc.perform(con(post("/api/tecnicos"), admin(), "{\"username\":\"" + usuario + "\",\"categorias\":[\"" + cats + "\"]}"))
                .andExpect(status().isCreated());
    }

    private String ticketJson(String categoria, String prioridad) {
        return "{\"titulo\":\"Impresora sin respuesta\",\"descripcion\":\"La impresora del segundo piso no imprime\","
                + "\"tipo\":\"incidente\",\"categoria\":\"" + categoria + "\",\"prioridad\":\"" + prioridad + "\"}";
    }

    /** Crea un ticket como {@code dueno} y devuelve su código. */
    private String crearTicket(String dueno, String categoria, String prioridad) throws Exception {
        String cuerpo = mvc.perform(con(post("/api/tickets"), token(dueno, "USER"), ticketJson(categoria, prioridad)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(cuerpo, "$.codigo");
    }

    private String estadoJson(String estado) { return "{\"estado\":\"" + estado + "\"}"; }

    @Test
    @DisplayName("Sin token o con token falso: 401")
    void sinCredencialesEs401() throws Exception {
        mvc.perform(get("/api/tickets")).andExpect(status().isUnauthorized());
        mvc.perform(con(get("/api/tickets"), "token.falso.aqui", null)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tecnicos")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Los técnicos los gestiona solo el ADMIN; lo que no es /api está denegado")
    void permisosDeTecnicos() throws Exception {
        String t = unico("tec");
        mvc.perform(con(post("/api/tecnicos"), token("maria", "USER"), "{\"username\":\"x\",\"categorias\":[\"redes\"]}")).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/tecnicos"), token("ana", "TECNICO"), "{\"username\":\"x\",\"categorias\":[\"redes\"]}")).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/tecnicos"), token("maria", "USER"), null)).andExpect(status().isForbidden());
        mvc.perform(con(get("/otra/cosa"), admin(), null)).andExpect(status().isForbidden());
        registrarTecnico(t, "redes");
        mvc.perform(con(get("/api/tecnicos"), admin(), null)).andExpect(status().isOk())
                .andExpect(jsonPath("$[*].username").value(hasItem(t)));
    }

    @Test
    @DisplayName("Registrar técnicos: faltantes 400, duplicado 409")
    void registroDeTecnicos() throws Exception {
        String t = unico("tec");
        mvc.perform(con(post("/api/tecnicos"), admin(), "{}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("usuario")))
                .andExpect(jsonPath("$.mensaje").value(containsString("categorías")));
        registrarTecnico(t, "redes", "software");
        mvc.perform(con(post("/api/tecnicos"), admin(), "{\"username\":\"" + t + "\",\"categorias\":[\"redes\"]}")).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("HU-8: se crea con código TKT-AAAA-NNNN y se asigna al técnico de la categoría")
    void creaYAsigna() throws Exception {
        String cat = unico("CAT"), tec = unico("tec");
        registrarTecnico(tec, cat);
        mvc.perform(con(post("/api/tickets"), token("maria", "USER"), ticketJson(cat.toLowerCase(), "alta")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codigo").value(matchesPattern(CODIGO)))
                .andExpect(jsonPath("$.estado").value("ASIGNADO"))
                .andExpect(jsonPath("$.tecnico").value(tec))
                .andExpect(jsonPath("$.creadoPor").value("maria"))
                .andExpect(jsonPath("$.prioridad").value("ALTA"))
                .andExpect(jsonPath("$.categoria").value(cat))
                .andExpect(jsonPath("$.historial.length()").value(2));
    }

    @Test
    @DisplayName("Sin técnicos en la categoría queda ABIERTO; con datos malos, 400")
    void sinTecnicosYValidaciones() throws Exception {
        String cat = unico("CAT");
        mvc.perform(con(post("/api/tickets"), token("maria", "USER"), ticketJson(cat, "baja")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.estado").value("ABIERTO"))
                .andExpect(jsonPath("$.tecnico").value(nullValue()));
        mvc.perform(con(post("/api/tickets"), token("maria", "USER"), "{}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("título")));
        mvc.perform(con(post("/api/tickets"), token("maria", "USER"),
                "{\"titulo\":\"Algo\",\"descripcion\":\"Descripción larga\",\"tipo\":\"queja\",\"categoria\":\"x1\",\"prioridad\":\"alta\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(con(post("/api/tickets"), token("maria", "USER"), "esto no es json")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("HU-9: el técnico asignado recorre el ciclo; otros reciben 403; lo ilegal, 409")
    void cambioDeEstado() throws Exception {
        String cat = unico("CAT"), tec = unico("tec");
        registrarTecnico(tec, cat);
        String codigo = crearTicket("maria", cat, "alta");
        String ana = token(tec, "TECNICO");

        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), token("otro", "TECNICO"), estadoJson("en_proceso")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value("Sin permiso para modificar este ticket"));
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), token("maria", "USER"), estadoJson("en_proceso"))).andExpect(status().isForbidden());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("resuelto"))).andExpect(status().isConflict());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("terminado"))).andExpect(status().isBadRequest());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("en_proceso"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_PROCESO"));
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, "{\"estado\":\"en_espera\",\"comentario\":\"Esperando repuesto\"}"))
                .andExpect(status().isOk());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("en_proceso"))).andExpect(status().isOk());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("resuelto"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("RESUELTO"))
                .andExpect(jsonPath("$.historial.length()").value(6));
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), admin(), estadoJson("cerrado"))).andExpect(status().isOk());
        mvc.perform(con(patch("/api/tickets/TKT-2026-9999/status"), admin(), estadoJson("cerrado"))).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("HU-10: el dueño reabre con motivo; sin motivo 400; otra persona 403; uno vigente 409")
    void reapertura() throws Exception {
        String cat = unico("CAT"), tec = unico("tec");
        registrarTecnico(tec, cat);
        String codigo = crearTicket("maria", cat, "critica");
        mvc.perform(con(post("/api/tickets/" + codigo + "/reopen"), token("maria", "USER"), "{\"motivo\":\"x\"}")).andExpect(status().isConflict());
        String ana = token(tec, "TECNICO");
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("en_proceso"))).andExpect(status().isOk());
        mvc.perform(con(patch("/api/tickets/" + codigo + "/status"), ana, estadoJson("resuelto"))).andExpect(status().isOk());

        mvc.perform(con(post("/api/tickets/" + codigo + "/reopen"), token("maria", "USER"), "{}")).andExpect(status().isBadRequest());
        mvc.perform(con(post("/api/tickets/" + codigo + "/reopen"), token("jose", "USER"), "{\"motivo\":\"x\"}")).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/tickets/" + codigo + "/reopen"), token("maria", "USER"), "{\"motivo\":\"El problema volvió\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ABIERTO"))
                .andExpect(jsonPath("$.tecnico").value(nullValue()))
                .andExpect(jsonPath("$.reaperturas").value(1));
    }

    @Test
    @DisplayName("HU-11: el ADMIN reasigna; técnico o usuario 403; técnico inexistente 404")
    void reasignacion() throws Exception {
        String cat = unico("CAT"), a = unico("tec"), b = unico("tec");
        registrarTecnico(a, cat);
        registrarTecnico(b, cat);
        String codigo = crearTicket("maria", cat, "media");      // lo toma el de menor nombre
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), token(a, "TECNICO"), "{\"tecnico\":\"" + b + "\"}")).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), token("maria", "USER"), "{\"tecnico\":\"" + b + "\"}")).andExpect(status().isForbidden());
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), admin(), "{\"tecnico\":\"fantasma\"}")).andExpect(status().isNotFound());
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), admin(), "{}")).andExpect(status().isBadRequest());
        String actual = JsonPath.read(mvc.perform(con(get("/api/tickets/" + codigo), admin(), null)).andReturn().getResponse().getContentAsString(), "$.tecnico");
        String otro = actual.equals(a) ? b : a;
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), admin(), "{\"tecnico\":\"" + actual + "\"}")).andExpect(status().isConflict());
        mvc.perform(con(post("/api/tickets/" + codigo + "/assign"), admin(), "{\"tecnico\":\"" + otro + "\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.tecnico").value(otro));
    }

    @Test
    @DisplayName("HU-12: cada rol ve lo suyo, con filtros; detalle ajeno 403, inexistente 404")
    void consultas() throws Exception {
        String cat = unico("CAT"), tec = unico("tec"), dueno1 = unico("user"), dueno2 = unico("user");
        registrarTecnico(tec, cat);
        String c1 = crearTicket(dueno1, cat, "alta");
        String c2 = crearTicket(dueno1, cat, "baja");
        String c3 = crearTicket(dueno2, cat, "alta");

        mvc.perform(con(get("/api/tickets"), token(dueno1, "USER"), null)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].codigo").value(c2));                // el más reciente primero
        mvc.perform(con(get("/api/tickets"), token(dueno2, "USER"), null)).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(con(get("/api/tickets"), token(tec, "TECNICO"), null)).andExpect(jsonPath("$.length()").value(3));
        mvc.perform(con(get("/api/tickets?prioridad=alta&categoria=" + cat.toLowerCase()), admin(), null))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].codigo").value(hasItem(c3)));
        mvc.perform(con(get("/api/tickets?estado=asignado&tipo=incidente&categoria=" + cat), token(dueno1, "USER"), null))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(con(get("/api/tickets?estado=cerrado&categoria=" + cat), admin(), null)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(con(get("/api/tickets?estado=terminado"), admin(), null)).andExpect(status().isBadRequest());

        mvc.perform(con(get("/api/tickets/" + c1), token(dueno1, "USER"), null)).andExpect(status().isOk())
                .andExpect(jsonPath("$.historial.length()").value(2));
        mvc.perform(con(get("/api/tickets/" + c1), token(tec, "TECNICO"), null)).andExpect(status().isOk());
        mvc.perform(con(get("/api/tickets/" + c1), token(dueno2, "USER"), null)).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/tickets/" + c1), token("otro", "TECNICO"), null)).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/tickets/TKT-2026-9999"), admin(), null)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("HU-12: un filtro desconocido responde 400 que lo nombra; los filtros válidos siguen dando 200")
    void filtroDesconocido() throws Exception {
        mvc.perform(con(get("/api/tickets?foo=bar"), admin(), null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(containsString("foo")));
        mvc.perform(con(get("/api/tickets?estado=abierto"), admin(), null)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Método no permitido responde 405 con el mismo formato de error")
    void metodoNoPermitido() throws Exception {
        mvc.perform(con(delete("/api/tecnicos"), admin(), null))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.mensaje").exists());
    }

    @Test
    @DisplayName("Tipo de contenido no soportado responde 415")
    void tipoNoSoportado() throws Exception {
        mvc.perform(post("/api/tickets").header("Authorization", "Bearer " + token("u415", "USER"))
                        .contentType(MediaType.TEXT_PLAIN).content("hola"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415));
    }

    @Test
    @DisplayName("Recurso inexistente dentro de una ruta autenticada responde 404, no 500")
    void rutaInexistente() throws Exception {
        mvc.perform(con(get("/api/tickets/TKT-2026-0001/inexistente"), admin(), null))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
