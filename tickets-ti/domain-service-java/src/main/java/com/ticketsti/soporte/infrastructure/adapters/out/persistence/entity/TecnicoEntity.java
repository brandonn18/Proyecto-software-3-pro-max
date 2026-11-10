package com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "tecnico", uniqueConstraints = @UniqueConstraint(name = "uk_tecnico_username", columnNames = "username"))
public class TecnicoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String username;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tecnico_categoria", joinColumns = @JoinColumn(name = "tecnico_id"))
    @Column(name = "categoria", nullable = false, length = 40)
    private Set<String> categorias = new LinkedHashSet<>();

    @Version
    private Long version;

    protected TecnicoEntity() { }

    public static TecnicoEntity nueva() { return new TecnicoEntity(); }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Set<String> getCategorias() { return categorias; }
}
