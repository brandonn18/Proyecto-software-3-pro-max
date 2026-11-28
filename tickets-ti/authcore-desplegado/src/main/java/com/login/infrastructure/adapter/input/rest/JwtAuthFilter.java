package com.login.infrastructure.adapter.input.rest;

import com.login.infrastructure.adapter.output.security.JwtAdapter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filtro JWT que intercepta cada request HTTP antes del controlador.
 *
 * Es un adaptador IN de seguridad: procesa requests entrantes para
 * establecer el contexto de autenticación de Spring Security.
 *
 * OncePerRequestFilter: garantiza ejecución exactamente una vez
 *   por request, incluso en forwards/includes internos de Spring MVC.
 *   Si un controlador hace un forward interno, el filtro no se
 *   ejecuta de nuevo para esa sub-request.
 *
 * @Component: Spring registra este filtro como bean.
 *   SecurityConfig lo inserta explícitamente en la cadena de filtros
 *   con .addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)
 *   Si no lo insertaras en SecurityConfig, Spring Boot lo registraría
 *   automáticamente en la cadena de filtros del servlet container,
 *   pero FUERA de la cadena de Spring Security, lo que causaría
 *   que SecurityContextHolder no fuera accesible correctamente.
 *   Por eso es importante el registro explícito en SecurityConfig.
 *
 * @RequiredArgsConstructor: inyecta JwtAdapter por constructor.
 *   Nótese que inyectamos JwtAdapter (clase concreta) y no
 *   JwtGeneratorPort (interfaz del dominio). ¿Por qué?
 *   Porque necesitamos extractUsername() e isTokenValid(), que
 *   son contratos de infraestructura entre componentes de seguridad,
 *   no contratos del dominio. JwtGeneratorPort solo expone
 *   generateToken(), que es lo que el dominio necesita.
 *
 * Posición en la cadena de filtros de Spring Security:
 *   1. SecurityContextPersistenceFilter
 *   2. JwtAuthFilter                    ← este filtro
 *   3. UsernamePasswordAuthenticationFilter
 *   4. ExceptionTranslationFilter
 *   5. FilterSecurityInterceptor
 *   Al estar antes de UsernamePasswordAuthenticationFilter,
 *   si el JWT es válido, Spring Security no intenta autenticar
 *   por formulario ni Basic Auth.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    /**
     * JwtAdapter concreto, no JwtGeneratorPort.
     * Necesitamos extractUsername() e isTokenValid() que no
     * están en el puerto del dominio porque el dominio no los necesita.
     * Son contratos entre componentes de infraestructura.
     */
    private final JwtAdapter jwtAdapter;

    /**
     * Método principal del filtro. Se ejecuta en cada request HTTP.
     *
     * @NonNull: documenta que estos parámetros nunca serán null.
     *   Spring garantiza esto, pero la anotación hace explícita
     *   esa garantía y evita advertencias del IDE.
     *
     * throws ServletException, IOException: requeridos por la firma
     *   del método de la clase padre. Son excepciones de servlet
     *   container que Spring maneja automáticamente.
     */
    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // ── PASO 1: Extraer el header Authorization ──────────────────────
        //
        // Todos los requests protegidos deben incluir:
        //   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
        //
        // Si no hay header o no empieza con "Bearer ", este request
        // no tiene token JWT. Pasamos al siguiente filtro sin autenticar.
        // Spring Security decidirá si el endpoint requiere autenticación:
        //   - Si es /api/auth/login (permitAll) → continúa normalmente.
        //   - Si es cualquier otro endpoint → retorna HTTP 403 Forbidden.
        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // ── PASO 2: Extraer el token del header ───────────────────────────
        //
        // "Bearer " tiene exactamente 7 caracteres (incluido el espacio).
        // substring(7) extrae todo desde el índice 7 hasta el final.
        // "Bearer eyJhbGci..." → "eyJhbGci..."
        final String jwt = authHeader.substring(7);
        final String username;

        try {
            // JwtAdapter.extractUsername() parsea el token y extrae
            // el claim "sub" (subject) que contiene el username.
            // Si el token está malformado → MalformedJwtException
            // Si la firma es inválida → SignatureException
            // Si el token expiró → ExpiredJwtException
            // Todas extienden JwtException, capturadas por el catch.
            username = jwtAdapter.extractUsername(jwt);

        } catch (Exception e) {
            // Token inválido por cualquier razón.
            // No lanzamos excepción: simplemente pasamos sin autenticar.
            // Spring Security manejará el acceso no autenticado según
            // la configuración de SecurityConfig.
            // No logueamos el error para evitar llenar los logs con
            // intentos maliciosos de tokens inválidos.
            filterChain.doFilter(request, response);
            return;
        }

        // ── PASO 3: Verificar que no haya autenticación previa ────────────
        //
        // getAuthentication() == null significa que este request
        // aún no ha sido autenticado en este ciclo de filtros.
        //
        // ¿Por qué esta verificación?
        // En tests con @WithMockUser, Spring ya establece una autenticación
        // en el contexto. Sin esta verificación, el filtro sobreescribiría
        // esa autenticación de test con la del token JWT.
        // También previene trabajo innecesario si otro filtro anterior
        // ya autenticó al usuario por otro mecanismo.
        if (username != null &&
                SecurityContextHolder.getContext().getAuthentication() == null) {

            // ── PASO 4: Validar el token ──────────────────────────────────
            //
            // isTokenValid() verifica dos condiciones:
            //   1. El username en el token coincide con el extraído.
            //      (previene manipulación del token)
            //   2. El token no está expirado.
            //      (el claim "exp" no ha pasado)
            if (jwtAdapter.isTokenValid(jwt, username)) {

                // ── PASO 5: Construir el objeto de autenticación ──────────
                //
                // UsernamePasswordAuthenticationToken es el objeto que
                // Spring Security usa para representar una autenticación.
                // Constructor con tres parámetros = autenticación exitosa:
                //   principal:   username (String, identificador del usuario)
                //   credentials: null (no necesitamos la contraseña aquí,
                //                ya la validamos al generar el token)
                //   authorities: lista de roles/permisos del usuario
                //
                // SimpleGrantedAuthority wrappea el rol en el formato
                // que Spring Security entiende para @PreAuthorize,
                // hasRole(), hasAuthority(), etc.
                //
                // En este ejemplo usamos "ROLE_USER" fijo.
                // En un sistema completo extraerías el rol del claim
                // "role" del token JWT para no consultar la BD:
                //   String role = jwtAdapter.extractRole(jwt);
                //   List.of(new SimpleGrantedAuthority(role))
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                username,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_USER"))
                        );

                // WebAuthenticationDetailsSource construye un objeto
                // con detalles adicionales del request: IP del cliente,
                // session ID, etc. Útil para auditoría y logging.
                authToken.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(request)
                );

                // ── PASO 6: Registrar la autenticación ────────────────────
                //
                // SecurityContextHolder es el almacén thread-local de
                // Spring Security. Al hacer setAuthentication() aquí,
                // cualquier componente del sistema que se ejecute en
                // este mismo thread (este request) puede llamar a:
                //   SecurityContextHolder.getContext().getAuthentication()
                // y obtendrá este authToken con el username y el rol.
                //
                // Thread-local significa que la autenticación solo existe
                // para este request específico. El siguiente request
                // empieza con un SecurityContextHolder limpio y debe
                // pasar por este filtro de nuevo. Eso es STATELESS.
                SecurityContextHolder.getContext()
                        .setAuthentication(authToken);
            }
        }

        // ── PASO 7: Continuar la cadena de filtros ────────────────────────
        //
        // filterChain.doFilter() pasa el request al siguiente filtro
        // o al controlador si este es el último filtro.
        // SIEMPRE debe llamarse (autenticado o no) para que el request
        // continúe su camino. Sin esta llamada, el request quedaría
        // colgado y el cliente nunca recibiría respuesta.
        filterChain.doFilter(request, response);
    }
}
