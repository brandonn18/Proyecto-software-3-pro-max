package com.login.domain.port.output;

import com.login.domain.model.User;

import java.util.Optional;

/**
 * Puerto de salida (Driven Port) hacia persistencia de usuarios.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ java.util.Optional     (Java estándar)
 *   ✅ com.login.domain.model.User  (propio dominio)
 *   ❌ org.springframework.*
 *   ❌ jakarta.persistence.*
 *   ❌ lombok.*
 /*
 * ¿Por qué el dominio define esta interfaz y no la infraestructura?
 *   Porque el dominio sabe QUÉ necesita (buscar un usuario por username),
 *   pero no CÓMO obtenerlo. La interfaz expresa la necesidad del negocio
 *   en lenguaje del negocio, no en lenguaje técnico.
 /*
 *   Nótese que el método se llama findByUsername y no
 *   "SELECT * FROM users WHERE username = ?". El dominio habla
 *   de usuarios, no de tablas ni queries.
 /*
 * ¿Por qué Optional<User> y no User directamente?
 *   Retornar User directamente obligaría a lanzar una excepción
 *   cuando el usuario no existe, acoplando el dominio a un
 *   comportamiento de error específico de la capa de persistencia.
 *   Optional hace explícito en la firma del método que el usuario
 *   puede no existir, forzando al caso de uso a manejar ese
 *   escenario de forma consciente y controlada.
 /*
 * ¿Por qué no extiende JpaRepository?
 *   JpaRepository es parte de Spring Data (infraestructura).
 *   Si esta interfaz la extendiera, el dominio dependería de Spring.
 *   UserJpaRepository (infraestructura) extiende JpaRepository.
 *   UserPersistenceAdapter implementa ESTE puerto usando aquella.
 *   Son dos interfaces completamente separadas con propósitos distintos.
 */
public interface UserRepositoryPort {

    /**
     * Busca un usuario por su nombre de usuario.
     *
     * @param username nombre de usuario a buscar.
     * @return Optional con el User del dominio si existe,
     *         Optional.empty() si no se encuentra.
     */
    Optional<User> findByUsername(String username);
}
