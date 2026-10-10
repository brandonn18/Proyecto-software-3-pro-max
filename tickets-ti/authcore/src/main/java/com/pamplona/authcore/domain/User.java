package com.pamplona.authcore.domain;

import java.util.HashSet;
import java.util.Set;

/**
 * Entidad de dominio pura: no tiene NINGUNA anotacion de Spring, JPA ni de
 * ningun framework. Esto es intencional - es el nucleo hexagonal y debe
 * poder compilarse y probarse sin depender de infraestructura.
 *
 * email es opcional: domain-service lo usa para las notificaciones por correo.
 */
public class User {

    private Long id;
    private String username;
    private String email;
    private String passwordHash;
    private Set<Role> roles;

    public User(Long id, String username, String email, String passwordHash, Set<Role> roles) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.roles = roles != null ? new HashSet<>(roles) : new HashSet<>();
    }

    public User(Long id, String username, String passwordHash, Set<Role> roles) {
        this(id, username, null, passwordHash, roles);
    }

    public void addRole(Role role) {
        this.roles.add(role);
    }

    public boolean hasRole(Role role) {
        return this.roles.contains(role);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Set<Role> getRoles() {
        return new HashSet<>(roles);
    }
}
