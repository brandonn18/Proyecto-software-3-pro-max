package com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository;

import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.ContadorTicketEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContadorTicketJpaRepository extends JpaRepository<ContadorTicketEntity, Integer> {

    /** SELECT ... FOR UPDATE: la fila queda bloqueada hasta que termina la transacción de quien la pidió. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContadorTicketEntity c where c.anio = :anio")
    Optional<ContadorTicketEntity> bloquear(@Param("anio") int anio);

    /** Inserción directa (sin merge): si la fila ya existe, falla en vez de sobrescribirla. */
    @Modifying
    @Query(value = "insert into contador_ticket (anio, ultimo) values (:anio, :ultimo)", nativeQuery = true)
    void insertar(@Param("anio") int anio, @Param("ultimo") long ultimo);
}
