package com.login.application.mapper;

import com.login.domain.model.User;
import com.login.infrastructure.adapter.output.persistence.UserEntity;

/**
 * Mapper entre UserEntity (JPA/infraestructura) y User (dominio).
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ com.login.domain.model.User              (dominio)
 *   ✅ com.login.infrastructure...UserEntity    (infraestructura)
 *   ❌ lombok.*                                 (herramienta externa)
 *   ❌ org.springframework.*                    (framework)
 *   ❌ org.mapstruct.*                          (herramienta externa)
 /*
 * ¿Por qué no tiene @Component de Spring?
 *   La capa de application es Java puro, sin anotaciones de Spring.
 *   BeanConfig (infrastructure/config) registra una instancia
 *   de este mapper como @Bean, permitiendo que Spring la inyecte
 *   en UserPersistenceAdapter sin que el mapper sepa que Spring existe.
 /*
 * ¿Por qué application puede importar infrastructure (UserEntity)?
 *   Esta es la tensión arquitectónica más honesta de este mapper.
 *   Estrictamente, application no debería conocer infrastructure.
 *   La dirección ideal de dependencias es:
 *     infrastructure → application → domain
 /*
 *   Al importar UserEntity aquí, la dirección queda:
 *     application ↔ infrastructure (bidireccional, no ideal)
 /*
 *   En proyectos medianos esto es aceptable y pragmático.
 *   En proyectos grandes la solución es mover el mapper
 *   al propio adaptador de persistencia (UserPersistenceAdapter),
 *   que sí puede conocer ambas representaciones porque ya vive
 *   en infraestructura y depende de ambas capas.
 /*
 *   Para este proyecto mantenemos el mapper en application
 *   porque su propósito educativo es mostrar la separación
 *   entre las dos representaciones del usuario.
 /*
 * ¿Por qué dos métodos y no solo toDomain()?
 *   toDomain(): se usa ahora en el login (UserPersistenceAdapter).
 *   toEntity(): se usará cuando implementes registro de usuarios.
 *   Incluirlo ahora completa el contrato del mapper y evita
 *   tener que volver a este archivo cuando crezcas el sistema.
 */
public class UserDomainMapper {

    /**
     * Infraestructura → Dominio.
     /*
     * Llamado por UserPersistenceAdapter después de que JPA
     * retorna la UserEntity desde MySQL. Convierte la representación
     * técnica en el modelo puro que el dominio entiende.
     /*
     * Se verifica null para evitar NullPointerException en casos
     * donde el Optional de JPA contiene un valor inesperado.
     * En la práctica UserPersistenceAdapter usa Optional.map()
     * que no llama al mapper si el Optional está vacío, pero
     * la verificación hace el mapper más robusto y reutilizable.
     */
    public User toDomain(UserEntity entity) {
        if (entity == null) return null;

        return new User(
                entity.getId(),
                entity.getUsername(),
                entity.getPassword(),
                entity.getRole()
        );
    }

    /**
     * Dominio → Infraestructura.
     /*
     * Se usará cuando implementes el registro de usuarios:
     *   User nuevoUsuario = new User(null, "juan", hashBcrypt, "ROLE_STUDENT");
     *   UserEntity entidad = mapper.toEntity(nuevoUsuario);
     *   userJpaRepository.save(entidad);
     /*
     * Nótese que id puede ser null cuando se crea un usuario nuevo:
     * MySQL asignará el AUTO_INCREMENT. Cuando se actualiza un
     * usuario existente, id tendrá el valor de la BD.
     */
    public UserEntity toEntity(User user) {
        if (user == null) return null;

        UserEntity entity = new UserEntity();
        entity.setId(user.getId());
        entity.setUsername(user.getUsername());
        entity.setPassword(user.getPassword());
        entity.setRole(user.getRole());
        return entity;
    }
}
