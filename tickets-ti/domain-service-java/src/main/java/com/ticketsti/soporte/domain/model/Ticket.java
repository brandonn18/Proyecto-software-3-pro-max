package com.ticketsti.soporte.domain.model;

import com.ticketsti.soporte.domain.exception.TicketEstadoInvalidoException;
import com.ticketsti.soporte.domain.exception.ValorInvalidoException;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Ticket de soporte. Entidad con comportamiento: solo cambia mediante sus métodos, y cada uno valida su regla.
 * Su identidad pública es el código TKT-AAAA-NNNN; el id numérico es un detalle de la base de datos.
 */
public class Ticket {

    /** Tope de comentarios y motivos que quedan en el historial. */
    public static final int LIMITE_TEXTO = 500;

    private static final Pattern CODIGO = Pattern.compile("TKT-\\d{4}-\\d{4,}");

    private final Long id;
    private final String codigo;
    private final String titulo;
    private final String descripcion;
    private final TipoTicket tipo;
    private final Categoria categoria;
    private final Prioridad prioridad;
    private final String creadoPor;
    private final Instant creadoEn;
    private EstadoTicket estado;
    private String tecnico;
    private Instant venceSla;
    private int reaperturas;
    private final List<CambioTicket> historial;

    private Ticket(Long id, String codigo, String titulo, String descripcion, TipoTicket tipo, Categoria categoria,
                   Prioridad prioridad, String creadoPor, Instant creadoEn, EstadoTicket estado, String tecnico,
                   Instant venceSla, int reaperturas, List<CambioTicket> historial) {
        this.id = id;
        this.codigo = codigo;
        this.titulo = titulo;
        this.descripcion = descripcion;
        this.tipo = tipo;
        this.categoria = categoria;
        this.prioridad = prioridad;
        this.creadoPor = creadoPor;
        this.creadoEn = creadoEn;
        this.estado = estado;
        this.tecnico = tecnico;
        this.venceSla = venceSla;
        this.reaperturas = reaperturas;
        this.historial = new ArrayList<>(historial);
    }

    /** Código con el formato del requisito: TKT-AAAA-NNNN. */
    public static String formatoCodigo(int anio, long consecutivo) {
        return String.format("TKT-%04d-%04d", anio, consecutivo);
    }

    public static Ticket crear(String codigo, String titulo, String descripcion, TipoTicket tipo, Categoria categoria,
                               Prioridad prioridad, String creadoPor, Instant ahora) {
        if (codigo == null || !CODIGO.matcher(codigo).matches()) {
            throw new ValorInvalidoException("El código del ticket debe tener el formato TKT-AAAA-NNNN");
        }
        if (titulo == null || titulo.trim().length() < 3 || titulo.trim().length() > 120) {
            throw new ValorInvalidoException("El título debe tener entre 3 y 120 caracteres");
        }
        if (descripcion == null || descripcion.trim().length() < 5 || descripcion.trim().length() > 2000) {
            throw new ValorInvalidoException("La descripción debe tener entre 5 y 2000 caracteres");
        }
        if (tipo == null || categoria == null || prioridad == null) {
            throw new ValorInvalidoException("Tipo, categoría y prioridad son obligatorios");
        }
        if (creadoPor == null || creadoPor.isBlank()) {
            throw new ValorInvalidoException("No se pudo identificar quién crea el ticket");
        }
        Ticket t = new Ticket(null, codigo, titulo.trim(), descripcion.trim(), tipo, categoria, prioridad, creadoPor,
                ahora, EstadoTicket.ABIERTO, null, prioridad.limiteDesde(ahora), 0, List.of());
        t.historial.add(new CambioTicket(null, EstadoTicket.ABIERTO, creadoPor, ahora, "Ticket creado"));
        return t;
    }

    public static Ticket reconstruir(Long id, String codigo, String titulo, String descripcion, TipoTicket tipo,
                                     Categoria categoria, Prioridad prioridad, String creadoPor, Instant creadoEn,
                                     EstadoTicket estado, String tecnico, Instant venceSla, int reaperturas,
                                     List<CambioTicket> historial) {
        return new Ticket(id, codigo, titulo, descripcion, tipo, categoria, prioridad, creadoPor, creadoEn, estado,
                tecnico, venceSla, reaperturas, historial);
    }

