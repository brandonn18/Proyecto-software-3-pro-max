package com.ticketsti.soporte.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Clock;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import javax.crypto.SecretKey;

/**
 * Valida LOCALMENTE los tokens de AuthCore con la clave compartida (no llama a AuthCore en cada petición).
 * Acepta HS256/HS384/HS512 y exige que la clave tenga la longitud mínima del algoritmo. Reconoce dos formatos:
 * <ul>
 *   <li>Guía del curso (HS384): {@code {"sub":"x","uid":1,"roles":["ADMIN","USER"]}}.</li>
 *   <li>AuthCore del grupo desplegado (HS256): {@code {"sub":"admin","role":"ROLE_ADMIN"}}, sin {@code uid}.</li>
 * </ul>
 * Los roles se leen de {@code roles} (lista) y de {@code role} (texto), se unen sin duplicados y se normalizan:
 * sin espacios, sin prefijo {@code ROLE_} y en mayúsculas. {@code uid} es opcional. Un token sin firma ("alg":"none") o con otra clave se rechaza.
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
        Set<String> roles = new LinkedHashSet<>();
        if (claims.get("roles") instanceof List<?> lista) {
            lista.stream().filter(String.class::isInstance).map(String.class::cast).forEach(r -> agregar(roles, r));
        }
        if (claims.get("role") instanceof String unico) {
            agregar(roles, unico);
        }
        return List.copyOf(roles);
    }

    private static void agregar(Set<String> roles, String crudo) {
        String rol = crudo.trim();
        if (rol.regionMatches(true, 0, "ROLE_", 0, 5)) {
            rol = rol.substring(5);
        }
        rol = rol.trim().toUpperCase(Locale.ROOT);
        if (!rol.isEmpty()) {
            roles.add(rol);
        }
    }
}
