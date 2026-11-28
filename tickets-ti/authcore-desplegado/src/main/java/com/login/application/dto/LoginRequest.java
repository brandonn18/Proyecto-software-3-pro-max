package com.login.application.dto;

/**
 * DTO de entrada para el proceso de login.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ Sin imports. Java puro absoluto.
 *   ❌ jakarta.validation.constraints.NotBlank  (infraestructura)
 *   ❌ lombok.*                                 (herramienta externa)
 *   ❌ com.fasterxml.jackson.*                  (infraestructura)
 /*
 * ¿Qué es un DTO (Data Transfer Object)?
 *   Un objeto cuyo único propósito es transportar datos entre capas.
 *   No tiene lógica de negocio, no toma decisiones, no valida reglas
 *   del negocio. Es un contenedor de datos con getters.
 /*
 * ¿Por qué no tiene @NotBlank ni ninguna anotación de validación?
 *   @NotBlank pertenece a jakarta.validation (infraestructura).
 *   La capa de aplicación es Java puro, igual que el dominio.
 *   La validación de formato (campo no vacío, formato de email, etc.)
 *   es responsabilidad del adaptador IN (AuthController) que vive
 *   en infraestructura y sí puede usar anotaciones de Jakarta.
 /*
 *   Separar estas responsabilidades tiene un beneficio concreto:
 *   si cambias el canal de entrada de REST a gRPC o a CLI,
 *   cada adaptador define sus propias reglas de formato sin tocar
 *   este DTO. El DTO permanece neutral.
 /*
 * ¿Por qué no tiene @Builder de Lombok?
 *   La capa de aplicación tampoco depende de herramientas externas.
 *   Un constructor de dos parámetros y dos getters no es boilerplate
 *   que justifique esa dependencia. Jackson deserializa este objeto
 *   usando el constructor o los setters; no necesita @Builder.
 /*
 * ¿Por qué los campos son final (inmutables)?
 *   Un DTO de entrada representa una solicitud que ya ocurrió.
 *   No tiene sentido modificarla después de ser creada.
 *   La inmutabilidad previene bugs sutiles donde un componente
 *   modifica el request y otro componente ve datos alterados.
 /*
 * ¿Cómo deserializa Jackson un objeto sin constructor vacío?
 *   Jackson puede deserializar usando @JsonCreator o, más moderno,
 *   con la propiedad spring.jackson.constructor-detector=use-properties-based
 *   Pero la forma más simple y explícita es tener el constructor
 *   con todos los campos, que Jackson detecta automáticamente
 *   cuando está configurado con la opción default en Spring Boot.
 *   Spring Boot 3.x configura Jackson para usar constructores
 *   de un solo argumento o todos los argumentos automáticamente.
 */
public class LoginRequest {

    private final String username;
    private final String password;

    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() { return username; }
    public String getPassword() { return password; }
}
