package com.login.infrastructure.adapter.output.security;

import com.login.domain.model.User;
import com.login.domain.port.output.JwtGeneratorPort;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Adaptador OUT de seguridad JWT.
 *
 * Único lugar del sistema que importa io.jsonwebtoken.*.
 * Si cambias de JJWT a Nimbus JOSE o Auth0 java-jwt,
 * solo modificas este archivo. El dominio y LoginUseCase
 * no se tocan porque dependen de JwtGeneratorPort, no de JJWT.
 *
 * Implementa JwtGeneratorPort (dominio) para la generación.
 * Expone métodos adicionales para JwtAuthFilter (infraestructura)
 * que no están en el puerto porque el dominio no los necesita.
 *
 * @Component: Spring registra este bean. BeanConfig lo inyecta
 *   en LoginUseCase como implementación de JwtGeneratorPort.
 *   JwtAuthFilter también lo inyecta directamente (no por puerto)
 *   para acceder a extractUsername() e isTokenValid().
 *
 * @Value("${jwt.secret}"): lee la clave secreta de application.properties.
 *   En producción esta propiedad se inyecta desde una variable de
 *   entorno o un vault de secretos, nunca hardcodeada en el código.
 *   El dominio nunca usa @Value porque no sabe que application.properties
 *   existe. Solo la infraestructura accede a configuración externa.
 *
 * Estructura de un token JWT:
 *   header.payload.signature
 *   │       │        │
 *   │       │        └── HMAC-SHA256(base64(header)+"."+base64(payload), secret)
 *   │       └── {"sub":"admin","role":"ROLE_ADMIN","iat":...,"exp":...}
 *   └── {"alg":"HS256","typ":"JWT"}
 *   Cada parte está codificada en Base64URL (no Base64 estándar).
 */
@Component
public class JwtAdapter implements JwtGeneratorPort {

    /**
     * Clave secreta HMAC-SHA256 en Base64.
     * Mínimo 256 bits (32 bytes → 44 caracteres en Base64).
     * JJWT lanza WeakKeyException si la clave es más corta.
     *
     * La clave en application.properties:
     *   jwt.secret=<CLAVE_BASE64>
     *
     * En producción: jwt.secret=${JWT_SECRET} (variable de entorno)
     */
    @Value("${jwt.secret}")
    private String secretKey;

    /**
     * Tiempo de vida del token en milisegundos.
     *   86400000 ms = 24 horas
     *   3600000  ms = 1 hora
     *
     * En producción usar tiempos cortos (15-60 min) y complementar
     * con refresh tokens para renovar sin re-login.
     */
    @Value("${jwt.expiration}")
    private long jwtExpiration;

    /**
     * Genera un token JWT firmado con HMAC-SHA256.
     *
     * Implementa JwtGeneratorPort: el dominio llama a este método
     * sin saber que JJWT, HMAC ni Base64 existen.
     *
     * Claims incluidos en el payload del token:
     *   sub  → user.getUsername(): identificador principal del usuario.
     *          Es el claim estándar JWT para el "subject" del token.
     *   role → user.getRole(): incluido para que JwtAuthFilter pueda
     *          reconstruir la autenticación de Spring Security en cada
     *          request sin hacer una consulta adicional a MySQL.
     *          Sin este claim, cada request necesitaría ir a la BD
     *          para obtener el rol del usuario.
     *   iat  → issued at: timestamp de emisión. Generado automáticamente
     *          por setIssuedAt(). Útil para auditoría.
     *   exp  → expiration: timestamp de vencimiento. JJWT rechaza
     *          automáticamente tokens expirados en parseClaimsJws().
     *
     * .compact(): serializa el token a su representación String final:
     *   "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiUk9MRV9BRE1JTiJ9.xxx"
     */
    @Override
    public String generateToken(User user) {
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("role", user.getRole());

        return Jwts.builder()
                .setClaims(extraClaims)
                .setSubject(user.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Extrae el username del claim "sub" (subject) del token.
     *
     * Usado por JwtAuthFilter en cada request entrante para
     * identificar al usuario sin consultar la base de datos.
     *
     * Si el token está malformado o la firma es inválida,
     * extractAllClaims() lanza JwtException que JwtAuthFilter
     * captura y trata como "request no autenticado".
     *
     * @param token token JWT en formato "header.payload.signature".
     * @return username extraído del claim "sub".
     */
    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    /**
     * Valida que el token sea correcto y corresponda al usuario esperado.
     *
     * Dos condiciones deben cumplirse simultáneamente:
     *   1. El username en el token coincide con el username esperado.
     *      Previene que un token de "juan" se use para autenticar "maria".
     *   2. El token no está expirado.
     *      JJWT compara exp con la fecha actual del servidor.
     *
     * Usado por JwtAuthFilter para decidir si establecer la
     * autenticación en el SecurityContextHolder.
     *
     * @param token    token JWT extraído del header Authorization.
     * @param username username esperado para este token.
     * @return true si el token es válido y corresponde al usuario.
     */
    public boolean isTokenValid(String token, String username) {
        final String tokenUsername = extractUsername(token);
        return tokenUsername.equals(username) && !isTokenExpired(token);
    }

    /**
     * Verifica si el token ya pasó su fecha de expiración.
     *
     * JJWT retorna la fecha de expiración del claim "exp".
     * Se compara con new Date() (fecha y hora actuales del servidor).
     *
     * @param token token JWT a verificar.
     * @return true si la fecha de expiración ya pasó.
     */
    private boolean isTokenExpired(String token) {
        return extractAllClaims(token)
                .getExpiration()
                .before(new Date());
    }

    /**
     * Parsea el token y retorna todos sus claims.
     *
     * Este método hace tres cosas simultáneamente:
     *   1. Decodifica Base64URL del header y payload.
     *   2. Verifica la firma HMAC-SHA256 con la clave secreta.
     *      Si la firma no coincide → SignatureException
     *   3. Verifica que el token no esté expirado.
     *      Si expiró → ExpiredJwtException
     *   4. Verifica que el formato sea válido.
     *      Si está malformado → MalformedJwtException
     *
     * Todas estas excepciones extienden JwtException.
     * JwtAuthFilter las captura con catch(Exception e) y
     * trata la request como no autenticada.
     *
     * @param token token JWT a parsear.
     * @return Claims con todos los datos del payload.
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * Construye la clave criptográfica HMAC desde el secreto Base64.
     *
     * Pasos:
     *   1. Base64.getDecoder().decode(secretKey):
     *      Convierte el String Base64 a array de bytes.
     *      "dGhpcy1pcy1h..." → byte[]{116, 104, 105, 115, ...}
     *
     *   2. Keys.hmacShaKeyFor(keyBytes):
     *      Crea un objeto SecretKey de javax.crypto.
     *      Verifica que la clave tenga mínimo 256 bits para HS256.
     *      Si tiene menos → WeakKeyException en tiempo de arranque.
     *
     * Este método se llama en cada operación de firma y verificación.
     * En producción podrías cachear la Key como campo privado final
     * para evitar decodificar Base64 en cada request.
     *
     * @return SecretKey lista para usar con HMAC-SHA256.
     */
    private Key getSigningKey() {
        byte[] keyBytes = Base64.getDecoder().decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
