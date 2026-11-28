package com.login.domain.model;

/**
 * Modelo de dominio del Usuario.
 /*
 * Primera clase del proyecto porque es el núcleo del hexágono.
 * Ninguna otra clase del dominio puede existir sin saber qué es un User.
 /*
 * VERIFICACIÓN DE PUREZA — este archivo solo puede importar:
 *   ✅ java.*
 *   ✅ com.login.domain.*
 *   ❌ org.springframework.*
 *   ❌ jakarta.persistence.*
 *   ❌ lombok.*
 *   ❌ com.fasterxml.*
 */
public class User {

    private final Long id;
    private final String username;

    /**
     * Siempre almacenado como hash BCrypt.
     * El dominio nunca maneja contraseñas en texto plano.
     * La verificación del hash ocurre a través de PasswordCheckerPort.
     */
    private final String password;

    /**
     * Formato esperado: "ROLE_ADMIN", "ROLE_STUDENT".
     * El prefijo ROLE_ es requerido por Spring Security,
     * pero el dominio lo define así porque es una regla del negocio
     * cada usuario tiene exactamente un rol.
     */
    private final String role;

    public User(Long id, String username, String password, String role) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.role = role;
    }

    public Long getId()         { return id; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    public String getRole()     { return role; }
}
