package com.login.infrastructure.adapter.input.rest;

import com.login.domain.exception.AuthException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Manejador global de excepciones HTTP.
 *
 * Intercepta excepciones antes de que lleguen al cliente y las
 * convierte en respuestas HTTP semánticas, seguras y consistentes.
 *
 * ¿Por qué está en infrastructure y no en el dominio?
 *   Porque traduce excepciones a HTTP, que es responsabilidad
 *   de la capa web (infraestructura). El dominio lanza AuthException
 *   sin saber que HTTP existe. Este handler hace esa traducción.
 *
 *   Separación de responsabilidades:
 *     Dominio        → lanza AuthException (lenguaje del negocio)
 *     Este handler   → traduce a HTTP 401  (lenguaje de la web)
 *
 * @RestControllerAdvice: combina @ControllerAdvice + @ResponseBody.
 *   @ControllerAdvice: aplica a todos los @RestController del proyecto.
 *   @ResponseBody: serializa automáticamente el Map retornado a JSON.
 *   Sin @ResponseBody, Spring intentaría resolver una vista, no JSON.
 *
 * ¿Cómo decide Spring qué @ExceptionHandler llamar?
 *   Spring busca el handler más específico primero.
 *   Si lanza AuthException → busca @ExceptionHandler(AuthException.class)
 *   Si no encuentra uno específico → busca @ExceptionHandler(Exception.class)
 *   Siempre usa el handler más específico disponible.
 *
 * Jerarquía de handlers en este archivo (de más específico a más general):
 *   AuthException                    → 401 Unauthorized
 *   MethodArgumentNotValidException  → 400 Bad Request
 *   Exception                        → 500 Internal Server Error
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Maneja AuthException lanzada por LoginUseCase.
     *
     * HTTP 401 Unauthorized: las credenciales proporcionadas
     * no son válidas o no tienen permisos suficientes.
     *
     * ¿Por qué 401 y no 403?
     *   401 Unauthorized: el cliente NO está autenticado.
     *     "No sé quién eres, identifícate correctamente."
     *   403 Forbidden: el cliente SÍ está autenticado pero
     *     no tiene permisos para el recurso solicitado.
     *     "Sé quién eres, pero no puedes hacer esto."
     *   En un login fallido, el usuario no está autenticado → 401.
     *
     * El mensaje de AuthException es intencionalmente genérico
     * ("Credenciales inválidas") para prevenir user enumeration:
     * el atacante no puede distinguir si el username existe
     * o si fue la contraseña la que falló.
     *
     * @param ex AuthException lanzada por LoginUseCase.
     * @return ResponseEntity con HTTP 401 y body JSON estructurado.
     */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuthException(
            AuthException ex) {
        return buildResponse(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    /**
     * Maneja errores de validación de Bean Validation (@Valid).
     *
     * Se dispara cuando @NotBlank, @Email, @Size, etc. fallan
     * en el record LoginRequestBody del controlador.
     *
     * HTTP 400 Bad Request: la petición tiene formato incorrecto.
     *
     * MethodArgumentNotValidException contiene todos los errores
     * de validación en una sola excepción. Un request puede fallar
     * múltiples validaciones simultáneamente (username Y password
     * vacíos). Retornamos todos los errores de una vez para que
     * el cliente pueda mostrarlos todos al usuario sin hacer
     * múltiples intentos.
     *
     * Estructura de la respuesta para validación:
     * {
     *   "timestamp": "2024-01-15T10:30:00",
     *   "status": 400,
     *   "error": {
     *     "username": "El username es obligatorio",
     *     "password": "La contraseña es obligatoria"
     *   }
     * }
     *
     * ¿Por qué un Map<String, String> para los errores de campo?
     *   Porque el cliente (frontend) necesita saber QUÉ campo
     *   falló para mostrar el error debajo del input correcto.
     *   Un mensaje genérico "hay errores de validación" no ayuda
     *   a la UX. Campo → mensaje hace la respuesta accionable.
     *
     * @param ex MethodArgumentNotValidException con todos los errores.
     * @return ResponseEntity con HTTP 400 y mapa campo → mensaje.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(
            MethodArgumentNotValidException ex) {

        Map<String, String> fieldErrors = new HashMap<>();

        /*
         * getAllErrors() retorna todos los errores de validación.
         * Cada error puede ser:
         *   FieldError:   error en un campo específico (@NotBlank en "username")
         *   ObjectError:  error a nivel de objeto completo (@Valid en clase)
         *
         * Casteamos a FieldError para obtener el nombre del campo.
         * getDefaultMessage() retorna el mensaje definido en la anotación:
         *   @NotBlank(message = "El username es obligatorio")
         *   → "El username es obligatorio"
         */
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String message = error.getDefaultMessage();
            fieldErrors.put(fieldName, message);
        });

        return buildResponse(HttpStatus.BAD_REQUEST, fieldErrors);
    }

    /**
     * Catch-all para cualquier excepción no manejada explícitamente.
     *
     * HTTP 500 Internal Server Error: algo inesperado ocurrió.
     *
     * ¿Por qué no exponer ex.getMessage() en producción?
     *   El mensaje de una excepción genérica puede contener:
     *   - Rutas de archivos del servidor
     *   - Nombres de tablas de la base de datos
     *   - Detalles de la estructura interna del sistema
     *   Todo eso es información valiosa para un atacante.
     *
     *   En desarrollo (donde estamos ahora) exponer el mensaje
     *   facilita el debugging. En producción deberías:
     *   1. Loggear la excepción completa (con stack trace) en el servidor.
     *   2. Retornar solo "Error interno del servidor" al cliente.
     *   3. Opcionalmente retornar un código de error de soporte:
     *      {"error": "Error interno", "errorCode": "ERR-20240115-001"}
     *      para que el usuario pueda reportarlo sin exponer detalles.
     *
     * @param ex Excepción no manejada por handlers más específicos.
     * @return ResponseEntity con HTTP 500 y mensaje genérico.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(
            Exception ex) {
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Error interno del servidor: " + ex.getMessage()
        );
    }

    /**
     * Construye la estructura estándar de respuesta de error.
     *
     * Todas las respuestas de error del sistema tienen el mismo formato:
     * {
     *   "timestamp": "2024-01-15T10:30:00.123456",
     *   "status":    401,
     *   "error":     "Credenciales inválidas"
     * }
     *
     * ¿Por qué incluir timestamp?
     *   Facilita la correlación de errores en logs del servidor.
     *   Si el usuario reporta un error a las 10:30, puedes buscar
     *   exactamente en ese momento en los logs del servidor.
     *
     * ¿Por qué incluir status como número además del código HTTP?
     *   Algunos clientes (especialmente móviles) no tienen acceso
     *   fácil al código de estado HTTP de la respuesta. Incluirlo
     *   en el body hace la respuesta más accesible.
     *
     * ¿Por qué Object como tipo del detail y no String?
     *   Porque handleValidationErrors pasa un Map<String, String>
     *   (múltiples errores por campo) mientras que los otros
     *   handlers pasan un String. Object acepta ambos tipos
     *   y Jackson los serializa correctamente en ambos casos.
     *
     * @param status código HTTP de la respuesta.
     * @param detail detalle del error: String o Map<String, String>.
     * @return ResponseEntity lista para retornar al cliente.
     */
    private ResponseEntity<Map<String, Object>> buildResponse(
            HttpStatus status,
            Object detail) {

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", detail);

        return ResponseEntity.status(status).body(body);
    }
}
