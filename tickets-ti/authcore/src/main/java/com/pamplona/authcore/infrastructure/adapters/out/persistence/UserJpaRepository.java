package com.pamplona.authcore.infrastructure.adapters.out.persistence;

import com.pamplona.authcore.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, Long> {
    Optional<UserJpaEntity> findByUsername(String username);

    @Query("select u from UserJpaEntity u join u.roles r where r = :role order by u.username")
    List<UserJpaEntity> findByRole(@Param("role") Role role);
}
