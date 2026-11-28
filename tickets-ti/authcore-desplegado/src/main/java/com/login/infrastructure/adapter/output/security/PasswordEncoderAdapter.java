package com.login.infrastructure.adapter.output.security;

import com.login.domain.port.output.PasswordCheckerPort;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Adaptador OUT de seguridad para verificación de contraseñas.
 *
 * Implementa PasswordCheckerPort (dominio) usando BCrypt de Spring Security.
 *
 * ¿Por qué este adaptador existe si solo tiene una línea de lógica?
 *   Porque esa línea de lógica importa PasswordEncoder de Spring Security.
 *   Si esa línea estuviera en LoginUseCase, el dominio dependería de
 *   org.springframework.security. Este adaptador absorbe esa dependencia
 *   y la mantiene confinada en infraestructura donde pertenece.
 *
 *   La arquitectura hexagonal a veces produce clases muy pequeñas.
 *   Eso es correcto. Una clase pequeña con responsabilidad clara es
 *   mejor que una clase grande con responsabilidades mezcladas.
 *
 * @Component: Spring registra este bean como implementación de
 *   PasswordCheckerPort. BeanConfig lo inyecta en LoginUseCase.
 *   El dominio recibe un PasswordCheckerPort. No sabe que BCrypt existe.
 *
 * @RequiredArgsConstructor: genera el constructor con passwordEncoder final.
 *   Spring inyecta el BCryptPasswordEncoder definido en SecurityConfig.
 *   La inyección es por constructor, la forma más recomendada porque
 *   hace la dependencia inmutable y explícita.
 *
 * ¿Por qué inyectar PasswordEncoder (interfaz) y no BCryptPasswordEncoder?
 *   Principio de inversión de dependencias: depender de abstracciones,
 *   no de implementaciones concretas.
 *   Si SecurityConfig cambia de BCrypt a Argon2:
 *     @Bean PasswordEncoder → new Argon2PasswordEncoder(...)
 *   Este adaptador no necesita cambiar. Sigue recibiendo un PasswordEncoder
 *   sin importar cuál implementación concreta hay por debajo.
 *
 * ¿Dónde se define el @Bean PasswordEncoder que Spring inyecta aquí?
 *   En SecurityConfig:
 *     @Bean
 *     public PasswordEncoder passwordEncoder() {
 *         return new BCryptPasswordEncoder();
 *     }
 *   Spring resuelve automáticamente: "necesito un PasswordEncoder,
 *   tengo un @Bean que retorna BCryptPasswordEncoder que implementa
 *   PasswordEncoder, lo inyecto aquí."
 */
@Component
@RequiredArgsConstructor
public class PasswordEncoderAdapter implements PasswordCheckerPort {

    /**
     * Spring inyecta BCryptPasswordEncoder (definido en SecurityConfig).
     * Este adaptador no sabe que es BCrypt. Solo conoce la interfaz.
     */
    private final PasswordEncoder passwordEncoder;

    /**
     * Implementación del puerto del dominio.
     *
     * Delega completamente a PasswordEncoder de Spring Security.
     * No hay lógica adicional: la responsabilidad de este adaptador
     * es exclusivamente hacer de puente entre el puerto del dominio
     * y la implementación de Spring Security.
     *
     * PasswordEncoder.matches() internamente:
     *   1. Extrae el salt del hash BCrypt almacenado.
     *      El hash BCrypt tiene formato: $2a$10$<salt><hash>
     *      donde $2a$ es la versión, $10$ es el costo (2^10 iteraciones)
     *      y los siguientes 22 chars son el salt.
     *   2. Aplica BCrypt al rawPassword con ese mismo salt.
     *   3. Compara el resultado con el hash almacenado.
     *   4. Retorna true si coinciden, false si no.
     *
     * Esta operación toma ~100ms deliberadamente (costo 10).
     * Ese tiempo disuade ataques de fuerza bruta: probar
     * 1 millón de contraseñas tomaría ~28 horas.
     * Un login legítimo no nota 100ms adicionales.
     *
     * @param rawPassword     "password123" ingresado en el formulario.
     * @param encodedPassword "$2a$10$N9qo8uLOickgx2ZMRZoMye..." de la BD.
     * @return true si coinciden, false si no.
     */
    @Override
    public boolean matches(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }
}
