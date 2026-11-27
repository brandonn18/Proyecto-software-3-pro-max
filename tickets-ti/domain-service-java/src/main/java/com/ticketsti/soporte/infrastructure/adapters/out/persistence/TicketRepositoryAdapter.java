package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.query.FiltroTicket;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.Ticket;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TicketEntity;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.mapper.TicketMapper;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository.TicketJpaRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class TicketRepositoryAdapter implements TicketRepositoryPort {

    private static final List<String> ESTADOS_VIGENTES = EstadoTicket.vigentes().stream().map(Enum::name).toList();

    private final TicketJpaRepository jpa;

    public TicketRepositoryAdapter(TicketJpaRepository jpa) {
        this.jpa = jpa;
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

    @Override
    @Transactional(readOnly = true)
    public long siguienteConsecutivo(int anio) {
        return jpa.maxConsecutivo(anio) + 1;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> contarVigentesPorTecnico(Categoria categoria, Collection<String> usernames) {
        Map<String, Long> carga = new HashMap<>();
        if (usernames.isEmpty()) return carga;
        for (Object[] fila : jpa.contarVigentes(categoria.nombre(), usernames, ESTADOS_VIGENTES)) {
            carga.put((String) fila[0], ((Number) fila[1]).longValue());
        }
        return carga;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ticket> buscar(FiltroTicket f) {
        Specification<TicketEntity> spec = (root, query, cb) -> {
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
        return jpa.findAll(spec, Sort.by(Sort.Order.desc("creadoEn"), Sort.Order.desc("id")))
                .stream().map(TicketMapper::aDominio).toList();
    }
}
