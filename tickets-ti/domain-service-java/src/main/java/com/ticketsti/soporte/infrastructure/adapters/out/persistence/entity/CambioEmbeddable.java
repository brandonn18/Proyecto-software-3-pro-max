package com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;

@Embeddable
public class CambioEmbeddable {

    @Column(name = "estado_de", length = 12)
    private String de;

    @Column(name = "estado_a", nullable = false, length = 12)
    private String a;

    @Column(nullable = false, length = 60)
    private String por;

    @Column(nullable = false)
    private Instant cuando;

    @Column(nullable = false, length = 600)
    private String detalle;

    protected CambioEmbeddable() { }

    public CambioEmbeddable(String de, String a, String por, Instant cuando, String detalle) {
        this.de = de;
        this.a = a;
        this.por = por;
        this.cuando = cuando;
        this.detalle = detalle;
    }

    public String getDe() { return de; }
    public String getA() { return a; }
    public String getPor() { return por; }
    public Instant getCuando() { return cuando; }
    public String getDetalle() { return detalle; }
}
