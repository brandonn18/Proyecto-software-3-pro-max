# CLAUDE.md — Tickets TI

Guía para agentes y colaboradores. Escrita en español.

## Contexto

- Asignatura: Ingeniería del Software III (167420), Universidad de Pamplona.
- Autores: Brandon Jair Martínez Ruda y Juan Esteban Basto Dávila.
- Entregable actual: `tickets-ti/domain-service-java/`, un domain service en Java 17 / Spring Boot 3.5.6 con arquitectura hexagonal. Es el proyecto base del profesor, corregido por el grupo.
- Alcance de este avance: HU-8 a HU-12 (crear con asignación automática, cambiar estado, reabrir, reasignar, consultar).
- Fuera de alcance por ahora: alerta SLA al 80 %, notificaciones, reportes, frontend React.

## Mapa de carpetas (`tickets-ti/`)

Entregable vigente:

- `domain-service-java/`: servicio de dominio Java. Incluye `deploy/` (unidad systemd, ejemplo de variables y runbook de despliegue).
- `authcore/`: AuthCore Java propio del grupo. **No es el desplegado**; el desplegado viene del Taller 2 (ver integración).

Históricas (no son fuente de verdad del estado actual):

- `backend/`: monolito Node/Express antiguo, reemplazado. Los documentos de la raíz (`README.md`, `COVERAGE_REPORT.md`, `MANUAL_TEST_GUIDE.md`) y `docker-compose.yml`/`nginx/` describen ese monolito.
- `domain-service/`: versión Node del dominio (puerto 3003), anterior al servicio Java.
- `frontend/`: React; consume el contrato Node, no el servicio Java.
- `infra/aws/`: plantillas ECS. **No es lo desplegado.**
- `herramientas/`: utilidades del monolito (p. ej. `migrar-monolito`).

## Comandos (desde `tickets-ti/domain-service-java/`)

- `mvn verify`: compila y ejecuta todas las pruebas (requiere JDK 17 y Maven 3.9+).
- `mvn -DskipTests package`: genera `target/domain-service-tickets-0.1.0-SNAPSHOT.jar`.
- Desarrollo: `export JWT_SECRET_BASE64=<CLAVE_COMPARTIDA>` y luego `mvn spring-boot:run`. Escucha en `http://localhost:8082` con H2 en memoria.
- Producción: `SPRING_PROFILES_ACTIVE=prod` más `DB_URL`, `DB_USER`, `DB_PASSWORD` (y `PORT`, opcional: define `server.port`, por defecto 8082).
- Salud: `GET /api/health` (público, sin token; responde 200 `{"status":"UP"}`).

## Arquitectura y reglas de dependencia

Paquete base `com.ticketsti.soporte`:

- `domain/`: modelo y reglas (Ticket, Tecnico, Actor, estados, `PoliticaAsignacion`, `PoliticaAcceso`, excepciones). Sin frameworks.
- `application/`: casos de uso (`TicketUseCase`, `TecnicoUseCase`), servicios y puertos (`port/in`, `port/out`). Sin Spring ni JPA.
- `infrastructure/`: adaptadores de entrada REST (`adapters/in/rest`), de salida JPA (`adapters/out/persistence`), seguridad JWT (`security`) y configuración (`config`).

Dependencias permitidas: `infrastructure` → `application` → `domain`. `ArquitecturaHexagonalTest` (ArchUnit) lo verifica y rompe la build si se incumple.

Convenciones: los permisos viven en `PoliticaAcceso`, no en los controladores; el reloj se inyecta (`Clock`); la transacción se pide por `TransaccionPort`.

## Reglas de negocio

- Código de ticket `TKT-AAAA-NNNN`: año en zona America/Bogota, consecutivo por año. Es el identificador en las rutas.
- Estados: ABIERTO, ASIGNADO, EN_PROCESO, EN_ESPERA, RESUELTO, CERRADO.
- Transiciones válidas: ASIGNADO→EN_PROCESO; EN_PROCESO⇄EN_ESPERA; EN_PROCESO→RESUELTO; RESUELTO→CERRADO. ABIERTO→ASIGNADO solo al asignar técnico. Cualquier otra transición responde 409.
- Reabrir: solo desde RESUELTO o CERRADO, con motivo obligatorio. Vuelve a ABIERTO sin técnico y con SLA reiniciado.
- SLA en horas corridas: CRITICA 4, ALTA 8, MEDIA 24, BAJA 72.
- Asignación automática: técnico de la categoría con menos tickets vigentes en esa categoría; empate, menor username. Sin técnicos, el ticket queda ABIERTO.
- Reasignar: solo ADMIN, a un técnico registrado distinto del actual, nunca sobre tickets RESUELTO o CERRADO.
- Visibilidad: USER ve los que creó; TECNICO, los que creó o tiene asignados; ADMIN, todos.
- Errores: 400 datos inválidos, 401 sin token válido, 403 sin permiso, 404 no existe, 409 transición/duplicado/concurrencia, 422 otra regla de negocio, 500 error interno.
- Decisiones del Excel del profesor: confirmadas por el grupo.

## Integración con AuthCore

- AuthCore desplegado: repositorio `nubwiapp/login` (Taller 2), en una EC2 con Java 21, servicio systemd `login-api`, base MySQL en RDS, puerto 8080.
- Único endpoint usado: `POST /api/auth/login` con `{"username","password"}`. Responde 200 `{"token","username","role"}` o 401.
- No hay endpoints de registro ni de asignación de roles: los usuarios se crean por SQL en la tabla `users(username, password BCrypt, role)`. Roles: `ROLE_ADMIN`, `ROLE_TECNICO`, `ROLE_USER`.
- JWT del AuthCore desplegado: HS256, clave = secreto Base64 decodificado, claims `sub`, `role` (texto), `iat`, `exp`. Sin `uid` ni `roles[]`.
- El domain service valida el JWT localmente con la clave compartida; nunca llama al AuthCore. Tolerancia de reloj: 30 s.
- La clave llega solo por `JWT_SECRET_BASE64`, idéntica al `jwt.secret` del AuthCore. Si falta, el servicio no arranca.
- El validador (`infrastructure/security/JwtTokenValidator.java`) lee `roles` (lista, formato de la guía) y `role` (texto, AuthCore desplegado), los une sin duplicados y normaliza el prefijo `ROLE_` y las mayúsculas. `uid` es opcional.
- El `username` de `POST /api/tecnicos` debe ser idéntico al del AuthCore, y ese usuario debe tener rol `ROLE_TECNICO`.

## Reglas de trabajo

- Commits con Conventional Commits, en español, en la rama propia del trabajo (ahora `feat/domain-service-java`). Sin push si no se pide.
- Al preparar un commit, usar `git add -- <rutas>` y `git commit -- <rutas>` con rutas concretas. Nunca `-A`, `.` ni `-a`: hay borrados ajenos en `Diagramas/`.
- Secretos solo por variables de entorno o por `/etc/domain-service.env` (permisos 600, fuera del repositorio). Sin contraseñas, IPs públicas, IDs de cuenta ni endpoints reales en ningún archivo versionado; usar marcadores como `<IP_EC2>`, `<ENDPOINT_RDS>`, `<CLAVE>`.
- No modificar el AuthCore desplegado ni la infraestructura AWS sin confirmarlo con el dueño. Los agentes no tienen acceso a AWS y no deben intentarlo.
- Las pruebas deben quedar en verde (`mvn verify`) antes de cada commit de código.
- No modificar archivos fuera del alcance de la tarea.
