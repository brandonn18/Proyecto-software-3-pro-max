# AuthCore desplegado (`nubwiapp/login`)

Servicio de autenticación que corre en la EC2 del proyecto (servicio systemd `login-api`, puerto 8080, base MySQL en RDS).
**Es el que usa el domain service**: este solo valida localmente los JWT que emite este servicio, nunca lo llama.
No confundir con `tickets-ti/authcore/`, que es el AuthCore propio del grupo (puerto 8081, PostgreSQL) y no está desplegado.

## Origen de esta copia

| Dato | Valor |
|---|---|
| Repositorio original | `https://github.com/nubwiapp/login.git` (Taller 2) |
| Commit copiado | `70a6901173c705edbd47ebff9fb33ac2c1b09610` (único commit del original) |
| Fecha de la copia | 2026-11-27 |
| Licencia | El original no declara ninguna |
| Cómo se copió | `git archive` del commit, sin `.git` ni historial |

La copia es de lectura y consulta: la fuente de verdad sigue siendo el repositorio original y la EC2.
Un cambio de comportamiento se acuerda con su dueño antes de tocar la EC2 (ver «Detalles pendientes del dueño»).

### Qué se cambió respecto al original

Solo se sacaron los secretos. Ningún comportamiento cambió.

1. `src/main/resources/application.yaml`: `url`, `username`, `password` y `jwt.secret` traían un valor fijo.
   Ahora son `${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}` y `${JWT_SECRET}`, **sin valor por defecto**: si falta alguna, el servicio no arranca.
   Se añadió una cabecera de comentario que lo explica.
2. `JwtAdapter.java`: un comentario Javadoc traía el `jwt.secret` en claro; ahora dice `<CLAVE_BASE64>`.

> **Advertencia.** Ese secreto estuvo en un repositorio público. Si coincide con el que usa la EC2, está comprometido: quien lo conozca puede fabricar tokens válidos con cualquier rol, incluido ADMIN.
> Debe rotarlo el dueño, en este servicio **y** en `JWT_SECRET_BASE64` del domain service, y reiniciar ambos (los tokens vigentes dejan de valer).
> La clave nueva no debe pasar por chats, capturas ni este repositorio.

## Variables de entorno

| Variable | Qué es | Ejemplo con marcador |
|---|---|---|
| `DB_URL` | URL JDBC de MySQL | `jdbc:mysql://<ENDPOINT_RDS>:3306/<BD_AUTHCORE>?useSSL=false&serverTimezone=UTC` |
| `DB_USERNAME` | Usuario de la base | `<USUARIO_BD>` |
| `DB_PASSWORD` | Clave de la base | `<CLAVE>` |
| `JWT_SECRET` | Clave HMAC en **Base64** (al decodificarla, 32 bytes o más) | `<CLAVE_BASE64>` |

Para generar una clave nueva: `openssl rand -base64 48`.
En la EC2, la configuración real está fuera del repositorio (`/opt/login/application-prod.yml`, según `domain-service-java/deploy/DESPLIEGUE.md`).

## Compilar y probar

Requiere Java 21 (el `build.gradle` fija esa versión) y una MySQL accesible con las cuatro variables definidas:
la única prueba, `LoginApplicationTests.contextLoads`, arranca el contexto completo de Spring.

```bash
export DB_URL=<URL_JDBC> DB_USERNAME=<USUARIO_BD> DB_PASSWORD=<CLAVE> JWT_SECRET=<CLAVE_BASE64>
./gradlew test            # Gradle 8.14.4 vía wrapper
./gradlew build           # genera build/libs/login-jwt-0.0.1-SNAPSHOT.jar
java -jar build/libs/login-jwt-0.0.1-SNAPSHOT.jar
```

Verificado el 2026-11-27 con una MySQL 8.4 desechable en Docker: `./gradlew build` en verde y el servicio arranca en el puerto 8080.
`ddl-auto: update` crea la tabla `users` al arrancar.

## Endpoint

Solo uno es público para el negocio; los demás son Swagger (`/swagger-ui.html`, `/v3/api-docs`).

`POST /api/auth/login`

```json
{ "username": "<USUARIO>", "password": "<CLAVE>" }
```

| Respuesta | Cuándo | Cuerpo |
|---|---|---|
| 200 | Credenciales correctas | `{ "token": "...", "username": "...", "role": "ROLE_..." }` |
| 400 | Falta `username` o `password` | `{ "timestamp", "status": 400, "error": { "<campo>": "<mensaje>" } }` |
| 401 | Usuario inexistente o clave incorrecta (mismo mensaje) | `{ "timestamp", "status": 401, "error": "Credenciales inválidas" }` |
| 500 | Cualquier otro error, p. ej. un JSON mal formado | `{ "timestamp", "status": 500, "error": "Error interno del servidor: <detalle interno>" }` |

## Formato del JWT

- Algoritmo HS256; la cabecera es solo `{"alg":"HS256"}`.
- La clave de firma es `JWT_SECRET` decodificado de Base64 (el domain service usa el mismo valor en `JWT_SECRET_BASE64`).
- Claims: `sub` (el usuario), `role` (texto, por ejemplo `ROLE_ADMIN`), `iat` y `exp`. No lleva `uid` ni una lista `roles`.
- Vigencia: 24 horas (`jwt.expiration: 86400000`, fijo en el `application.yaml`; no se puede cambiar con una variable de entorno).

## Usuarios y roles

No hay registro por la API: los usuarios se crean por SQL en la tabla `users`.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | bigint, autoincremental | |
| `username` | varchar(50), único | Debe coincidir con el de `POST /api/tecnicos` del domain service |
| `password` | varchar(100) | Hash **BCrypt** (el servicio compara con `BCryptPasswordEncoder`) |
| `role` | varchar(30) | `ROLE_ADMIN`, `ROLE_TECNICO` o `ROLE_USER` |

El paso a paso con `htpasswd` está en el paso 7 de `domain-service-java/deploy/DESPLIEGUE.md`.
Un hash es una credencial derivada: no lo pegues en chats ni en el repositorio.

## Detalles pendientes del dueño

Ninguno se ha cambiado: cada uno altera el comportamiento del servicio desplegado. Están en la fase B.6 de `tickets-ti/PENDIENTES.md`.

| Detalle | Hoy | Propuesta |
|---|---|---|
| Error 500 | Devuelve `ex.getMessage()` al cliente (con un JSON roto se ve el mensaje interno de Jackson, y debería ser un 400) | Mensaje genérico; el detalle, solo al log |
| Swagger | Público | Cerrarlo o dejarlo solo en desarrollo |
| CORS | Sin configuración | Definir orígenes si habrá frontend |
| Registro de SQL | `show-sql: true`; `DEBUG` en `com.login` y Spring Security; `BasicBinder: TRACE` (escribe los parámetros de las consultas) | `INFO` o `WARN` en producción |
| Esquema | `ddl-auto: update` | `validate` con migraciones |
| Vigencia del token | 24 h, y el domain service no revoca tokens | Una vigencia más corta |
| Claim `role` | Se emite, pero `JwtAuthFilter` da siempre `ROLE_USER` a quien presente un token válido | Usarlo, o documentar que lo valida cada servicio |
| Nombre del pool | `ElectoralHikariPool`, resto de otro proyecto | Renombrarlo (solo estético) |
