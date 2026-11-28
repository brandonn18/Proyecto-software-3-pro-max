package com.login.domain.exception;

/**
 * Excepción de dominio para fallos de autenticación.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ Solo extiende java.lang.RuntimeException
 *   ❌ Sin imports de Spring, Jakarta, Lombok ni ningún framework
 /*
 * Jerarquía de responsabilidades:
 *   - LoginUseCase la lanza cuando las credenciales son inválidas.
 *   - GlobalExceptionHandler (infraestructura) la captura y la
 *     traduce a HTTP 401 Unauthorized.
 *   - El dominio no sabe que HTTP existe. Solo sabe que algo
 *     violó una regla de autenticación.
 /*
 * ¿Por qué no usar IllegalArgumentException?
 *   Porque esa excepción no comunica intención de negocio.
 *   AuthException es semánticamente exacta: falló la autenticación.
 *   En un proyecto grande tendrías una jerarquía:
 *     DomainException
 *       └── AuthException
 *             ├── InvalidCredentialsException
 *             └── AccountLockedException
 *   Para este proyecto AuthException es suficiente.
 /*
 * ¿Por qué RuntimeException (unchecked)?
 *   Si fuera checked (extends Exception), todos los puertos
 *   tendrían que declarar "throws AuthException" contaminando
 *   las firmas de las interfaces con detalles de implementación.
 */
public class AuthException extends RuntimeException {

    public AuthException(String message) {
        super(message);
    }
}
