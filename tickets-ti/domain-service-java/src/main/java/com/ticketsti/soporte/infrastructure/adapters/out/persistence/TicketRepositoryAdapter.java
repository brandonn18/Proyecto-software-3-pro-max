package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.query.Pagina;
import com.ticketsti.soporte.application.query.Paginacion;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.ContadorTicketEntity;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TicketEntity;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.mapper.TicketMapper;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository.ContadorTicketJpaRepository;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository.TicketJpaRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class TicketRepositoryAdapter implements TicketRepositoryPort {

    private static final List<String> ESTADOS_VIGENTES = EstadoTicket.vigentes().stream().map(Enum::name).toList();

    /** Fila fija de {@code contador_ticket} (creada por V3) que sirve de candado para crear el contador de un año nuevo. */
    static final int CANDADO_ANIO_NUEVO = 0;

    private final TicketJpaRepository jpa;
    private final ContadorTicketJpaRepository contadores;

    public TicketRepositoryAdapter(TicketJpaRepository jpa, ContadorTicketJpaRepository contadores) {
        this.jpa = jpa;
        this.contadores = contadores;
    }

    @Override
    public Ticket guardar(Ticket ticket) {
        TicketEntity entidad = ticket.getId() == null
                ? TicketEntity.nueva()
                : jpa.findById(ticket.getId()).orElseGet(TicketEntity::nueva);
        TicketMapper.copiarA(entidad, ticket);
        return TicketMapper.aDominio(jpa.saveAndFlush(entidad));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Ticket> buscarPorCodigo(String codigo) {
        return jpa.findByCodigo(codigo).map(TicketMapper::aDominio);
    }

    /**
     * M-06: reserva el siguiente consecutivo del año. Bloquea la fila del año en {@code contador_ticket}
     * (SELECT ... FOR UPDATE) hasta que termina la transacción que crea el ticket: las creaciones simultáneas del mismo
     * año esperan su turno en lugar de chocar, y si esa transacción se revierte el número no se consume.
     * Toma el mayor entre el contador y el máximo ya usado, así nunca repite un número aunque haya tickets que no pasaron
     * por el contador. Exige una transacción en curso: sin ella, el bloqueo no protegería nada.
     */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public long siguienteConsecutivo(int anio) {
        // Se mira primero sin bloquear: en MySQL, bloquear una fila que no existe toma un «gap lock» y varias
        // creaciones del primer ticket del año se trabarían entre sí al insertarla.
        Optional<ContadorTicketEntity> delAnio = contadores.existsById(anio) ? contadores.bloquear(anio) : Optional.empty();
        ContadorTicketEntity contador = delAnio.orElseGet(() -> crearContador(anio));
        long siguiente = Math.max(contador.getUltimo(), jpa.maxConsecutivo(anio)) + 1;
        contador.setUltimo(siguiente);       // se escribe con el ticket, en la misma transacción
        return siguiente;
    }

    /**
     * Primer ticket del año: con el candado tomado, nadie más crea contadores, así que el que llega primero inserta la
     * fila y los demás, al tomar el candado después, ya la encuentran. Todo en la misma transacción: no pide otra
     * conexión (con muchas creaciones a la vez, eso agotaba el pool) y los bloqueos siempre van en el mismo orden
     * (candado y después año), así que no se producen interbloqueos.
     */
    private ContadorTicketEntity crearContador(int anio) {
        contadores.bloquear(CANDADO_ANIO_NUEVO)
                .orElseThrow(() -> new IllegalStateException("Falta la fila candado de contador_ticket (migración V3)"));
        // Lectura con bloqueo: ve lo último confirmado, aunque otra creación la haya insertado recién.
        return contadores.bloquear(anio).orElseGet(() -> {
            contadores.insertar(anio, 0);
            return contadores.bloquear(anio)
                    .orElseThrow(() -> new IllegalStateException("No se pudo crear el contador del año " + anio));
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, CargaTecnico> cargaPorTecnico(Categoria categoria, Collection<String> usernames) {
        Map<String, CargaTecnico> carga = new HashMap<>();
        if (usernames.isEmpty()) return carga;
        for (Object[] fila : jpa.cargaVigente(categoria.nombre(), usernames, ESTADOS_VIGENTES, Prioridad.CRITICA.name())) {
            carga.put((String) fila[0], new CargaTecnico(((Number) fila[1]).longValue(), ((Number) fila[2]).longValue()));
        }
        return carga;
    }

    /** Más recientes primero; el id desempata, así el orden es estable entre páginas. */
    private static final Sort MAS_RECIENTES = Sort.by(Sort.Order.desc("creadoEn"), Sort.Order.desc("id"));

    @Override
    @Transactional(readOnly = true)
    public List<Ticket> buscar(FiltroTicket f) {
        return jpa.findAll(especificacion(f), MAS_RECIENTES).stream().map(TicketMapper::aDominio).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Pagina<Ticket> buscar(FiltroTicket f, Paginacion p) {
        Page<TicketEntity> pagina = jpa.findAll(especificacion(f), PageRequest.of(p.pagina(), p.tamano(), MAS_RECIENTES));
        return new Pagina<>(pagina.map(TicketMapper::aDominio).getContent(), pagina.getTotalElements());
    }

    private static Specification<TicketEntity> especificacion(FiltroTicket f) {
        return (root, query, cb) -> {
            List<Predicate> condiciones = new ArrayList<>();
            if (f.estado() != null) condiciones.add(cb.equal(root.get("estado"), f.estado().name()));
            if (f.prioridad() != null) condiciones.add(cb.equal(root.get("prioridad"), f.prioridad().name()));
            if (f.categoria() != null) condiciones.add(cb.equal(root.get("categoria"), f.categoria().nombre()));
            if (f.tipo() != null) condiciones.add(cb.equal(root.get("tipo"), f.tipo().name()));
            if (f.creadoPor() != null && f.asignadoA() != null) {
                condiciones.add(cb.or(cb.equal(root.get("creadoPor"), f.creadoPor()), cb.equal(root.get("tecnico"), f.asignadoA())));
            } else if (f.creadoPor() != null) {
                condiciones.add(cb.equal(root.get("creadoPor"), f.creadoPor()));
            } else if (f.asignadoA() != null) {
                condiciones.add(cb.equal(root.get("tecnico"), f.asignadoA()));
            }
            return cb.and(condiciones.toArray(new Predicate[0]));
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ticket> buscarVigentesSinSlaVencido() {
        return jpa.vigentesSinSlaVencido(ESTADOS_VIGENTES).stream().map(TicketMapper::aDominio).toList();
    }
}
