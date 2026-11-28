package com.login.domain.port.input;

import com.login.application.dto.LoginRequest;
import com.login.application.dto.LoginResponse;

/**
 * Puerto de entrada (Driving Port) para autenticación.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ com.login.application.dto.*  (DTOs sin lógica, dirección correcta)
 *   ✅ com.login.domain.*           (propio dominio)
 *   ❌ org.springframework.*
 *   ❌ jakarta.*
 *   ❌ lombok.*
 *
 * ¿Por qué es una interfaz y no una clase abstracta?
 *   Porque define un CONTRATO, no un comportamiento parcial.
 *   La implementación concreta (LoginUseCase) puede cambiar
 *   completamente sin que AuthController lo note, siempre que
 *   cumpla este contrato.
 /*
 * ¿Por qué está en domain/port/input y no en application?
 *   Porque este contrato ES parte del hexágono. Define qué puede
 *   hacer el dominio. Los puertos son la frontera del hexágono,
 *   y esa frontera pertenece al dominio, no a quien la consume.
 /*
 * Nomenclatura: "Port" como sufijo sigue la convención de Cockburn
 * (creador del patrón). Otras convenciones válidas:
 *   - LoginUseCase (como interfaz, common en proyectos DDD)
 *   - ILoginService (convención húngara, menos recomendada hoy)
 * Para este proyecto usamos el sufijo Port para máxima claridad
 * arquitectónica.
 */
public interface LoginPort {

    /**
     * Autentica al usuario y retorna el token JWT.
     *
     * @param request credenciales del usuario.
     * @return token JWT + datos básicos del usuario autenticado.
     * @throws com.login.domain.exception.AuthException
     *         si el usuario no existe o la contraseña no coincide.
     */
    LoginResponse login(LoginRequest request);
}
