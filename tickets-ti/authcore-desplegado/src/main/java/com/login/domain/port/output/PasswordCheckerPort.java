package com.login.domain.port.output;

/**
 * Puerto de salida para verificación de contraseñas.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ Sin imports. Java puro absoluto.
 *   ❌ org.springframework.security.crypto.password.PasswordEncoder
 *      (eso sería infraestructura dentro del dominio)
 /*
 * ¿Por qué no usar directamente PasswordEncoder de Spring Security?
 *   PasswordEncoder es una interfaz de org.springframework.security.
 *   Importarla en el dominio significa que el dominio depende de
 *   Spring Security. Si en el futuro cambias de Spring Security
 *   a otro framework de seguridad, o si quieres probar el dominio
 *   sin levantar el contexto de Spring, esa dependencia te lo impide.
 /*
 *   Este puerto define exactamente lo mismo pero en lenguaje del dominio:
 *   "necesito saber si esta contraseña en texto plano coincide con
 *   este hash almacenado". Sin mencionar BCrypt, sin mencionar Spring.
 /*
 * ¿Por qué solo un método con dos Strings?
 *   Porque eso es exactamente lo que el dominio necesita saber.
 *   No necesita encodear contraseñas (eso lo hace el registro de usuario).
 *   No necesita saber el algoritmo.
 *   Solo necesita una respuesta boolean: ¿coinciden o no?
 /*
 * ¿Quién implementa este puerto?
 *   PasswordEncoderAdapter en infrastructure/adapter/output/security/
 *   Ese adapter delega a BCryptPasswordEncoder de Spring Security.
 *   BCrypt vive en infraestructura. El dominio no lo conoce.
 /*
 * Beneficio en tests unitarios:
 *   PasswordCheckerPort alwaysMatch = (raw, encoded) -> true;
 *   PasswordCheckerPort neverMatch  = (raw, encoded) -> false;
 *   Con simples lambdas tienes mocks completos sin Mockito ni Spring.
 *   Eso es lo que significa "dominio testeable en aislamiento".
 */
public interface PasswordCheckerPort {

    /**
     * Verifica que una contraseña en texto plano coincida con su hash.
     *
     * @param rawPassword     contraseña ingresada por el usuario
     *                        en el formulario de login.
     * @param encodedPassword hash almacenado en la base de datos,
     *                        generado por BCrypt en el registro.
     * @return true  si la contraseña coincide con el hash.
     *         false si no coincide. Nunca lanza excepción por
     *               no coincidencia: esa decisión es del caso de uso.
     */
    boolean matches(String rawPassword, String encodedPassword);
}
