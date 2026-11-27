package com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository;

import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TecnicoEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TecnicoJpaRepository extends JpaRepository<TecnicoEntity, Long> {

    Optional<TecnicoEntity> findByUsername(String username);

    @Query("select distinct t from TecnicoEntity t join t.categorias c where c = :categoria order by t.username")
    List<TecnicoEntity> porCategoria(@Param("categoria") String categoria);
}
