package com.login.infrastructure.config;

import com.login.infrastructure.adapter.input.rest.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Configuración central de Spring Security.
 *
 * Define tres aspectos fundamentales del sistema de seguridad:
 *   1. Qué endpoints son públicos y cuáles requieren autenticación.
 *   2. Cómo se gestiona el estado de sesión (STATELESS con JWT).
 *   3. Dónde se inserta JwtAuthFilter en la cadena de filtros.
 *
 * @Configuration: marca esta clase como fuente de definiciones de beans.
 *   Spring la procesa en tiempo de arranque y registra los @Bean que
 *   define: SecurityFilterChain y PasswordEncoder.
 *
 * @EnableWebSecurity: activa la integración de Spring Security con
 *   Spring MVC. Sin esta anotación, los filtros de seguridad no se
 *   registran en el servlet container y el sistema queda desprotegido.
 *   En Spring Boot 3.x esta anotación también deshabilita la
 *   configuración de seguridad automática de Spring Boot para que
 *   esta configuración personalizada tome el control completo.
 *
 * @RequiredArgsConstructor: inyecta JwtAuthFilter por constructor.
 *   JwtAuthFilter es @Component, Spring lo detecta y lo inyecta aquí.
 *   SecurityConfig necesita JwtAuthFilter para insertarlo en la cadena
 *   de filtros en el método securityFilterChain().
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    /**
     * JwtAuthFilter inyectado para insertarlo en la cadena de filtros.
     * Spring detecta el @Component y lo inyecta automáticamente.
     */
    private final JwtAuthFilter jwtAuthFilter;

    /**
     * Define la cadena de filtros de seguridad HTTP.
     *
     * SecurityFilterChain es el bean central de Spring Security 6.x.
     * Reemplaza WebSecurityConfigurerAdapter (eliminado en Spring Boot 3.x).
     *
     * El parámetro HttpSecurity http es inyectado por Spring Security.
     * Es el builder que permite configurar todos los aspectos de
     * seguridad HTTP de forma fluida (fluent API).
     *
     * @param http builder de configuración de seguridad HTTP.
     * @return SecurityFilterChain configurada y lista para usar.
     * @throws Exception si la configuración tiene errores (raro en práctica).
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {

        http
                // ── CSRF ────────────────────────────────────────────────────
                // Cross-Site Request Forgery: ataque donde un sitio malicioso
                // hace requests en nombre del usuario autenticado usando sus
                // cookies de sesión.
                //
                // ¿Por qué deshabilitarlo?
                // La protección CSRF solo tiene sentido cuando la autenticación
                // se basa en cookies de sesión (el navegador las envía
                // automáticamente con cada request al mismo dominio).
                // Con JWT, el token se envía en el header Authorization,
                // que los navegadores NO envían automáticamente. Por lo tanto,
                // un sitio malicioso no puede hacer requests con el token JWT
                // del usuario (no tiene acceso al header Authorization).
                // CSRF es innecesario y solo añade complejidad sin beneficio.
                .csrf(AbstractHttpConfigurer::disable)

                // ── GESTIÓN DE SESIÓN ────────────────────────────────────────
                // STATELESS: Spring Security no crea ni usa HttpSession.
                //
                // ¿Por qué STATELESS?
                // Con JWT, cada request es autocontenido: lleva su propia
                // autenticación en el token. No necesitamos que el servidor
                // recuerde quién está autenticado entre requests.
                //
                // Beneficios de STATELESS:
                //   1. Escalabilidad horizontal: cualquier instancia del
                //      servidor puede atender cualquier request sin compartir
                //      estado de sesión. No necesitas sesiones pegajosas
                //      (sticky sessions) en el balanceador de carga.
                //   2. Sin memoria de sesiones: el servidor no guarda
                //      datos de sesión en memoria o en Redis.
                //   3. Más simple: no hay que preocuparse por expiración
                //      de sesiones, invalidación, etc.
                //
                // Con STATELESS, si un usuario "cierra sesión", el token
                // JWT sigue siendo válido hasta que expire. Para invalidar
                // tokens antes de su expiración necesitarías una blacklist
                // de tokens en Redis o BD (implementación futura).
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // ── REGLAS DE AUTORIZACIÓN ───────────────────────────────────
                // Define qué endpoints requieren autenticación y cuáles son públicos.
                //
                // El orden de las reglas importa: Spring evalúa de arriba
                // hacia abajo y aplica la primera regla que coincide.
                // Por eso las reglas más específicas van primero.
                .authorizeHttpRequests(auth -> auth

                        // /api/auth/login es público: el usuario no tiene
                        // token aún, es exactamente aquí donde lo obtiene.
                        // permitAll() significa que cualquiera puede acceder
                        // sin autenticación ni autorización.
                        .requestMatchers("/api/auth/login").permitAll()

                        // Swagger UI: público para que los desarrolladores
                        // puedan explorar la API sin autenticarse.
                        // Estos paths son los que SpringDoc OpenAPI expone.
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**"
                        ).permitAll()

                        // Cualquier otro endpoint requiere autenticación.
                        // JwtAuthFilter habrá establecido la autenticación
                        // en SecurityContextHolder si el token es válido.
                        // Si no hay token válido, Spring retorna HTTP 403.
                        .anyRequest().authenticated()
                )

                // ── INSERCIÓN DE JWTAUTHFILTER ───────────────────────────────
                // Inserta JwtAuthFilter ANTES de UsernamePasswordAuthenticationFilter.
                //
                // ¿Por qué antes de UsernamePasswordAuthenticationFilter?
                // UsernamePasswordAuthenticationFilter es el filtro de Spring
                // Security que maneja autenticación por formulario (usuario/contraseña
                // en el body del request). Al insertar JwtAuthFilter antes:
                //   1. JwtAuthFilter procesa el token JWT primero.
                //   2. Si el token es válido, establece la autenticación.
                //   3. UsernamePasswordAuthenticationFilter ve que ya hay
                //      autenticación en el SecurityContextHolder y no intenta
                //      autenticar por formulario ni Basic Auth.
                //
                // Si JwtAuthFilter estuviera DESPUÉS, Spring intentaría
                // autenticar por formulario primero (y fallaría porque no
                // estamos enviando usuario/contraseña en el body del request
                // protegido, sino en el header Authorization).
                .addFilterBefore(
                        jwtAuthFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    /**
     * Define el encoder de contraseñas para todo el sistema.
     *
     * ¿Por qué como @Bean y no instanciado directamente?
     *   Al ser @Bean, Spring gestiona una única instancia (singleton)
     *   compartida por todos los componentes que la necesiten.
     *   PasswordEncoderAdapter la inyecta automáticamente porque
     *   Spring detecta que necesita un PasswordEncoder y este @Bean
     *   satisface esa dependencia.
     *
     * ¿Por qué BCrypt específicamente?
     *   BCrypt tiene tres propiedades que lo hacen ideal para contraseñas:
     *
     *   1. Salt incorporado: BCrypt genera un salt aleatorio único para
     *      cada contraseña. El salt se almacena dentro del hash:
     *      "$2a$10$<22chars_salt><31chars_hash>"
     *      Dos usuarios con la misma contraseña tendrán hashes diferentes.
     *      Esto hace imposibles los ataques de rainbow table.
     *
     *   2. Factor de coste adaptable: el número 10 en "$2a$10$" es el
     *      factor de coste (work factor). Significa 2^10 = 1024 iteraciones.
     *      Tarda ~100ms en hardware moderno. Conforme el hardware mejora,
     *      puedes aumentar el factor sin cambiar los hashes existentes.
     *
     *   3. Diseñado para contraseñas: a diferencia de SHA-256 o MD5
     *      (diseñados para ser rápidos), BCrypt está diseñado para ser
     *      lento deliberadamente. Lento para el servidor = mucho más
     *      lento para un atacante que intenta miles de contraseñas.
     *
     * ¿Por qué retornar PasswordEncoder (interfaz) y no BCryptPasswordEncoder?
     *   Principio de inversión de dependencias: los clientes de este bean
     *   (PasswordEncoderAdapter) dependen de la interfaz PasswordEncoder,
     *   no de la implementación BCryptPasswordEncoder. Si en el futuro
     *   cambias a Argon2PasswordEncoder, solo cambias esta línea.
     *   PasswordEncoderAdapter no necesita cambiar.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
