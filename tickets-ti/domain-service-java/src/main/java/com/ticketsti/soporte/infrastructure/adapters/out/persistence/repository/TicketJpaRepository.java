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

    /** M-01: candidatos a revisar el SLA. El que vence antes, primero. */
    @Query("select t from TicketEntity t where t.estado in :vigentes and t.slaVencidoEn is null "
            + "order by t.venceSla asc, t.id asc")
    List<TicketEntity> vigentesSinSlaVencido(@Param("vigentes") Collection<String> vigentes);

    /**
     * M-03: una fila por ticket, sin cargar el historial: [codigo, estado, prioridad, categoria, tecnico, venceSla,
     * última vez que pasó a RESUELTO (o null)].
     */
    @Query("select t.codigo, t.estado, t.prioridad, t.categoria, t.tecnico, t.venceSla, max(h.cuando) "
            + "from TicketEntity t left join t.historial h on h.a = :resuelto "
            + "group by t.id, t.codigo, t.estado, t.prioridad, t.categoria, t.tecnico, t.venceSla")
    List<Object[]> filasReporte(@Param("resuelto") String resuelto);
}
