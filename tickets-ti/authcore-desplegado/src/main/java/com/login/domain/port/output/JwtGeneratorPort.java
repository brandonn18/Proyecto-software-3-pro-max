package com.login.domain.port.output;

import com.login.domain.model.User;

/**
 * Puerto de salida para generación de tokens JWT.
 /*
 * VERIFICACIÓN DE PUREZA:
 *   ✅ com.login.domain.model.User  (propio dominio)
 *   ❌ io.jsonwebtoken.*            (JJWT vive en infraestructura)
 *   ❌ org.springframework.*
 *   ❌ lombok.*
 /*
 * ¿Por qué recibe User (dominio) y no username (String)?
 *   Porque el token JWT puede necesitar incluir más información
 *   del usuario en sus claims: role, id, email, etc.
 *   Si el método recibiera solo el username, habría que cambiar
 *   la firma del puerto cada vez que se agregue un claim nuevo.
 *   Recibir User completo hace el puerto extensible sin cambios
 *   de contrato.
 /*
 *   Ejemplo de claims que JwtAdapter puede incluir en el token:
 *     - sub: user.getUsername()
 *     - role: user.getRole()
 *     - id: user.getId()
 /*
 * ¿Por qué retorna String y no un objeto TokenVO?
 *   Para mantener la simplicidad en este nivel del proyecto.
 *   En un sistema más complejo podrías retornar un objeto
 *   del dominio como:
 *     record Token(String value, Instant expiresAt) {}
 *   Que daría más información al caso de uso sobre el token
 *   generado sin acoplarlo a detalles de JJWT.
 /*
 * ¿Quién implementa este puerto?
 *   JwtAdapter en infrastructure/adapter/output/security/
 *   Es el ÚNICO lugar del sistema que importa io.jsonwebtoken.*
 */
public interface JwtGeneratorPort {

    /**
     * Genera un token JWT firmado para el usuario autenticado.
     *
     * @param user usuario del dominio cuyas credenciales
     *             ya fueron verificadas por LoginUseCase.
     * @return token JWT en formato "header.payload.signature"
     *         listo para ser enviado al cliente.
     */
    String generateToken(User user);
}
