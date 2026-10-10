package com.pamplona.authcore.domain;

/**
 * Roles disponibles en el sistema. Para agregar un nuevo rol (ej. SOPORTE),
 * basta con agregar una constante aqui - no requiere cambios en ninguna otra capa.
 *
 * TECNICO: agregado para Tickets TI (atiende tickets). domain-service traduce
 * ADMIN -> administrador, TECNICO -> tecnico, USER -> usuario.
 */
public enum Role {
    ADMIN,
    TECNICO,
    USER
}
