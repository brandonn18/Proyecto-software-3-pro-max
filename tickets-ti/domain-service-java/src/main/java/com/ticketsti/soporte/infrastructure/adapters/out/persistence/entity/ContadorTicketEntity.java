package com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** M-06: último consecutivo entregado en cada año. Es un detalle de la persistencia: el dominio no lo conoce. */
@Entity
@Table(name = "contador_ticket")
public class ContadorTicketEntity {

    @Id
    private int anio;

    @Column(nullable = false)
    private long ultimo;

    protected ContadorTicketEntity() { }

    public int getAnio() { return anio; }
    public long getUltimo() { return ultimo; }
    public void setUltimo(long ultimo) { this.ultimo = ultimo; }
}