    /**
     * Asigna o reasigna el ticket. Un ticket ABIERTO pasa a ASIGNADO; uno en atención conserva su estado.
     * @param automatica true si la elige el sistema al crear el ticket
     */
    public void asignarA(String nuevoTecnico, String por, boolean automatica, Instant ahora) {
        if (nuevoTecnico == null || nuevoTecnico.isBlank()) {
            throw new ValorInvalidoException("El técnico es obligatorio");
        }
        if (!estado.estaVigente()) {
            throw new TicketEstadoInvalidoException("No se puede asignar un ticket " + estado + ": ya está terminado");
        }
        if (nuevoTecnico.equals(tecnico)) {
            throw new TicketEstadoInvalidoException("El ticket ya está asignado a " + nuevoTecnico);
        }
        EstadoTicket antes = estado;
        String detalle = automatica ? "Asignado automáticamente a " + nuevoTecnico
                : tecnico == null ? "Asignado a " + nuevoTecnico
                : "Reasignado de " + tecnico + " a " + nuevoTecnico;
        tecnico = nuevoTecnico;
        if (estado == EstadoTicket.ABIERTO) estado = EstadoTicket.ASIGNADO;
        historial.add(new CambioTicket(antes, estado, por, ahora, detalle));
    }

    public void cambiarEstado(EstadoTicket nuevo, String por, String comentario, Instant ahora) {
        if (nuevo == null) {
            throw new ValorInvalidoException("El estado es obligatorio");
        }
        if (!estado.puedePasarA(nuevo)) {
            throw new TicketEstadoInvalidoException("Transición no permitida: " + estado + " → " + nuevo);
        }
        if (comentario != null && comentario.trim().length() > LIMITE_TEXTO) {
            throw new ValorInvalidoException("El comentario no puede pasar de " + LIMITE_TEXTO + " caracteres");
        }
        EstadoTicket antes = estado;
        estado = nuevo;
        String detalle = comentario == null || comentario.isBlank() ? "Cambio de estado" : comentario.trim();
        historial.add(new CambioTicket(antes, nuevo, por, ahora, detalle));
    }

    /** Reabre un ticket resuelto o cerrado: vuelve a ABIERTO, sin técnico y con el SLA reiniciado. */
    public void reabrir(String motivo, String por, Instant ahora) {
        if (motivo == null || motivo.isBlank()) {
            throw new ValorInvalidoException("El motivo de la reapertura es obligatorio");
        }
        if (motivo.trim().length() > LIMITE_TEXTO) {
            throw new ValorInvalidoException("El motivo no puede pasar de " + LIMITE_TEXTO + " caracteres");
        }
        if (estado != EstadoTicket.RESUELTO && estado != EstadoTicket.CERRADO) {
            throw new TicketEstadoInvalidoException("Solo se reabren tickets resueltos o cerrados; este está " + estado);
        }
        EstadoTicket antes = estado;
        estado = EstadoTicket.ABIERTO;
        tecnico = null;
        venceSla = prioridad.limiteDesde(ahora);
        reaperturas++;
        historial.add(new CambioTicket(antes, estado, por, ahora, "Reabierto: " + motivo.trim()));
    }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public String getTitulo() { return titulo; }
    public String getDescripcion() { return descripcion; }
    public TipoTicket getTipo() { return tipo; }
    public Categoria getCategoria() { return categoria; }
    public Prioridad getPrioridad() { return prioridad; }
    public String getCreadoPor() { return creadoPor; }
    public Instant getCreadoEn() { return creadoEn; }
    public EstadoTicket getEstado() { return estado; }
    /** Nombre de usuario del técnico asignado, o null. */
    public String getTecnico() { return tecnico; }
    public Instant getVenceSla() { return venceSla; }
    public int getReaperturas() { return reaperturas; }
    public List<CambioTicket> getHistorial() { return Collections.unmodifiableList(historial); }
}
