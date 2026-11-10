package com.ticketsti.soporte.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    @Test
    void sinClaveConfiguradaNoArranca() {
        assertThrows(IllegalStateException.class, () -> new JwtTokenValidator("  ", reloj));
        assertThrows(IllegalStateException.class, () -> new JwtTokenValidator(null, reloj));
    }
}
