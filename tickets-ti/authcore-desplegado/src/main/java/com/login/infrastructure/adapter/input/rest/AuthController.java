package com.login.infrastructure.adapter.input.rest;

import com.login.application.dto.LoginRequest;
import com.login.application.dto.LoginResponse;
import com.login.domain.port.input.LoginPort;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Adaptador IN REST para autenticación.
 *
 * Primera clase del proyecto que recibe el mundo exterior.
 * Responsabilidades exactas, ni una más ni una menos:
 *   1. Recibir la petición HTTP y deserializar el JSON.
 *   2. Validar el formato de los datos de entrada (@Valid).
 *   3. Convertir el request de infraestructura al DTO de aplicación.
 *   4. Delegar al puerto de entrada LoginPort.
 *   5. Serializar la respuesta y retornar el código HTTP correcto.
 *
 * NO valida reglas de negocio → eso es LoginUseCase.
 * NO consulta la base de datos → eso es UserPersistenceAdapter.
 * NO genera tokens JWT → eso es JwtAdapter.
 * NO verifica contraseñas → eso es PasswordEncoderAdapter.
 *
 * @RestController: combina @Controller + @ResponseBody.
 *   Todos los métodos serializan automáticamente el objeto
 *   retornado a JSON usando Jackson. Sin esta anotación,
 *   Spring intentaría resolver una vista (Thymeleaf, JSP).
 *
 * @RequestMapping("/api/auth"): prefijo base de todos los
 *   endpoints de este controlador. Todos los métodos heredan
 *   este prefijo: /api/auth/login, /api/auth/refresh, etc.
 *
 * @RequiredArgsConstructor: Lombok genera el constructor con
 *   loginPort final. Spring inyecta LoginUseCase (registrado
 *   en BeanConfig como LoginPort) sin que el controlador
 *   sepa que LoginUseCase existe.
 *
 * ¿Por qué usar un record interno LoginRequestBody en lugar
 * de LoginRequest directamente con @NotBlank?
 *   LoginRequest (application/dto) es Java puro sin anotaciones
 *   de Jakarta. Para mantener esa pureza, definimos un record
 *   interno en infraestructura que SÍ tiene las anotaciones de
 *   validación. El controlador recibe el record, lo valida,
 *   y construye el LoginRequest limpio para pasar al dominio.
 *   Así cada capa tiene exactamente lo que necesita.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /**
     * Dependencia hacia la interfaz del dominio.
     * Nunca hacia LoginUseCase directamente.
     * BeanConfig inyecta la implementación concreta.
     */
    private final LoginPort loginPort;

    /**
     * POST /api/auth/login
     *
     * Endpoint público: configurado en SecurityConfig con .permitAll().
     * El usuario no tiene token aún en este punto, es donde lo obtiene.
     *
     * Flujo:
     *   1. Jackson deserializa el JSON a LoginRequestBody.
     *   2. @Valid activa Bean Validation sobre LoginRequestBody.
     *      Si @NotBlank falla → MethodArgumentNotValidException
     *      → GlobalExceptionHandler retorna HTTP 400.
     *   3. Se construye LoginRequest (DTO de aplicación, puro).
     *   4. loginPort.login() invoca LoginUseCase.
     *      Si credenciales inválidas → AuthException
     *      → GlobalExceptionHandler retorna HTTP 401.
     *   5. ResponseEntity.ok() retorna HTTP 200 con el token.
     *
     * ResponseEntity<LoginResponse>: permite controlar explícitamente
     *   el código HTTP. .ok() retorna 200 OK con el body serializado.
     *   Alternativas: .created(), .noContent(), .badRequest(), etc.
     *
     * @Valid: activa Bean Validation sobre el parámetro anotado.
     *   Si alguna constraint falla, Spring lanza
     *   MethodArgumentNotValidException antes de entrar al método.
     *   GlobalExceptionHandler la captura y retorna HTTP 400.
     *
     * @RequestBody: indica a Jackson que deserialice el body HTTP
     *   al tipo del parámetro. Sin esta anotación, Spring buscaría
     *   los valores en los parámetros de la URL (query params).
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequestBody requestBody) {

        // Construir el DTO de aplicación (puro, sin anotaciones Jakarta)
        // a partir del record de infraestructura ya validado.
        LoginRequest request = new LoginRequest(
                requestBody.username(),
                requestBody.password()
        );

        LoginResponse response = loginPort.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Record interno de validación de infraestructura.
     *
     * ¿Por qué un record interno y no una clase separada?
     *   Porque este record es un detalle de implementación del
     *   controlador REST. Solo este controlador lo usa para
     *   validar el formato de entrada HTTP. No tiene sentido
     *   crear un archivo separado para algo tan acotado.
     *
     * ¿Por qué un record y no una clase normal?
     *   Los records de Java (desde Java 16) son inmutables por
     *   defecto, tienen constructor, getters y equals/hashCode
     *   generados automáticamente. Son perfectos para DTOs
     *   de validación en infraestructura donde sí podemos
     *   usar anotaciones de Jakarta.
     *
     * ¿Por qué @NotBlank aquí y no en LoginRequest (application/dto)?
     *   LoginRequest es Java puro sin dependencias externas.
     *   @NotBlank es de jakarta.validation (infraestructura).
     *   Al separar la validación de formato en este record de
     *   infraestructura, mantenemos LoginRequest limpio.
     *   Cada capa tiene exactamente las dependencias que necesita.
     *
     * Jackson deserializa records correctamente en Spring Boot 3.x:
     *   {"username":"admin","password":"password123"}
     *   → new LoginRequestBody("admin", "password123")
     */
    record LoginRequestBody(
            @NotBlank(message = "El username es obligatorio")
            String username,

            @NotBlank(message = "La contraseña es obligatoria")
            String password
    ) {}
}
