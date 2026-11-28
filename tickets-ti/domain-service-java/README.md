# Domain Service — Tickets TI (Ingeniería del Software III, Universidad de Pamplona)

Servicio de dominio que se apoya en **AuthCore** para autenticar: valida localmente el JWT de AuthCore (HS256 en el desplegado; también acepta HS384 y HS512). Gestiona tickets de soporte:
creación con asignación automática al técnico con menos carga, ciclo de estados, reapertura, reasignación,
SLA por prioridad y consulta según el rol.

Paquete base: `com.ticketsti.soporte` · Java 17 · Spring Boot 3.5.6 · Maven · H2 (dev) / MySQL (prod) · JUnit 5.

> Este proyecto parte del **material de clase** del curso (Java/Spring), corregido y ampliado por el grupo. La versión
> anterior del grupo, en Node.js, se retiró del repositorio el 2026-11-26 y queda en la etiqueta `archivo/pre-limpieza-2026-11`.

## Estado honesto

| Parte | Estado |
|---|---|
| Dominio + aplicación | Compilado y probado con pruebas unitarias |
| Infraestructura (Spring, JPA, REST, seguridad) | Ejecutada y probada: `mvn verify` corre las pruebas Spring (contrato JPA, unicidad, REST de punta a punta con JWT) |
| Salud y puerto | `GET /api/health` público (`{"status":"UP"}`); `PORT` define `server.port` (por defecto 8082) |

## Arquitectura (hexagonal)

```
domain/          Ticket, Tecnico, Actor, estados, MedicionSla, PoliticaAsignacion (2 estrategias), PoliticaAcceso, excepciones
application/     casos de uso (TicketUseCase, TecnicoUseCase, VerificarSlaUseCase, ReporteUseCase), servicios, puertos de salida (repositorios, TransaccionPort, NotificacionPort, ReporteQueryPort)
infrastructure/  adaptadores: REST (in), programado (in), JPA (out), notificación al log (out), seguridad JWT, configuración
```

`domain` y `application` no importan Spring ni JPA (lo verifica `ArquitecturaHexagonalTest`). La transacción se pide por el
puerto `TransaccionPort`; el reloj se inyecta (`Clock`); los permisos viven en `PoliticaAcceso`, no en los controladores.

## Historias de usuario → código

| HU | Qué hace | Dónde |
|---|---|---|
| HU-1..7 | Autenticación AuthCore | `infrastructure/security` (valida el JWT) |
| HU-8 | Crear ticket + asignación automática (+ técnicos y categorías) | `TicketService.crear`, `PoliticaAsignacion`, `POST /api/tickets`, `POST` y `GET /api/tecnicos`, `GET /api/tecnicos/{username}` |
| HU-9 | Cambiar estado con ciclo e historial | `EstadoTicket.siguientes`, `Ticket.cambiarEstado`, `PATCH /api/tickets/{codigo}/status` |
| HU-10 | Reabrir con motivo y SLA reiniciado | `Ticket.reabrir`, `POST /api/tickets/{codigo}/reopen` |
| HU-11 | Reasignar | `Ticket.asignarA`, `POST /api/tickets/{codigo}/assign` |
| HU-12 | Consultar según rol, con filtros y, opcionalmente, por páginas (M-05) | `TicketService.consultar` / `consultarPagina`, `GET /api/tickets?page=&size=`, `GET /api/tickets/{codigo}` |
| RF-09 (M-01) | Alerta de SLA al 80 % y marcado de vencidos | `Ticket.verificarSla`, `VerificacionSlaService`, `VerificacionSlaProgramada` (`@Scheduled`) |
| RF-10 (M-02) | Avisos de creación, asignación, resolución y SLA | `NotificacionPort`, `Notificacion`, `NotificacionRegistroAdapter` (log) |
| RF-12 (M-03) | Reportes para el ADMIN: resumen, cumplimiento de SLA, desempeño por técnico | `ReporteService`, `ReporteQueryPort` → `ReporteJpaAdapter`, `MedicionSla`, `GET /api/reportes/{resumen,sla,tecnicos}` |

No incluidos en este avance: canales de aviso en tiempo real (correo, Socket.io) y el frontend.
Hoy los avisos de M-02 quedan en el log; cada canal nuevo sería otro adaptador de `NotificacionPort`.

## Ejecutar

