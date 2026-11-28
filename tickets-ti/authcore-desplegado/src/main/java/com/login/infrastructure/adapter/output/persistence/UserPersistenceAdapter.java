package com.login.infrastructure.adapter.output.persistence;

import com.login.application.mapper.UserDomainMapper;
import com.login.domain.model.User;
import com.login.domain.port.output.UserRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Adaptador OUT de persistencia. Implementa UserRepositoryPort con JPA.
 *
 * Patrón Adapter (GoF): adapta la interfaz de UserJpaRepository
 * (Spring Data, que el dominio no conoce) para cumplir el contrato
 * de UserRepositoryPort (que el dominio definió).
 *
 * @Component: Spring detecta esta clase en el component scan y la
 *   registra como bean. Cuando BeanConfig construye LoginUseCase
 *   y le pasa un UserRepositoryPort, Spring inyecta esta clase
 *   como la implementación concreta de ese puerto.
 *   El dominio recibe un UserRepositoryPort. No sabe que por
 *   debajo hay JPA, MySQL ni esta clase.
 *
 * @RequiredArgsConstructor (Lombok): genera el constructor con los
 *   dos campos final. Spring usa ese constructor para inyección
 *   por constructor, que es la forma más recomendada en Spring Boot 3.x
 *   porque hace las dependencias explícitas e inmutables.
 *   Lombok es válido aquí porque estamos en infraestructura.
 *
 * ¿Por qué inyectar UserJpaRepository y UserDomainMapper por separado?
 *   Single Responsibility: el adaptador orquesta la operación
 *   pero delega cada responsabilidad a quien corresponde:
 *     - UserJpaRepository: sabe hablar con MySQL
 *     - UserDomainMapper:  sabe convertir entre representaciones
 *   El adaptador solo sabe que necesita ambos para cumplir su trabajo.
 *
 * ¿Por qué no hacer el mapping directamente aquí sin el mapper?
 *   Podrías escribir:
 *     return userJpaRepository.findByUsername(username)
 *       .map(e -> new User(e.getId(), e.getUsername(), ...));
 *   Es más corto, pero tiene dos problemas:
 *   1. Si User agrega un campo, debes buscar todos los lugares
 *      donde se construye User manualmente y actualizarlos.
 *      Con el mapper centralizado, solo cambias un lugar.
 *   2. Viola Single Responsibility: el adaptador estaría
 *      haciendo persistencia Y mapping al mismo tiempo.
 */
@Component
@RequiredArgsConstructor
public class UserPersistenceAdapter implements UserRepositoryPort {

    /**
     * Repositorio Spring Data JPA.
     * Solo este adaptador lo conoce. El dominio nunca lo ve.
     * UserJpaRepository es un detalle de implementación
     * encapsulado dentro de este adaptador.
     */
    private final UserJpaRepository userJpaRepository;

    /**
     * Mapper que convierte UserEntity ↔ User.
     * BeanConfig lo registra como @Bean.
     * Spring lo inyecta aquí automáticamente.
     */
    private final UserDomainMapper userDomainMapper;

    /**
     * Implementación del puerto de dominio.
     *
     * Flujo detallado paso a paso:
     *
     * 1. userJpaRepository.findByUsername(username)
     *    Spring Data ejecuta:
     *    SELECT id, username, password, role
     *    FROM users WHERE username = ?
     *    Retorna Optional<UserEntity>
     *
     * 2. .map(userDomainMapper::toDomain)
     *    Si el Optional tiene valor:
     *      UserDomainMapper.toDomain(userEntity) se ejecuta
     *      Convierte UserEntity → User (modelo de dominio)
     *      Retorna Optional<User> con el User convertido
     *    Si el Optional está vacío:
     *      map() no ejecuta el mapper
     *      Retorna Optional.empty() directamente
     *      No hay NullPointerException posible
     *
     * 3. El Optional<User> sube hacia LoginUseCase que lo
     *    consume con .orElseThrow(() -> new AuthException(...))
     *
     * La operación .map() en Optional es funcional y segura:
     *   Optional.of(entity).map(fn)  → Optional.of(fn(entity))
     *   Optional.empty().map(fn)     → Optional.empty()  (fn no se llama)
     */
    @Override
    public Optional<User> findByUsername(String username) {
        return userJpaRepository.findByUsername(username)
                .map(userDomainMapper::toDomain);
    }
}
