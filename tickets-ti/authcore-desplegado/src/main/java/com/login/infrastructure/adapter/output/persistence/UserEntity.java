package com.login.infrastructure.adapter.output.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entidad JPA que mapea la tabla "users" en MySQL.
 /*
 * ¿Por qué está en infrastructure/adapter/output/persistence?
 *   Porque es un detalle técnico de persistencia. La entidad JPA
 *   es la representación que Hibernate necesita para hacer el
 *   mapeo objeto-relacional. Ese es un problema de infraestructura,
 *   no de negocio.
 /*
 * ¿Por qué no está en domain/model como el User?
 *   Porque tiene anotaciones de jakarta.persistence que el dominio
 *   no puede tener. Si agregaras @Entity a User, el dominio
 *   dependería de JPA. Si cambias de JPA a JDBC o a MongoDB,
 *   tendrías que modificar el modelo de dominio. Eso viola el
 *   principio de que el dominio es independiente de la infraestructura.
 *
 * @Entity: Hibernate registra esta clase como una tabla gestionada.
 *   Sin esta anotación, Hibernate ignora la clase completamente.
 *
 * @Table(name = "users"): define el nombre exacto de la tabla en MySQL.
 *   Sin esta anotación, Hibernate usaría el nombre de la clase
 *   por convención: "user_entity". Definirlo explícitamente evita
 *   sorpresas si refactorizas el nombre de la clase.
 *
 * @Getter: Lombok genera getters para todos los campos.
 *   Hibernate y Jackson los usan para leer los valores.
 *
 * @Setter: Lombok genera setters para todos los campos.
 *   Hibernate los necesita para reconstruir el objeto después
 *   de una consulta. JPA requiere que los campos sean mutables.
 *   Esta es la razón por la que User del dominio NO puede ser
 *   la misma clase que UserEntity: User es inmutable (final),
 *   UserEntity debe ser mutable (con setters).
 *
 * @NoArgsConstructor: constructor sin argumentos requerido por JPA.
 *   Hibernate usa reflexión para instanciar la entidad y luego
 *   llama a los setters para poblar los campos. Sin este constructor,
 *   Hibernate lanza InstantiationException en tiempo de ejecución.
 *
 * @AllArgsConstructor: constructor con todos los campos.
 *   Útil en UserDomainMapper.toEntity() y en tests para crear
 *   instancias completas en una línea.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserEntity {

    /**
     * @Id: marca este campo como clave primaria de la tabla.
     *   Sin esta anotación, Hibernate no sabe cuál es el PK
     *   y lanza una excepción al iniciar el contexto.
     *
     * @GeneratedValue(strategy = GenerationType.IDENTITY):
     *   Delega la generación del ID al mecanismo AUTO_INCREMENT
     *   de MySQL. Es la estrategia más eficiente para MySQL porque:
     *   - No requiere una tabla de secuencias adicional (SEQUENCE)
     *   - No hace una consulta extra para obtener el siguiente ID (TABLE)
     *   - MySQL asigna el ID en el INSERT y Hibernate lo recupera
     *     con LAST_INSERT_ID() automáticamente.
     *
     *   Alternativa GenerationType.SEQUENCE: más eficiente en
     *   bases de datos que soportan secuencias nativas (PostgreSQL,
     *   Oracle). Para MySQL, IDENTITY es la elección correcta.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * @Column(unique = true, nullable = false, length = 50):
     *   unique = true: restricción UNIQUE en la BD. Garantiza que
     *     no puedan existir dos usuarios con el mismo username,
     *     incluso si se insertan datos directamente en MySQL sin
     *     pasar por la aplicación.
     *   nullable = false: restricción NOT NULL en la BD. El username
     *     no puede ser null a nivel de base de datos.
     *   length = 50: VARCHAR(50) en MySQL. Sin esto Hibernate
     *     usaría VARCHAR(255) por defecto, lo cual es innecesario
     *     para un nombre de usuario.
     *
     * Estas restricciones se aplican en dos niveles:
     *   1. Nivel de aplicación: Bean Validation en el controlador
     *      (@NotBlank en el DTO del controlador)
     *   2. Nivel de base de datos: estas anotaciones @Column
     *   Ambos niveles son necesarios: el nivel de aplicación
     *   da respuestas rápidas y amigables, el nivel de BD garantiza
     *   integridad aunque la aplicación falle.
     */
    @Column(unique = true, nullable = false, length = 50)
    private String username;

    /**
     * BCrypt siempre genera exactamente 60 caracteres.
     * length = 100 da margen para futuros algoritmos de hashing
     * que puedan generar hashes más largos (Argon2 puede generar
     * hashes de longitud variable). Cambiar el algoritmo no
     * requeriría alterar el esquema de la BD.
     */
    @Column(nullable = false, length = 100)
    private String password;

    /**
     * Formato: "ROLE_ADMIN", "ROLE_STUDENT", "ROLE_TEACHER".
     * El prefijo ROLE_ es una convención de Spring Security.
     * length = 30 es suficiente para los roles del sistema electoral.
     */
    @Column(nullable = false, length = 30)
    private String role;
}
