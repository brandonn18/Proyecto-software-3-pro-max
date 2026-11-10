# Domain Service — Tickets TI (Ingeniería del Software III, Universidad de Pamplona)

Servicio de dominio que se apoya en **AuthCore** (JWT HS384) para autenticar. Gestiona tickets de soporte:
creación con asignación automática al técnico con menos carga, ciclo de estados, reapertura, reasignación,
SLA por prioridad y consulta según el rol.

Paquete base: `com.ticketsti.soporte` · Java 17 · Spring Boot 3.5.6 · Maven · H2 (dev) / MySQL (prod) · JUnit 5.

> El grupo construyó su propia versión del domain service en Node.js. Este proyecto es el **material de clase** con el
> estándar del curso (Java/Spring), para comparar la misma arquitectura hexagonal con otra tecnología.

## Estado honesto

| Parte | Estado |
|---|---|
| Dominio + aplicación | Compilado y probado con pruebas unitarias |
| Infraestructura (Spring, JPA, REST, seguridad) | Ejecutada y probada: `mvn verify` corre las pruebas Spring (contrato JPA, unicidad, REST de punta a punta con JWT) |
| Salud y puerto | `GET /api/health` público (`{"status":"UP"}`); `PORT` define `server.port` (por defecto 8082) |

## Arquitectura (hexagonal)

```
domain/          Ticket, Tecnico, Actor, estados, PoliticaAsignacion, PoliticaAcceso, excepciones
application/     casos de uso (TicketUseCase, TecnicoUseCase), servicios, puertos de salida
infrastructure/  adaptadores: REST (in), JPA (out), seguridad JWT, configuración
```

`domain` y `application` no importan Spring ni JPA (lo verifica `ArquitecturaHexagonalTest`). La transacción se pide por el
puerto `TransaccionPort`; el reloj se inyecta (`Clock`); los permisos viven en `PoliticaAcceso`, no en los controladores.

## Historias de usuario → código

| HU | Qué hace | Dónde |
|---|---|---|
| HU-1..7 | Autenticación AuthCore | `infrastructure/security` (valida el JWT) |
| HU-8 | Crear ticket + asignación automática (+ técnicos y categorías) | `TicketService.crear`, `PoliticaAsignacion`, `POST /api/tickets`, `/api/tecnicos` |
| HU-9 | Cambiar estado con ciclo e historial | `EstadoTicket.siguientes`, `Ticket.cambiarEstado`, `PATCH /api/tickets/{codigo}/status` |
| HU-10 | Reabrir con motivo y SLA reiniciado | `Ticket.reabrir`, `POST /api/tickets/{codigo}/reopen` |
| HU-11 | Reasignar | `Ticket.asignarA`, `POST /api/tickets/{codigo}/assign` |
| HU-12 | Consultar según rol, con filtros | `TicketService.consultar`, `GET /api/tickets`, `GET /api/tickets/{codigo}` |

No incluidos en este avance: alerta de SLA al 80 % (tarea programada), notificaciones en tiempo real y reportes
(RF-09 parcial, RF-10 y RF-12 del grupo). Se proponen como ejercicios.

## Ejecutar

```bash
export JWT_SECRET_BASE64=<el mismo secreto Base64 que usa AuthCore>   # nunca en el repositorio
mvn verify                  # pruebas
mvn spring-boot:run         # REST en http://localhost:8082 (H2 en memoria)
```

Producción: perfil `prod` con `DB_URL`, `DB_USER`, `DB_PASSWORD` como variables de entorno y, opcional, `PORT`. Despliegue en la EC2: [deploy/DESPLIEGUE.md](deploy/DESPLIEGUE.md).
Pruebas manuales: `requests.http` (los tokens los emite AuthCore; no los guarde en el repositorio).

## Reglas de negocio clave

- Código `TKT-AAAA-NNNN` (año de Bogotá + consecutivo del año); es el identificador en las rutas.
- Asignación: entre los técnicos de la categoría, el de menos tickets vigentes **en esa categoría**; empate → menor nombre. Sin técnicos → `ABIERTO` sin técnico.
- Ciclo: `asignado → en_proceso ⇄ en_espera`, `en_proceso → resuelto → cerrado`. `abierto → asignado` solo asignando un técnico.
- Cambia el estado el técnico asignado o el ADMIN; reabre el dueño o el ADMIN; reasigna solo el ADMIN; ve un ticket su creador, su técnico y el ADMIN.
- Reabrir: vuelve a `ABIERTO`, sin técnico, con SLA reiniciado (4 h crítica, 8 h alta, 24 h media, 72 h baja).
- Errores: 400 datos inválidos · 403 sin permiso · 404 no existe · 409 transición no permitida/duplicado/concurrencia · 405 método no permitido · 415 tipo de contenido no soportado · 422 otra regla · 500 error interno.
- Concurrencia: `@Version` en las entidades y restricciones únicas (código, usuario del técnico) como última defensa.

## Integración con el AuthCore desplegado y diferencias justificadas

El servicio valida los JWT del AuthCore **desplegado** (repositorio del Taller 2, EC2 con Java 21, puerto 8080), no el
AuthCore Java del grupo (`tickets-ti/authcore/`). La validación es local, con la clave compartida; nunca se llama al AuthCore.
La tabla resume dónde se separa lo desplegado de la guía del curso:

| Lo que pide el curso | Lo desplegado | Justificación |
|---|---|---|
| JWT firmado con HS384 | HS256 | El validador acepta HS256, HS384 y HS512: el algoritmo lo indica la cabecera del token y la clave debe tener la longitud mínima que exige. |
| Claims `roles[]` y `uid` | Claim `role` (texto, p. ej. `ROLE_ADMIN`), sin `uid` | Se normaliza el prefijo `ROLE_`. `uid` no se usa en ninguna regla, así que su ausencia no afecta a la autorización. El validador lee `roles[]` y `role`, sin duplicados. |
| HU-1 y HU-3: alta de usuarios y asignación de roles por endpoint | Sin esos endpoints | El AuthCore desplegado (Taller 2) solo expone `POST /api/auth/login`. Los usuarios y roles se crean por SQL en la tabla `users`. El AuthCore del grupo sí implementa esos endpoints, pero no es el desplegado; además valida contraseña mínima de 6 caracteres y no exige email único. |

Despliegue en la misma EC2 del AuthCore, paso a paso: [deploy/DESPLIEGUE.md](deploy/DESPLIEGUE.md).
Unidad systemd y ejemplo de variables: `deploy/domain-service.service` y `deploy/domain-service.env.example`.

## Pendiente para el grupo

1. Adjuntar la evidencia de `mvn verify` (incluye `TicketsRestTest`).
2. Implementar como ejercicio la tarea de SLA al 80 % y los reportes.

No incluye credenciales ni secretos: todo llega por variables de entorno.
