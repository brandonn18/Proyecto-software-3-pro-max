package com.ticketsti.soporte.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Clock;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import javax.crypto.SecretKey;

/**
 * Valida LOCALMENTE los tokens de AuthCore con la clave compartida (no llama a AuthCore en cada petición).
 * Acepta HS256/HS384/HS512: el token del grupo viene firmado con HS384, y exige que la clave tenga la longitud
 * mínima del algoritmo. Un token sin firma ("alg":"none") o con otra clave se rechaza.
 * Responsabilidad única: validar y extraer datos. No toca Spring Security (eso es del filtro).
 */
public class JwtTokenValidator {

    private final SecretKey clave;
    private final Clock reloj;

    public JwtTokenValidator(String secretBase64, Clock reloj) {
        if (secretBase64 == null || secretBase64.isBlank()) {
            throw new IllegalStateException("Falta JWT_SECRET_BASE64: la clave compartida con AuthCore es obligatoria");
        }
        this.clave = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64.trim()));
        this.reloj = reloj;
    }

    public Optional<UsuarioAutenticado> validar(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(clave)
                    .clock(() -> Date.from(reloj.instant()))
                    .clockSkewSeconds(30)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String usuario = claims.getSubject();
            if (usuario == null || usuario.isBlank()) {
                return Optional.empty();
            }
            Object uid = claims.get("uid");
            Long idUsuario = uid instanceof Number n ? n.longValue() : null;
            return Optional.of(new UsuarioAutenticado(usuario, idUsuario, leerRoles(claims)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();   // expirado, mal formado, firma inválida, etc.
        }
    }

    private List<String> leerRoles(Claims claims) {
        Object crudo = claims.get("roles");
        if (crudo instanceof List<?> lista) {
            return lista.stream().filter(String.class::isInstance).map(String.class::cast).toList();
        }
        return List.of();
    }
}
