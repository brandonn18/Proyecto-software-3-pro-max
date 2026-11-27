# CLAUDE.md — Tickets TI

Guía para agentes y colaboradores. Escrita en español.

## Antes de empezar

1. Lee `PENDIENTES.md`: estado actual, hoja de ruta por fases, backlog de mejoras y decisiones abiertas. Ahí está qué hacer y en qué orden.
2. Para ordenar o borrar carpetas históricas existe `LIMPIEZA_REPO.md`. No ejecutes esa limpieza sin que el usuario confirme que el equipo y el profesor la aprobaron.
3. Este archivo manda sobre tus suposiciones. Si algo no está aquí ni en `PENDIENTES.md`, pregunta en lugar de inventarlo.

## Contexto

- Asignatura: Ingeniería del Software III (167420), Universidad de Pamplona.
- Autores: Brandon Jair Martínez Ruda y Juan Esteban Basto Dávila.
- Entregable actual: `tickets-ti/domain-service-java/`, un domain service en Java 17 / Spring Boot 3.5.6 con arquitectura hexagonal. Es el proyecto base del profesor, corregido por el grupo.
- Alcance de este avance: HU-8 a HU-12 (crear con asignación automática, cambiar estado, reabrir, reasignar, consultar), más las mejoras M-01 (alerta de SLA al 80 % y marcado de vencidos, RF-09), M-02 (notificaciones por `NotificacionPort`, RF-10) y M-03 (reportes para el ADMIN, RF-12).
- Fuera de alcance por ahora: frontend React.

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
- Esquema (M-04): lo crean las migraciones Flyway de `src/main/resources/db/migration/{h2,mysql}` y Hibernate solo valida (`ddl-auto: validate`). La primera vez sobre una base con tablas pero sin historial de Flyway (la de la EC2), el servicio no arranca hasta adoptarla con un baseline: `deploy/DESPLIEGUE.md`, paso 10. Esa adopción la hace el dueño.
- Salud: `GET /api/health` (público, sin token; responde 200 `{"status":"UP"}`).

## Arquitectura y reglas de dependencia

Paquete base `com.ticketsti.soporte`:

- `domain/`: modelo y reglas (Ticket, Tecnico, Actor, estados, `MedicionSla`, `PoliticaAsignacion`, `PoliticaAcceso`, excepciones). Sin frameworks.
- `application/`: casos de uso (`TicketUseCase`, `TecnicoUseCase`, `VerificarSlaUseCase`, `ReporteUseCase`), servicios, puertos (`port/in`, `port/out`; los reportes leen por su propio puerto de solo lectura, `ReporteQueryPort`) y los modelos de avisos y reportes (`notificacion`, `reporte`). Sin Spring ni JPA.
- `infrastructure/`: adaptadores de entrada REST (`adapters/in/rest`) y programados (`adapters/in/programacion`), de salida JPA (`adapters/out/persistence`) y de notificación (`adapters/out/notificacion`), seguridad JWT (`security`) y configuración (`config`).

Dependencias permitidas: `infrastructure` → `application` → `domain`. `ArquitecturaHexagonalTest` (ArchUnit) lo verifica y rompe la build si se incumple.

Convenciones: los permisos viven en `PoliticaAcceso`, no en los controladores; el reloj se inyecta (`Clock`); la transacción se pide por `TransaccionPort`; los avisos salen por `NotificacionPort` después de la transacción y, si fallan, no deshacen la operación.

## Reglas de negocio

