package com.login.application.dto;

/**
 * DTO de salida del proceso de login.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ Sin imports. Java puro absoluto.
 *   ❌ lombok.*                  (herramienta externa)
 *   ❌ com.fasterxml.jackson.*   (infraestructura)
 *   ❌ org.springframework.*     (infraestructura)
 /*
 * ¿Por qué no retornar User directamente desde LoginUseCase?
 *   Tres razones fundamentales:
 /*
 *   1. SEGURIDAD: User contiene el campo password (hash BCrypt).
 *      Si se retornara User directamente, Jackson lo serializaría
 *      y el hash BCrypt llegaría al cliente. Eso es una filtración
 *      de datos sensibles aunque sea un hash.
 /*
 *   2. DESACOPLAMIENTO: Si User cambia (se agrega un campo interno
 *      como "failedLoginAttempts"), la respuesta HTTP no debe cambiar.
 *      LoginResponse define exactamente el contrato de la API,
 *      independiente de cómo evolucione el modelo de dominio.
 /*
 *   3. PRINCIPIO DE MÍNIMO PRIVILEGIO: el cliente solo debe recibir
 *      lo que necesita. id es un detalle de persistencia que el
 *      cliente no debería conocer ni usar directamente.
 /*
 * ¿Por qué los campos son final (inmutables)?
 *   Una respuesta representa un resultado que ya fue calculado.
 *   No tiene sentido modificarla. La inmutabilidad hace el objeto
 *   thread-safe y más fácil de razonar.
 /*
 * ¿Cómo serializa Jackson este objeto a JSON sin @JsonProperty?
 *   Jackson usa la convención JavaBeans: busca métodos getXxx()
 *   y los mapea automáticamente al campo "xxx" en el JSON.
 *   getToken()    → "token":    "eyJhbGciOiJIUzI1NiJ9..."
 *   getUsername() → "username": "admin"
 *   getRole()     → "role":     "ROLE_ADMIN"
 *   No se necesita ninguna anotación. Jackson funciona por
 *   convención de nombres, no por anotaciones obligatorias.
 /*
 * ¿Por qué no tiene constructor vacío?
 *   LoginResponse solo se crea en LoginUseCase con todos sus
 *   campos ya calculados. Un constructor vacío permitiría crear
 *   instancias con campos null, lo cual no tiene sentido para
 *   una respuesta de login. Si todos los campos son null,
 *   no es una respuesta de login válida.
 /*
 * En una API OAuth2-compatible podrías extender este DTO con:
 *   private final String tokenType;    → siempre "Bearer"
 *   private final long expiresIn;      → segundos hasta expiración
 *   private final String refreshToken; → para renovar sin re-login
 * Esos campos se agregan aquí cuando el negocio lo requiera,
 * sin tocar User ni LoginUseCase.
 */
public class LoginResponse {

    /**
     * Token JWT firmado con HMAC-SHA256.
     * El cliente lo incluirá en cada request posterior:
     * Authorization: Bearer <token>
     */
    private final String token;

    /**
     * Nombre de usuario autenticado.
     * Útil para mostrar en la UI ("Bienvenido, admin")
     * sin necesidad de hacer una llamada adicional a /me.
     */
    private final String username;

    /**
     * Rol del usuario autenticado.
     * El frontend lo usa para decidir qué opciones mostrar:
     *   ROLE_ADMIN   → menú completo
     *   ROLE_STUDENT → solo opciones de votación
     */
    private final String role;

    public LoginResponse(String token, String username, String role) {
        this.token = token;
        this.username = username;
        this.role = role;
    }

    public String getToken()    { return token; }
    public String getUsername() { return username; }
    public String getRole()     { return role; }
}
