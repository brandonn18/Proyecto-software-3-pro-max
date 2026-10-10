package com.pamplona.authcore.infrastructure.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final InternalKeyFilter internalKeyFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, InternalKeyFilter internalKeyFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.internalKeyFilter = internalKeyFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/health").permitAll()
                        // /internal/** no usa JWT: lo protege InternalKeyFilter
                        .requestMatchers("/internal/**").permitAll()
                        // Tomcat reenvia los errores (403, 404) a /error: si exigiera token,
                        // un 403 llegaria al cliente como 401 y el frontend cerraria la sesion
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated()
                )
                // Sin token o con token invalido -> 401 (el frontend vuelve al login)
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(internalKeyFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    // Los filtros son @Component: sin esto Spring Boot tambien los registraria
    // en el contenedor de servlets y se ejecutarian fuera de la cadena de seguridad.
    @Bean
    public FilterRegistrationBean<InternalKeyFilter> internalKeyFilterRegistration(InternalKeyFilter filter) {
        FilterRegistrationBean<InternalKeyFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
