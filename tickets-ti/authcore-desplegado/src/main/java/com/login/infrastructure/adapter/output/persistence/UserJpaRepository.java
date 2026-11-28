package com.login.infrastructure.adapter.output.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repositorio Spring Data JPA para UserEntity.
 /*
 * ¿Por qué está en infrastructure y no en domain?
 *   JpaRepository es parte de org.springframework.data.jpa,
 *   que es un framework de infraestructura. Si estuviera en el
 *   dominio, el núcleo del hexágono dependería de Spring Data.
 *   El dominio nunca importa esta interfaz. Ni siquiera sabe
 *   que existe. Solo conoce UserRepositoryPort (su propio puerto).
 /*
 * ¿Por qué extiende JpaRepository<UserEntity, Long>?
 *   JpaRepository<T, ID> donde:
 *     T   = UserEntity: el tipo de entidad que gestiona
 *     ID  = Long: el tipo del campo anotado con @Id
 *   Al extender JpaRepository obtienes gratis:
 *     save(UserEntity)         → INSERT o UPDATE según si tiene ID
 *     findById(Long)           → SELECT WHERE id = ?
 *     findAll()                → SELECT * FROM users
 *     delete(UserEntity)       → DELETE WHERE id = ?
 *     count()                  → SELECT COUNT(*) FROM users
 *     existsById(Long)         → SELECT COUNT(*) WHERE id = ?
 *   Todo sin escribir una línea de SQL.
 /*
 * ¿Por qué no tiene @Repository?
 *   Spring Data detecta automáticamente las interfaces que
 *   extienden JpaRepository y las registra como beans sin
 *   necesitar @Repository explícito. La anotación es opcional
 *   y redundante en este contexto.
 *   Se omite para mantener el archivo limpio y porque no aporta
 *   funcionalidad adicional cuando ya extiende JpaRepository.
 /*
 * ¿Por qué retorna Optional<UserEntity> y no UserEntity?
 *   Porque el usuario puede no existir en la base de datos.
 *   Optional<UserEntity> hace ese hecho explícito en la firma
 *   del método. El llamador (UserPersistenceAdapter) está
 *   obligado a manejar el caso de ausencia.
 *   Si retornara UserEntity directamente, Spring Data lanzaría
 *   EmptyResultDataAccessException cuando no encuentra el usuario,
 *   acoplando el adaptador a una excepción específica de Spring Data.
 /*
 * ¿Cómo sabe Spring Data qué SQL generar para findByUsername?
 *   Query Derivation: Spring Data lee el nombre del método y
 *   construye la query automáticamente:
 *     "findBy"   → SELECT ... FROM users WHERE
 *     "Username" → campo username de UserEntity
 *   Resultado: SELECT * FROM users WHERE username = ?
 /*
 *   Reglas de Query Derivation:
 *     findBy[Campo]              → WHERE campo = ?
 *     findBy[Campo]And[Campo2]   → WHERE campo = ? AND campo2 = ?
 *     findBy[Campo]Containing    → WHERE campo LIKE %?%
 *     findBy[Campo]OrderBy[C2]   → WHERE campo = ? ORDER BY c2
 /*
 *   Para queries más complejas puedes usar @Query:
 *     @Query("SELECT u FROM UserEntity u WHERE u.username = :username
 *             AND u.role = :role")
 *     Optional<UserEntity> findByUsernameAndRole(
 *         @Param("username") String username,
 *         @Param("role") String role);
 /*
 * ¿Qué pasa si defines un método con un nombre incorrecto?
 *   Spring Data lanza PropertyReferenceException en tiempo de
 *   arranque (no en tiempo de ejecución) si el campo referenciado
 *   no existe en UserEntity. El error se detecta inmediatamente
 *   al iniciar la aplicación, no cuando un usuario hace una petición.
 */
public interface UserJpaRepository extends JpaRepository<UserEntity, Long> {

    /**
     * Busca un usuario por su nombre de usuario.
     /*
     * Spring Data traduce este método en tiempo de arranque a:
     *   SELECT u FROM UserEntity u WHERE u.username = :username
     /*
     * No se escribe JPQL ni SQL nativo.
     * No se escribe implementación.
     * Spring Data genera todo en tiempo de arranque.
     *
     * @param username nombre de usuario a buscar en la tabla users.
     * @return Optional con la UserEntity si existe en MySQL,
     *         Optional.empty() si no hay ningún usuario con ese username.
     */
    Optional<UserEntity> findByUsername(String username);
}
