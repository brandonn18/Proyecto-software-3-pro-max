package com.login.infrastructure.config;

import com.login.application.mapper.UserDomainMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuración independiente para los mappers de aplicación.
 *
 * ¿Por qué en una clase separada de BeanConfig?
 *   Para evitar la referencia circular que ocurre cuando:
 *     - UserPersistenceAdapter necesita UserDomainMapper.
 *     - BeanConfig necesita UserPersistenceAdapter para crear LoginUseCase.
 *     - Si UserDomainMapper está en BeanConfig, se crea un ciclo:
 *       BeanConfig ↔ UserPersistenceAdapter.
 *
 *   Al aislar el mapper en su propia clase de configuración,
 *   Spring puede crear UserDomainMapper primero (sin dependencias),
 *   luego UserPersistenceAdapter (que recibe el mapper),
 *   y finalmente BeanConfig (que recibe el adapter).
 *
 * Separación de responsabilidades:
 *   MapperConfig  → registra mappers (componentes sin lógica de negocio).
 *   BeanConfig    → ensambla el caso de uso (lógica de negocio).
 */
@Configuration
public class MapperConfig {

    @Bean
    public UserDomainMapper userDomainMapper() {
        return new UserDomainMapper();
    }
}