- Código de ticket `TKT-AAAA-NNNN`: año en zona America/Bogota, consecutivo por año. Es el identificador en las rutas.
- Estados: ABIERTO, ASIGNADO, EN_PROCESO, EN_ESPERA, RESUELTO, CERRADO.
- Transiciones válidas: ASIGNADO→EN_PROCESO; EN_PROCESO⇄EN_ESPERA; EN_PROCESO→RESUELTO; RESUELTO→CERRADO. ABIERTO→ASIGNADO solo al asignar técnico. Cualquier otra transición responde 409.
- Reabrir: solo desde RESUELTO o CERRADO, con motivo obligatorio. Vuelve a ABIERTO sin técnico y con SLA reiniciado.
- SLA en horas corridas: CRITICA 4, ALTA 8, MEDIA 24, BAJA 72.
- Alerta de SLA (M-01): un proceso programado revisa los tickets vigentes cada `negocio.sla.intervalo-verificacion` (por defecto `PT1M`). Al consumirse el 80 % del plazo registra una alerta; al cumplirse el plazo marca el ticket como vencido. Las dos quedan en el historial (`por: sistema`) y no cambian estado ni técnico. Cada una ocurre una sola vez por SLA (marcas `alertaSlaEn` y `slaVencidoEn` en el ticket) y reabrir las reinicia. Si venció sin alerta previa, solo se marca vencido. Los RESUELTO y CERRADO no se revisan.
- Notificaciones (M-02): se avisa al crear, al asignar (automática o reasignación), al pasar a RESUELTO y en cada alerta y vencimiento de SLA. Los demás cambios de estado, la reapertura y el cierre no se avisan. Solo se avisa lo que quedó guardado, y una falla del canal no deshace la operación. Hoy el único canal es el log (`NotificacionRegistroAdapter`). El aviso no dice a quién avisar: lo decide cada canal.
- Reportes (M-03), solo ADMIN (USER y TECNICO reciben 403): `GET /api/reportes/resumen` (totales por estado, prioridad y categoría; vigentes, sin asignar y vencidos sin resolver), `/sla` (cumplimiento total y por prioridad, vigentes vencidos y en riesgo) y `/tecnicos` (por técnico: vigentes, cumplimiento y minutos promedio de resolución). Un ticket resuelto o cerrado cumple el SLA si su última resolución fue antes del vencimiento de su SLA vigente; uno reabierto se mide con su nuevo plazo. «Vencido» y «en riesgo» se calculan con el reloj al generar el reporte, no con las marcas de M-01. El tiempo de resolución cuenta desde el inicio del plazo vigente.
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
- Al preparar un commit, usar `git add -- <rutas>` y `git commit -- <rutas>` con rutas concretas. Nunca `-A`, `.` ni `-a`: el árbol de trabajo puede traer cambios ajenos a la tarea; revisa `git status` antes de cada commit e incluye solo lo tuyo.
- Secretos solo por variables de entorno o por `/etc/domain-service.env` (permisos 600, fuera del repositorio). Sin contraseñas, IPs públicas, IDs de cuenta ni endpoints reales en ningún archivo versionado; usar marcadores como `<IP_EC2>`, `<ENDPOINT_RDS>`, `<CLAVE>`.
- No modificar el AuthCore desplegado ni la infraestructura AWS sin confirmarlo con el dueño. Los agentes no tienen acceso a AWS y no deben intentarlo.
- Las pruebas deben quedar en verde (`mvn verify`) antes de cada commit de código.
- Cambios de esquema: una migración nueva `V<n>__<descripción>.sql` en `db/migration/mysql` y en `db/migration/h2`, con el mismo número (`MigracionesTest` lo exige). Nunca se edita una migración ya aplicada. El SQL de cada base se puede generar con Hibernate: `jakarta.persistence.schema-generation.scripts.*` con el dialecto de esa base.
- No modificar archivos fuera del alcance de la tarea.

## Flujo de trabajo con Claude Code

1. Elige **una** tarea de `PENDIENTES.md` (sección 3) y crea su rama (`feat/<nombre>`, `fix/<nombre>` o `docs/<nombre>`) desde `main` actualizado; mientras el PR #7 siga abierto, desde `feat/domain-service-java`.
2. Escribe primero la prueba que falla y después el código. Si `ArquitecturaHexagonalTest` falla, el diseño rompe las capas: corrige el diseño, no la prueba.
3. `mvn verify` en verde antes de cada commit de código. Si `mvn` o `java` no están instalados (`mvn -v`), dilo: no declares la tarea terminada sin haberlas ejecutado.
4. Si cambias una regla de negocio, actualiza en el mismo PR la sección "Reglas de negocio" de este archivo y el README del servicio.
5. Al terminar: marca la tarea en `PENDIENTES.md`, haz commit con rutas concretas y **pregunta antes de hacer push o abrir el PR**.

### Pide confirmación al usuario antes de

- Ejecutar la limpieza de `LIMPIEZA_REPO.md` o borrar carpetas, ramas o etiquetas.
- Tocar el AuthCore desplegado, la EC2, el RDS o cualquier recurso de AWS.
- Cambiar una regla de negocio ya confirmada (p. ej. M-08 y M-09 de `PENDIENTES.md`) o el contrato REST.
- Hacer push, abrir o mezclar un PR, o reescribir historial (`--force`, `rebase`, `reset --hard`).
- Manejar secretos: no los pidas, no los imprimas y no los escribas en archivos; usa marcadores como `<CLAVE>`.

### Entorno

- Windows: si `clone` o `checkout` fallan con "Filename too long", `git config core.longpaths true`. JDK 17 y Maven 3.9+ deben estar en el `PATH`.
- Las variables de entorno se definen distinto en Bash (`export X=...`) y en PowerShell (`$env:X = '...'`).
