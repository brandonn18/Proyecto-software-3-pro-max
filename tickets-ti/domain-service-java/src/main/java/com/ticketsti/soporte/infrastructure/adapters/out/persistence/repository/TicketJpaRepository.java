package com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository;

import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TicketEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketJpaRepository extends JpaRepository<TicketEntity, Long>, JpaSpecificationExecutor<TicketEntity> {

    Optional<TicketEntity> findByCodigo(String codigo);

    @Query("select coalesce(max(t.consecutivo), 0) from TicketEntity t where t.anio = :anio")
    long maxConsecutivo(@Param("anio") int anio);

    /** Cada fila es [tecnico, cantidad]. «Vigente» según EstadoTicket.estaVigente(); los nombres llegan en {@code vigentes}. */
    @Query("select t.tecnico, count(t) from TicketEntity t where t.categoria = :categoria and t.tecnico in :usuarios "
            + "and t.estado in :vigentes group by t.tecnico")
    List<Object[]> contarVigentes(@Param("categoria") String categoria, @Param("usuarios") Collection<String> usuarios,
                                  @Param("vigentes") Collection<String> vigentes);
}
