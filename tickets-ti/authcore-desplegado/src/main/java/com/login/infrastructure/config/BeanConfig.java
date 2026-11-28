package com.login.infrastructure.config;

import com.login.domain.port.input.LoginPort;
import com.login.domain.port.output.JwtGeneratorPort;
import com.login.domain.port.output.PasswordCheckerPort;
import com.login.domain.port.output.UserRepositoryPort;
import com.login.domain.usecase.LoginUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Composition Root — ensamblaje explícito del hexágono.
 *
 * Es el único lugar del sistema donde Spring y el dominio se tocan.
 * Aquí las implementaciones concretas de infraestructura se inyectan
 * como implementaciones de los puertos del dominio.
 *
 * ¿Por qué este archivo existe?
 *   LoginUseCase no tiene @Component ni @Service porque el dominio
 *   no depende de Spring. Spring no lo detecta por component scan.
 *   Este @Configuration lo instancia manualmente y lo registra
 *   como bean bajo la interfaz LoginPort.
 *
 * ¿Por qué @Configuration y no @Component?
 *   @Configuration tiene una característica especial: cuando un
 *   método @Bean llama a otro método @Bean dentro de la misma clase,
 *   Spring intercepta esa llamada y retorna el bean singleton ya
 *   existente en lugar de crear una nueva instancia.
 *   @Component no tiene esta garantía de proxy CGLIB.
 *   Para clases que definen múltiples @Bean relacionados,
 *   @Configuration es siempre la elección correcta.
 *
 * Flujo de inyección de dependencias que Spring resuelve aquí:
 *
 *   Spring ve que loginPort() necesita:
 *     UserRepositoryPort   → busca un @Component que lo implemente
 *                          → encuentra UserPersistenceAdapter ✓
 *     JwtGeneratorPort     → busca un @Component que lo implemente
 *                          → encuentra JwtAdapter ✓
 *     PasswordCheckerPort  → busca un @Component que lo implemente
 *                          → encuentra PasswordEncoderAdapter ✓
 *
 *   Spring inyecta los tres en este @Configuration vía constructor
 *   (@RequiredArgsConstructor), y luego los pasa al constructor
 *   de LoginUseCase.
 *
 * ¿Por qué @RequiredArgsConstructor (Lombok) está bien aquí?
 *   Porque estamos en infrastructure/config, no en el dominio.
 *   La regla es: el DOMINIO no depende de Lombok. La infraestructura
 *   puede usar Lombok libremente para reducir boilerplate técnico.
 */
@Configuration
@RequiredArgsConstructor
public class BeanConfig {

    /**
     * Spring inyecta UserPersistenceAdapter aquí porque:
     *   1. UserPersistenceAdapter tiene @Component.
     *   2. UserPersistenceAdapter implements UserRepositoryPort.
     *   3. Spring busca un bean de tipo UserRepositoryPort y lo encuentra.
     *
     * BeanConfig no sabe que es UserPersistenceAdapter específicamente.
     * Solo sabe que es un UserRepositoryPort. Si creas MockRepositoryPort
     * para tests con @Primary, Spring inyectará ese en su lugar.
     */
    private final UserRepositoryPort userRepositoryPort;

    /**
     * Spring inyecta JwtAdapter aquí porque:
     *   1. JwtAdapter tiene @Component.
     *   2. JwtAdapter implements JwtGeneratorPort.
     *   3. Spring busca un bean de tipo JwtGeneratorPort y lo encuentra.
     */
    private final JwtGeneratorPort jwtGeneratorPort;

    /**
     * Spring inyecta PasswordEncoderAdapter aquí porque:
     *   1. PasswordEncoderAdapter tiene @Component.
     *   2. PasswordEncoderAdapter implements PasswordCheckerPort.
     *   3. Spring busca un bean de tipo PasswordCheckerPort y lo encuentra.
     */
    private final PasswordCheckerPort passwordCheckerPort;

    /**
     * Registra LoginUseCase como bean bajo la interfaz LoginPort.
     *
     * ¿Por qué retornar LoginPort y no LoginUseCase?
     *   AuthController declara su dependencia como LoginPort (interfaz).
     *   Si retornaras LoginUseCase, Spring registraría el bean como
     *   LoginUseCase y también como LoginPort (porque lo implementa),
     *   pero la intención explícita queda más clara retornando LoginPort.
     *
     *   Más importante: si mañana creas OAuthLoginUseCase que también
     *   implementa LoginPort, solo cambias esta línea:
     *     return new OAuthLoginUseCase(...)
     *   AuthController no se toca. Sigue dependiendo de LoginPort.
     *
     * ¿Por qué new LoginUseCase(...) y no @Autowired en LoginUseCase?
     *   Porque LoginUseCase es dominio puro sin anotaciones de Spring.
     *   Al usar new, este archivo es el único lugar donde LoginUseCase
     *   se instancia. Eso es el Composition Root: un único punto
     *   de ensamblaje, explícito y documentado.
     *
     *   En un test unitario harías:
     *     LoginPort loginPort = new LoginUseCase(
     *         mockUserRepo,
     *         mockJwtGenerator,
     *         mockPasswordChecker
     *     );
     *   Sin Spring, sin contexto, sin anotaciones. Puro Java.
     *
     * ¿Por qué los tres puertos se pasan por constructor y no por setter?
     *   Constructor injection (inyección por constructor) es la forma
     *   recomendada porque:
     *   1. Las dependencias son inmutables (final en LoginUseCase).
     *   2. LoginUseCase no puede existir en estado inválido:
     *      si algún puerto es null, falla en construcción, no en uso.
     *   3. Hace las dependencias explícitas y visibles.
     *   4. Facilita los tests: el constructor documenta exactamente
     *      qué necesitas mockear para probar LoginUseCase.
     */
    @Bean
    public LoginPort loginPort() {
        return new LoginUseCase(
                userRepositoryPort,
                jwtGeneratorPort,
                passwordCheckerPort
        );
    }

}