```bash
export JWT_SECRET_BASE64=<el mismo secreto Base64 que usa AuthCore>   # nunca en el repositorio
mvn verify                  # pruebas
mvn spring-boot:run         # REST en http://localhost:8082 (H2 en memoria)
```

> Nota (Windows): si `git clone` falla con "Filename too long", ejecuta `git config --system core.longpaths true` o clona con `git clone -c core.longpaths=true`.

Producción: perfil `prod` con `DB_URL`, `DB_USER`, `DB_PASSWORD` como variables de entorno y, opcional, `PORT`. Despliegue en la EC2: [deploy/DESPLIEGUE.md](deploy/DESPLIEGUE.md).

Esquema de la base (M-04): lo crean las migraciones de Flyway en `src/main/resources/db/migration/{h2,mysql}`, una carpeta
por base porque los tipos de fecha difieren. Hibernate solo valida (`ddl-auto: validate`): si una entidad cambia sin su
migración, el servicio no arranca y las pruebas fallan. Un cambio de esquema se hace con un archivo nuevo `V<n>__<descripción>.sql`
en las dos carpetas, nunca editando uno ya aplicado. La primera vez sobre una base que ya tiene tablas (la de la EC2) hay que
adoptarla con un *baseline*: [DESPLIEGUE.md, paso 10](deploy/DESPLIEGUE.md#10-migraciones-de-la-base-flyway-m-04).
Pruebas manuales: `requests.http` (los tokens los emite AuthCore; no los guarde en el repositorio).

## Reglas de negocio clave

- Código `TKT-AAAA-NNNN` (año de Bogotá + consecutivo del año); es el identificador en las rutas.
- Asignación: entre los técnicos de la categoría, el de menos tickets vigentes **en esa categoría**; empate → menor nombre. Sin técnicos → `ABIERTO` sin técnico.
- Política de asignación (M-07, Strategy): la regla anterior es la de por defecto (`negocio.asignacion.politica=menor-carga`). Con `menos-criticos` (en la EC2, `NEGOCIO_ASIGNACION_POLITICA=menos-criticos`) gana el de menos tickets CRITICA vigentes en la categoría; empate → menos vigentes → menor nombre. `TicketService` solo conoce la interfaz `PoliticaAsignacion`.
- Ciclo: `asignado → en_proceso ⇄ en_espera`, `en_proceso → resuelto → cerrado`. `abierto → asignado` solo asignando un técnico.
- Cambia el estado el técnico asignado o el ADMIN; reabre el dueño o el ADMIN; reasigna solo el ADMIN; ve un ticket su creador, su técnico y el ADMIN.
- Consulta por páginas: `GET /api/tickets?page=0&size=20`. `page` empieza en 0 y `size` va de 1 a 100 (20 si se omite). Sin `page` ni `size` devuelve la lista completa, como antes. La cabecera `X-Total-Count` trae siempre el total que cumple los filtros y la visibilidad. Una página fuera de rango devuelve `[]` con ese total.
- Reabrir: vuelve a `ABIERTO`, sin técnico, con SLA reiniciado (4 h crítica, 8 h alta, 24 h media, 72 h baja).
- Alerta de SLA: cada minuto (`negocio.sla.intervalo-verificacion`, formato ISO-8601) se revisan los tickets vigentes. Al 80 % del plazo se registra una alerta y al 100 % se marca vencido, cada una una sola vez por SLA y como línea del historial (`por: sistema`), sin cambiar estado ni técnico. Reabrir reinicia ambas marcas. Columnas nuevas en `ticket`: `alerta_sla_en` y `sla_vencido_en`, que admiten null; las agrega la migración `V2__marcas_sla` sin tocar los datos.
- Notificaciones: se avisa al crear, al asignar o reasignar, al resolver y en las alertas y vencimientos de SLA. El aviso sale después de guardar; si el canal falla, la operación no se deshace. Canal actual: una línea de log por aviso (en la EC2, `journalctl -u domain-service`), sin saltos de línea del texto del usuario.
- Reportes (solo ADMIN; USER y TECNICO reciben 403):
  - `GET /api/reportes/resumen`: totales por estado, prioridad y categoría; vigentes, sin asignar y vencidos sin resolver.
  - `GET /api/reportes/sla`: cumplimiento total y por prioridad (`resueltos`, `dentroDelPlazo`, `fueraDelPlazo`, `porcentaje` con un decimal o `null` si no hay qué medir), más vigentes vencidos y en riesgo (más del 80 % del plazo).
  - `GET /api/reportes/tecnicos`: por técnico registrado, sus vigentes, su cumplimiento y los minutos promedio de resolución.

  Cumple el SLA el ticket cuya última resolución fue antes de vencer su SLA vigente; uno reabierto se mide con su nuevo plazo.
- Errores: 400 datos inválidos · 401 sin token válido · 403 sin permiso · 404 no existe · 409 transición no permitida/duplicado/concurrencia · 405 método no permitido · 415 tipo de contenido no soportado · 422 otra regla · 500 error interno.
  - Una ruta que no existe responde 401 sin token y 404 con token; nunca 403.
  - Orden en que se evalúan: datos (400) → el ticket existe (404) → permiso (403) → regla de estado (409). Dos excepciones: reasignar comprueba el rol ADMIN antes de leer el cuerpo, y reabrir comprueba el permiso antes de exigir el motivo. Sin permiso y con el cuerpo vacío, ambas dan 403, no 400.
  - `POST /api/tecnicos` responde 201 con `Location: /api/tecnicos/{username}`, y esa ruta existe (solo ADMIN).
- Concurrencia: `@Version` en las entidades y restricciones únicas (código, usuario del técnico) como última defensa.
- Consecutivo del código (M-06): sale del contador de su año (tabla `contador_ticket`, migración V3), que se bloquea con `SELECT … FOR UPDATE` mientras se crea el ticket. Dos creaciones simultáneas no reciben el mismo número ni fallan: la segunda espera a la primera. La fila `anio = 0` es el candado para crear el contador de un año nuevo.

## Integración con el AuthCore desplegado y diferencias justificadas

El servicio valida los JWT del AuthCore **desplegado** (repositorio `nubwiapp/login`, Taller 2, EC2 con Java 21, puerto 8080), no el
AuthCore Java del grupo (`tickets-ti/authcore/`). La validación es local, con la clave compartida; nunca se llama al AuthCore.
Una copia del desplegado, sin secretos, está en [`../authcore-desplegado/`](../authcore-desplegado/README.md): allí se documentan su origen (commit `70a6901`), sus variables de entorno, el formato del JWT y los detalles pendientes del dueño.
La tabla resume dónde se separa lo desplegado de la guía del curso:

| Lo que pide el curso | Lo desplegado | Justificación |
|---|---|---|
| JWT firmado con HS384 | HS256 | El validador acepta HS256, HS384 y HS512: el algoritmo lo indica la cabecera del token y la clave debe tener la longitud mínima que exige. |
| Claims `roles[]` y `uid` | Claim `role` (texto, p. ej. `ROLE_ADMIN`), sin `uid` | Se normaliza el prefijo `ROLE_`. `uid` no se usa en ninguna regla, así que su ausencia no afecta a la autorización. El validador lee `roles[]` y `role`, sin duplicados. |
| HU-1 y HU-3: alta de usuarios y asignación de roles por endpoint | Sin esos endpoints | El AuthCore desplegado (Taller 2) solo expone `POST /api/auth/login`. Los usuarios y roles se crean por SQL en la tabla `users`. El AuthCore del grupo sí implementa esos endpoints, pero no es el desplegado; además valida contraseña mínima de 6 caracteres y no exige email único. |

Despliegue en la misma EC2 del AuthCore, paso a paso: [deploy/DESPLIEGUE.md](deploy/DESPLIEGUE.md).
Unidad systemd y ejemplo de variables: `deploy/domain-service.service` y `deploy/domain-service.env.example`.

## Pendiente para el grupo

1. La evidencia de `mvn verify` ya está en el PR #7.
2. Si se quiere, un canal de aviso real (correo o Socket.io) como otro adaptador de `NotificacionPort`. El resto del backlog (M-08 a M-10) está en `PENDIENTES.md`.

El orden de trabajo, el backlog completo de mejoras (M-01 a M-10), las decisiones abiertas y la ruta de limpieza del repositorio están en
[`../PENDIENTES.md`](../PENDIENTES.md) y [`../LIMPIEZA_REPO.md`](../LIMPIEZA_REPO.md).

No incluye credenciales ni secretos: todo llega por variables de entorno.
