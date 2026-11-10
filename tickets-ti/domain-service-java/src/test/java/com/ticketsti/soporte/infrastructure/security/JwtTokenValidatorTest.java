package com.ticketsti.soporte.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.ticketsti.soporte.testsupport.Datos;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class JwtTokenValidatorTest {

    private final Clock reloj = Datos.relojFijo();
    private SecretKey clave;
    private JwtTokenValidator validador;

    @BeforeEach
    void preparar() {
        clave = Jwts.SIG.HS384.key().build();   // HS384, igual que los tokens de AuthCore del grupo
        validador = new JwtTokenValidator(Encoders.BASE64.encode(clave.getEncoded()), reloj);
    }

    private String token(SecretKey firma, Duration vigencia) {
        Instant ahora = reloj.instant();
        return Jwts.builder().subject("admin").claim("uid", 1).claim("roles", List.of("USER", "ADMIN"))
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(vigencia)))
                .signWith(firma, Jwts.SIG.HS384).compact();
    }

    @Test
    @DisplayName("Acepta un token HS384 válido y extrae usuario, uid y roles")
    void tokenValido() {
        Optional<UsuarioAutenticado> usuario = validador.validar(token(clave, Duration.ofHours(1)));

        assertTrue(usuario.isPresent());
        assertEquals("admin", usuario.get().username());
        assertEquals(1L, usuario.get().uid().longValue());
        assertEquals(List.of("USER", "ADMIN"), usuario.get().roles());
    }

    @Test
    void rechazaTokenVencido() {
        assertTrue(validador.validar(token(clave, Duration.ofHours(-2))).isEmpty());
    }

    @Test
    void rechazaTokenFirmadoConOtraClave() {
        assertTrue(validador.validar(token(Jwts.SIG.HS384.key().build(), Duration.ofHours(1))).isEmpty());
    }

    @Test
    void rechazaTextoQueNoEsUnToken() {
        assertTrue(validador.validar("esto-no-es-un-jwt").isEmpty());
        assertTrue(validador.validar("").isEmpty());
    }

    @Test
    void rechazaTokenSinFirma() {
        String sinFirma = Jwts.builder().subject("admin").compact();
        assertTrue(validador.validar(sinFirma).isEmpty());
    }

    private String tokenReal(SecretKey firma, Map<String, Object> extra) {
        Instant ahora = reloj.instant();
        return Jwts.builder().claims(extra).subject("admin")
                .issuedAt(Date.from(ahora)).expiration(Date.from(ahora.plus(Duration.ofHours(1))))
                .signWith(firma, Jwts.SIG.HS256).compact();
    }

    private JwtTokenValidator validadorPara(SecretKey k) {
        return new JwtTokenValidator(Encoders.BASE64.encode(k.getEncoded()), reloj);
    }

    @Test
    @DisplayName("Token del AuthCore desplegado (HS256, role=ROLE_ADMIN, sin uid): rol ADMIN y uid nulo")
    void tokenRealDelAuthCore() {
        SecretKey k = Jwts.SIG.HS256.key().build();
        Optional<UsuarioAutenticado> usuario = validadorPara(k).validar(tokenReal(k, Map.of("role", "ROLE_ADMIN")));

        assertTrue(usuario.isPresent());
        assertEquals("admin", usuario.get().username());
        assertNull(usuario.get().uid());
        assertEquals(List.of("ADMIN"), usuario.get().roles());
    }

    @Test
    void roleYRolesNoSeDuplican() {
        SecretKey k = Jwts.SIG.HS256.key().build();
        Optional<UsuarioAutenticado> usuario = validadorPara(k).validar(
                tokenReal(k, Map.of("role", " role_admin ", "roles", List.of("ADMIN", "USER", " "))));

        assertEquals(List.of("ADMIN", "USER"), usuario.orElseThrow().roles());
    }

    @Test
    void roleQueNoEsTextoSeIgnora() {
        SecretKey k = Jwts.SIG.HS256.key().build();
        Optional<UsuarioAutenticado> usuario = validadorPara(k).validar(tokenReal(k, Map.of("role", 5)));

        assertTrue(usuario.isPresent());
        assertTrue(usuario.get().roles().isEmpty());
    }

    @Test
    void sinClaveConfiguradaNoArranca() {
        assertThrows(IllegalStateException.class, () -> new JwtTokenValidator("  ", reloj));
        assertThrows(IllegalStateException.class, () -> new JwtTokenValidator(null, reloj));
    }
}
