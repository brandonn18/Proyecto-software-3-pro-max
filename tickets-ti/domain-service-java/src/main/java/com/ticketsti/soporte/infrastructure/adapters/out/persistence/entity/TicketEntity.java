package com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ticket",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_ticket_codigo", columnNames = "codigo"),
                // última defensa si dos tickets se crean a la vez y reciben el mismo consecutivo
                @UniqueConstraint(name = "uk_ticket_anio_consecutivo", columnNames = {"anio", "consecutivo"})},
        indexes = {
                @Index(name = "ix_ticket_tecnico_categoria", columnList = "tecnico, categoria, estado"),
                @Index(name = "ix_ticket_creado_por", columnList = "creado_por")})
public class TicketEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String codigo;

    @Column(nullable = false)
    private int anio;

    @Column(nullable = false)
    private long consecutivo;

    @Column(nullable = false, length = 120)
    private String titulo;

    @Column(nullable = false, length = 2000)
    private String descripcion;

    @Column(nullable = false, length = 12)
    private String tipo;

    @Column(nullable = false, length = 40)
    private String categoria;

    @Column(nullable = false, length = 10)
    private String prioridad;

    @Column(nullable = false, length = 12)
    private String estado;

    @Column(name = "creado_por", nullable = false, length = 60)
    private String creadoPor;

    @Column(length = 60)
    private String tecnico;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "vence_sla", nullable = false)
    private Instant venceSla;

    @Column(nullable = false)
    private int reaperturas;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "ticket_historial", joinColumns = @JoinColumn(name = "ticket_id"))
    @OrderColumn(name = "orden")
    private List<CambioEmbeddable> historial = new ArrayList<>();

    @Version
    private Long version;

    protected TicketEntity() { }

    public static TicketEntity nueva() { return new TicketEntity(); }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public int getAnio() { return anio; }
    public void setAnio(int anio) { this.anio = anio; }
    public long getConsecutivo() { return consecutivo; }
    public void setConsecutivo(long consecutivo) { this.consecutivo = consecutivo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }
    public String getPrioridad() { return prioridad; }
    public void setPrioridad(String prioridad) { this.prioridad = prioridad; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getCreadoPor() { return creadoPor; }
    public void setCreadoPor(String creadoPor) { this.creadoPor = creadoPor; }
    public String getTecnico() { return tecnico; }
    public void setTecnico(String tecnico) { this.tecnico = tecnico; }
    public Instant getCreadoEn() { return creadoEn; }
    public void setCreadoEn(Instant creadoEn) { this.creadoEn = creadoEn; }
    public Instant getVenceSla() { return venceSla; }
    public void setVenceSla(Instant venceSla) { this.venceSla = venceSla; }
    public int getReaperturas() { return reaperturas; }
    public void setReaperturas(int reaperturas) { this.reaperturas = reaperturas; }
    public List<CambioEmbeddable> getHistorial() { return historial; }
}
