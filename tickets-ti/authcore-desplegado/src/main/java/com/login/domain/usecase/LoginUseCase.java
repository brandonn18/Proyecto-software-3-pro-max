package com.login.domain.usecase;

import com.login.application.dto.LoginRequest;
import com.login.application.dto.LoginResponse;
import com.login.domain.exception.AuthException;
import com.login.domain.model.User;
import com.login.domain.port.input.LoginPort;
import com.login.domain.port.output.JwtGeneratorPort;
import com.login.domain.port.output.PasswordCheckerPort;
import com.login.domain.port.output.UserRepositoryPort;

/**
 * Caso de uso de login. Núcleo del hexágono para autenticación.
 /*
 * VERIFICACIÓN DE PUREZA — imports permitidos únicamente:
 *   ✅ com.login.application.dto.*       (DTOs sin lógica)
 *   ✅ com.login.domain.*                (propio dominio)
 *   ❌ org.springframework.*             PROHIBIDO
 *   ❌ lombok.*                          PROHIBIDO
 *   ❌ jakarta.*                         PROHIBIDO
 *   ❌ io.jsonwebtoken.*                 PROHIBIDO
 /*
 * ¿Por qué no tiene @Service ni @Component?
 *   Esas anotaciones son de Spring (infraestructura).
 *   El dominio no se acopla a ningún framework.
 *   BeanConfig (infrastructure/config) instancia esta clase
 *   manualmente y la registra como bean bajo la interfaz LoginPort.
 *   Spring inyecta el bean donde se necesite sin que LoginUseCase
 *   sepa que Spring existe.
 /*
 * ¿Por qué implementa LoginPort y no es solo una clase concreta?
 *   AuthController depende de LoginPort (interfaz), no de LoginUseCase.
 *   Si mañana creas OAuthLoginUseCase, cambias un solo @Bean en
 *   BeanConfig. El controlador no se toca. Eso es inversión
 *   de dependencias aplicada en su forma más práctica.
 /*
 * ¿Por qué el constructor es manual y no usa @RequiredArgsConstructor?
 *   Lombok (@RequiredArgsConstructor) es una dependencia externa.
 *   El dominio no depende de herramientas de generación de código.
 *   Un constructor de tres parámetros no es boilerplate que justifique
 *   esa dependencia en el núcleo del sistema.
 *   Adicionalmente, el constructor explícito documenta exactamente
 *   de qué depende este caso de uso: tres puertos, nada más.
 */
public class LoginUseCase implements LoginPort {

    private final UserRepositoryPort userRepositoryPort;
    private final JwtGeneratorPort jwtGeneratorPort;
    private final PasswordCheckerPort passwordCheckerPort;

    /**
     * BeanConfig llama a este constructor directamente:
     *   new LoginUseCase(userRepositoryPort, jwtGeneratorPort, passwordCheckerPort)
     /*
     * Las implementaciones concretas de los puertos (adaptadores de
     * infraestructura) son inyectadas por Spring en BeanConfig y
     * pasadas aquí. LoginUseCase nunca sabe que son adapters de JPA,
     * JJWT o BCrypt. Solo conoce las interfaces de sus puertos.
     */
    public LoginUseCase(
            UserRepositoryPort userRepositoryPort,
            JwtGeneratorPort jwtGeneratorPort,
            PasswordCheckerPort passwordCheckerPort) {
        this.userRepositoryPort = userRepositoryPort;
        this.jwtGeneratorPort = jwtGeneratorPort;
        this.passwordCheckerPort = passwordCheckerPort;
    }

    /**
     * Reglas de negocio del proceso de autenticación:
     /*
     * Regla 1 — El usuario debe existir en el sistema.
     *   Si no existe → AuthException("Credenciales inválidas").
     *   El mensaje es intencionalmente genérico para prevenir
     *   ataques de enumeración de usuarios (user enumeration attacks):
     *   un atacante no debe poder distinguir si el username existe
     *   o si fue la contraseña la que falló.
     /*
     * Regla 2 — La contraseña debe coincidir con el hash almacenado.
     *   passwordCheckerPort.matches() delega a BCrypt en infraestructura.
     *   El dominio no sabe qué algoritmo se usa. Solo recibe boolean.
     *   Si no coincide → AuthException("Credenciales inválidas").
     *   Mismo mensaje que la regla 1, misma razón de seguridad.
     /*
     * Regla 3 — Si ambas reglas se cumplen, el login es exitoso.
     *   jwtGeneratorPort.generateToken(user) delega a JJWT en infra.
     *   El dominio no sabe que HMAC-SHA256 ni Base64 existen.
     *   Solo recibe el String del token y lo incluye en la respuesta.
     /*
     * Nótese que las tres reglas están en un único método, secuenciales
     * y sin ramificaciones complejas. Eso es un caso de uso bien definido:
     * hace una sola cosa y la hace completamente.
     */
    @Override
    public LoginResponse login(LoginRequest request) {

        // Regla 1: el usuario debe existir.
        User user = userRepositoryPort
                .findByUsername(request.getUsername())
                .orElseThrow(() -> new AuthException("Credenciales inválidas"));

        // Regla 2: la contraseña debe coincidir con el hash.
        if (!passwordCheckerPort.matches(request.getPassword(), user.getPassword())) {
            throw new AuthException("Credenciales inválidas");
        }

        // Regla 3: credenciales válidas → generar token.
        String token = jwtGeneratorPort.generateToken(user);

        // LoginResponse se construye con constructor directo porque
        // application/dto tampoco usa Lombok ni @Builder.
        return new LoginResponse(token, user.getUsername(), user.getRole());
    }
}
