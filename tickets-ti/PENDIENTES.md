# Pendientes y hoja de ruta — Tickets TI

Documento de traspaso para quien continúe el proyecto (persona o Claude Code). Escrito el 2026-11-22.
**Mantenlo al día:** al terminar una tarea marca `[x]` y anota el PR. Las reglas de trabajo están en [CLAUDE.md](CLAUDE.md);
la ruta para ordenar el repositorio está en [LIMPIEZA_REPO.md](LIMPIEZA_REPO.md).

## 1. Estado actual

| Tema | Estado |
|---|---|
| Entregable | `domain-service-java/` (HU-8 a HU-12), Java 17 · Spring Boot 3.5.6 · hexagonal. |
| Rama / PR | **PR #7 mezclado a `main`** con *merge commit* el 2026-11-26. Se conserva la rama `feat/domain-service-java`. |
| Pruebas | Última corrida local (2026-11-26, Temurin 17.0.21.1 + Maven 3.9.16, commit `41ed55f`): **115 pruebas, 0 fallos, 0 errores, 0 omitidas**. Evidencia en el PR #7. Con M-01 (PR #8): **138 pruebas**, todas en verde. Con M-02 (PR #9): **149 pruebas**, todas en verde. Con M-03 (PR #10): **169 pruebas**, todas en verde. Con M-04 (PR #11): **171 pruebas**, todas en verde. Con M-05 (PR #12): **181 pruebas**, todas en verde. Con M-06 (PR #13): **184 pruebas**, todas en verde. Con M-07 (PR #14): **192 pruebas**, todas en verde. |
| AuthCore | El que valida el servicio es el **desplegado** (repositorio `nubwiapp/login`, Taller 2, EC2). Solo expone `POST /api/auth/login`. **No está versionado en este repositorio** (ver fase B). |
| Fuera del entregable | Frontend React (ver sección 5). Ya están hechas M-01 (alerta de SLA al 80 %), M-02 (notificaciones; por ahora el único canal es el log) y M-03 (reportes para el ADMIN). |
| Código histórico | `backend/`, `domain-service/`, `frontend/`, `authcore/` (el del grupo), `infra/`, `herramientas/`, `nginx/`: siguen en el repositorio y deben ordenarse (sección 6). |

## 2. Cómo empezar

```bash
git clone https://github.com/brandonn18/Proyecto-software-3-pro-max.git
cd Proyecto-software-3-pro-max
git config core.longpaths true            # Windows: evita "Filename too long"
git switch main                           # el PR #7 ya está mezclado; feat/domain-service-java queda igual a main
cd tickets-ti/domain-service-java
mvn verify                                # requiere JDK 17 y Maven 3.9+
```

- `mvn verify` no debería pedir `JWT_SECRET_BASE64` (las pruebas REST inyectan su propia clave de prueba). Solo
  `mvn spring-boot:run` la necesita: la clave real la entrega el dueño del AuthCore, **nunca** se escribe en un archivo versionado.
- Lectura obligatoria, en este orden: [CLAUDE.md](CLAUDE.md) → [domain-service-java/README.md](domain-service-java/README.md) →
  este archivo. Para desplegar: [domain-service-java/deploy/DESPLIEGUE.md](domain-service-java/deploy/DESPLIEGUE.md).
- Pruebas manuales: `domain-service-java/requests.http` y la colección de Postman en `domain-service-java/deploy/postman/`.
- Los README raíz, `COVERAGE_REPORT.md` y `MANUAL_TEST_GUIDE.md` describen el monolito Node antiguo: no son fuente de verdad.

**Prompt sugerido para abrir Claude Code** (desde la raíz del repositorio):

> Lee `tickets-ti/CLAUDE.md` y `tickets-ti/PENDIENTES.md`. Resume en 5 líneas el estado y propón la siguiente tarea de la
> sección 3. No toques nada fuera del alcance de esa tarea ni hagas push sin que te lo pida.

## 3. Orden de trabajo

El orden importa: **A** bloquea a **C**; **B** bloquea el archivado de `authcore/`; **D** puede avanzar en paralelo en ramas propias.

| Fase | Qué | Depende de |
|---|---|---|
| A | Cerrar la entrega (PR #7) | — |
| B | Versionar el AuthCore desplegado sin secretos | Visto bueno del dueño del AuthCore |
| C | Ordenar y limpiar el repositorio | A mezclado + acuerdo del equipo y del profesor (sección 7) |
| D | Mejoras del domain service | A (para partir de `main` actualizado) |
| E | Documentación pendiente | — |

### A. Cerrar la entrega (PR #7)

- [ ] El equipo revisa el PR.
- [x] Ejecutar `mvn verify` y adjuntar la evidencia al PR (el profesor la pidió: "pruebas sin evidencia adjunta"). Hecho el 2026-11-26: comentario en el PR #7.
- [ ] Lista de verificación de la guía del profesor (sección 9 de `Guia_Domain_Service_TicketsTI.pdf`):
  - [ ] Los cinco casos de uso probados con tokens ADMIN, TECNICO y USER, incluidos los 403. Las pruebas automáticas ya los cubren (`TicketsRestTest`, `TokenAuthCoreDesplegadoRestTest`); falta la prueba con tokens reales (paso 8 de `DESPLIEGUE.md`).
  - [ ] El técnico registrado en este servicio tiene el mismo `username` que en el AuthCore y rol `ROLE_TECNICO`.
  - [ ] El secreto no aparece en archivos versionados ni en capturas; las capturas de la nube no muestran IP públicas ni IDs de cuenta. Archivos versionados e historial revisados el 2026-11-26, sin hallazgos; faltan las capturas.
  - [ ] Poder explicar por qué `domain` no importa Spring y dibujar el recorrido de `POST /api/tickets` nombrando la clase de cada paso.
- [x] Mezclar a `main` con *merge commit*, como los PR anteriores (#1 a #6). PR #7, 2026-11-26.

### B. Versionar el AuthCore desplegado sin secretos

**No modificar la EC2 ni el repositorio `nubwiapp/login`.** Todo cambio que altere el comportamiento del desplegado se confirma antes con su dueño.

1. [ ] Pedir al dueño el visto bueno para incluir su código en este repositorio.
2. [ ] Clonar `https://github.com/nubwiapp/login.git` **fuera** de este repositorio y copiar el código (sin `.git` ni `build/`) a `tickets-ti/authcore-desplegado/`. Es Gradle, Java 21, Spring Boot 3.4.1, paquete `com.login`, hexagonal. Una sola copia, sin historial, para no arrastrar secretos.
3. [ ] **Antes de `git add`**: su `src/main/resources/application.yaml` trae por defecto un usuario/clave de base de datos y un `jwt.secret` en claro. Sustituirlos por `${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}` y `${JWT_SECRET}` **sin valor por defecto** (que falle al arrancar si faltan, como hace este servicio).
4. [ ] Preguntar al dueño si el secreto real de la EC2 coincide con el del repositorio público. Si coincide, está comprometido: debe rotarlo en el AuthCore **y** en `/etc/domain-service.env` del domain service, y reiniciar ambos (los tokens vigentes dejan de valer).
5. [ ] Escribir `tickets-ti/authcore-desplegado/README.md`: variables de entorno, cómo compilar (`./gradlew test`), `POST /api/auth/login`, formato del JWT (HS256, claims `sub`, `role`, `iat`, `exp`) y cómo crear usuarios por SQL (ver paso 7 de `DESPLIEGUE.md`).
6. [ ] Revisar con el dueño, uno por uno, estos detalles verificados el 2026-11-22 en el código desplegado. Cada uno cambia comportamiento:

   | Detalle | Hoy | Propuesta |
   |---|---|---|
   | Error 500 | `GlobalExceptionHandler` responde `"Error interno del servidor: " + ex.getMessage()` | Mensaje genérico; el detalle solo al log. |
   | Swagger | `/swagger-ui/**` y `/v3/api-docs/**` son públicos | Cerrarlos o dejarlos solo en desarrollo. |
   | CORS | Sin configuración | Definir orígenes permitidos si habrá frontend. |
   | Registro de SQL | `show-sql: true`; niveles `DEBUG` en `com.login` y Spring Security; `org.hibernate.type.descriptor.sql.BasicBinder: TRACE` (escribe los parámetros de las consultas) | `INFO`/`WARN` en producción. |
   | Esquema | `ddl-auto: update` | `validate` + migraciones. |
   | Vigencia del token | 24 h (`jwt.expiration`) | Evaluar una vigencia más corta (el domain service no revoca tokens). |
   | Claim `role` | Existe, pero no está documentado | Documentarlo en el README del AuthCore. |

7. [ ] Actualizar `CLAUDE.md` y `domain-service-java/README.md` para que apunten a `authcore-desplegado/`.

### C. Ordenar y limpiar el repositorio

Detalle completo en [LIMPIEZA_REPO.md](LIMPIEZA_REPO.md) (resumen en la sección 6). No empezar sin cerrar A y sin las decisiones 1 y 2 de la sección 7.

### D. Mejoras del domain service

Una mejora = una rama `feat/<nombre>` y un PR propio. Siempre: prueba primero, `mvn verify` en verde (incluye `ArquitecturaHexagonalTest`),
`domain` y `application` sin Spring ni JPA, reloj inyectado (`Clock`), permisos en `PoliticaAcceso`. Si cambia una regla de negocio,
actualizar `CLAUDE.md` y el README del servicio en el mismo PR.

Orden sugerido (de más a menos valor para la entrega; las tres primeras salen del Excel y de la guía del profesor):

| ID | Mejora | Origen | Dónde | Terminado cuando |
|---|---|---|---|---|
| M-01 | [x] **Alerta de SLA al 80 % y marcado de vencidos.** Caso de uso `VerificarSla`, disparado por un adaptador de entrada programado (`@Scheduled`). **Hecho el 2026-11-26, PR #8**: `VerificarSlaUseCase` → `VerificacionSlaService` → `Ticket.verificarSla`, adaptador `adapters/in/programacion/VerificacionSlaProgramada`. Para no alertar dos veces, el ticket guarda las marcas `alertaSlaEn` y `slaVencidoEn`; reabrir las reinicia. | RF-09; guía §9 (nivel medio) | `application/port/in`, `application/service`, adaptador en `infrastructure/adapters/in` | Pruebas con `RelojAjustable` para 79 %, 80 % y vencido; decidir y probar cómo evitar alertar dos veces el mismo ticket. Cubierto por `SlaTicketTest`, `VerificacionSlaServiceTest`, `VerificacionSlaIntegracionTest` y el contrato del repositorio. |
| M-02 | [x] **Puerto `NotificacionPort`** con un adaptador que registre la creación, la asignación, la resolución y las alertas de M-01. Socket.io o correo serían adaptadores posteriores. **Hecho el 2026-11-26, PR #9**: `TicketService` y `VerificacionSlaService` avisan por el puerto después de guardar, y una falla del canal no deshace la operación. El adaptador `adapters/out/notificacion/NotificacionRegistroAdapter` escribe una línea de log por aviso y quita los saltos de línea del texto del usuario. A quién avisar lo decide cada canal. | RF-10; guía §9 | `application/port/out`, adaptador en `infrastructure` | Se notifica en los tres eventos; los servicios no conocen el adaptador. Cubierto por `NotificacionesTest`, `NotificacionRegistroAdapterTest` y `VerificacionSlaIntegracionTest`. |
| M-03 | [x] **Reportes**: resumen, cumplimiento de SLA y desempeño por técnico, solo ADMIN, con su propio puerto de solo lectura. **Hecho el 2026-11-26, PR #10**: `GET /api/reportes/resumen`, `/sla` y `/tecnicos` → `ReporteUseCase` → `ReporteService`, sobre `ReporteQueryPort` (adaptador `ReporteJpaAdapter`: una consulta, una fila por ticket con su última resolución). Las reglas de medición (vencido, en riesgo, a tiempo) viven en el dominio, en `MedicionSla`, que también usa `Ticket`. | RF-12; guía §9 (avanzado) | puerto de consulta propio + adaptador JPA + controlador | Cada reporte con prueba de contrato; 403 para USER y TECNICO. Cubierto por `ReporteServiceTest`, `ReporteQueryContractTest` (memoria y JPA), `ReportesRestTest` y `MedicionSlaTest`. |
| M-04 | [x] **Migraciones Flyway** en lugar de `ddl-auto: update` en el perfil `prod`. **Hecho el 2026-11-26, PR #11** (código y pruebas): `V1__esquema_inicial` (lo que hoy tiene la EC2) y `V2__marcas_sla` (columnas de M-01), en `db/migration/mysql` y `db/migration/h2`; Hibernate en `ddl-auto: validate`. En `prod`, contra una base con tablas y sin historial, el servicio no arranca hasta adoptarla con un baseline (`DESPLIEGUE.md`, paso 10). **Falta: que el dueño haga esa adopción en la EC2.** | Limitación conocida (`application-prod.yml`) | `pom.xml`, `src/main/resources/db/migration` | La base de la EC2 ya tiene tablas creadas por `update`: partir de un *baseline*, probar contra una copia y **no** aplicar en la EC2 sin el dueño. Probado contra MySQL 8.0.46 (Docker) con una base creada por la versión desplegada: baseline 1 + V2 conserva los datos; también base vacía y base con las columnas de M-01 (baseline 2). `MigracionesTest` y el resto de las pruebas corren sobre el esquema de Flyway. |
| M-05 | [x] **Paginación** de `GET /api/tickets` (hoy devuelve la lista completa). **Hecho el 2026-11-26, PR #12**, sin romper el contrato: `page` (desde 0) y `size` (1 a 100, 20 por defecto) son opcionales. Sin ellos se devuelve la lista completa, como antes, y `X-Total-Count` va siempre. `TicketUseCase.consultarPagina` → `TicketRepositoryPort.buscar(filtro, paginacion)`; el adaptador JPA corta en la base (`Pageable`: `offset … fetch first` y `count`). | Hallazgo del 2026-11-22 | `TicketController`, `FiltroTicket`, puerto de repositorio | Parámetros de página con tope máximo; pruebas de contrato con doble en memoria y JPA. Cubierto por `TicketRepositoryContractTest` (memoria y JPA), `ConsultaPaginadaTest` y `TicketsPaginadosRestTest`. |
| M-06 | [x] **Consecutivo del código sin reintentos**: hoy es "máximo del año + 1" y bajo concurrencia depende de la restricción única. Usar una secuencia o tabla de contadores. **Hecho el 2026-11-26, PR #13**: tabla `contador_ticket` (migración V3, sembrada con el último consecutivo de cada año) que se bloquea con `SELECT … FOR UPDATE` en la transacción que crea el ticket; la fila `anio = 0` hace de candado para crear el contador de un año nuevo sin pedir otra conexión ni interbloquear. | Guía §7 (limitaciones) y §9 (avanzado) | `TicketRepositoryPort`, adaptador JPA | Prueba con dos hilos creando tickets a la vez sin códigos repetidos ni errores. Cubierto por `CreacionConcurrenteTest` (4 hilos × 15, que antes fallaba) y el contrato del repositorio. También probado contra MySQL 8.0.46: 150 simultáneas sin errores (antes, 24 de 60 con 409) y el primer ticket del año con 16 hilos. |
| M-07 | [x] **Segunda política de asignación** (priorizar a quien tenga menos tickets críticos), sin tocar `TicketService`. **Hecho el 2026-11-26, PR #14**: `PoliticaAsignacion` pasa a ser una interfaz (Strategy) con `AsignacionPorMenorCarga` (la regla confirmada, por defecto) y `AsignacionPorMenosCriticos`; se elige con `negocio.asignacion.politica`. Una sola vez se cambió una línea de `TicketService`, para darle a la política `CargaTecnico` (vigentes y críticos) en vez de solo el número de vigentes; desde ahí, una política nueva no lo toca. | Guía §9 (medio: Strategy/OCP) | `domain/service` | Prueba que cambie la política sin modificar el servicio. Cubierto por `CambioDePoliticaTest` (mismo servicio, otra política, otro técnico), `AsignacionPorMenosCriticosTest`, `PoliticaAsignacionConfigTest` y el contrato del repositorio (`cargaPorTecnico`, en memoria y JPA). |
| M-08 | **Reabrir repitiendo la asignación automática** en vez de dejar el ticket sin técnico. | Alternativa anotada en el Excel | `Ticket.reabrir`, `TicketService` | **Cambia una regla ya confirmada por el grupo**: pedir confirmación al equipo y al profesor antes de empezar. |
| M-09 | **SLA en horario laboral y festivos** (hoy es en horas corridas). | "Se deja a otra entrega" (Excel) | `Prioridad.limiteDesde` | Misma consideración que M-08: confirmar antes. |
| M-10 | Revocación inmediata de tokens. | Guía §5.4 ("mejora futura") | Seguridad | Solo si el equipo lo pide; exige cambios en el AuthCore. |

Ejercicios de práctica de la guía (opcionales): atributo `ubicacion` de punta a punta, prueba de título de dos letras, prueba de dos hilos. Antes de hacerlos, revisar si ya existe una prueba equivalente.

### E. Documentación pendiente

- [ ] Escribir las historias de usuario de los requisitos sin historia propia (RF-06, 09, 10, 11, 12): observación explícita del profesor en el Excel. **Borrador listo (2026-11-26):** [HISTORIAS_DE_USUARIO.md](HISTORIAS_DE_USUARIO.md), con cada criterio ligado a su prueba. Falta que el equipo confirme la numeración (HU-11 y HU-12; HU-13 a HU-15 propuestas, a cotejar con Trello), estime prioridad y dimensión y las pase al Excel.
- [ ] Revisar los documentos del grupo (informes, capturas de AWS) y retirar o difuminar IP públicas e IDs de cuenta antes de compartirlos.
- [ ] Confirmar si ya se resolvió el error de arranque del AuthCore del grupo (`UnsatisfiedDependencyException` en `securityConfig`) que el profesor vio en una captura.
- [ ] Tras la limpieza (fase C): reescribir el `README.md` de la raíz para describir solo `domain-service-java/` y el AuthCore.
- [ ] El README raíz cita `Ing_SoftII`, pero el remoto actual es `Proyecto-software-3-pro-max`; corregirlo en esa reescritura.

## 4. Material que no está en el repositorio

La guía del profesor (`Guia_Domain_Service_TicketsTI.pdf`), el Excel del backlog y los documentos de los talleres viven en la carpeta local del otro autor.
Pídelos o compártanlos por Drive. **Nunca** compartan el `.pem` de la EC2 ni el contenido de `/etc/domain-service.env`.

## 5. Alcance

- Dentro: HU-8 a HU-12. HU-1 a HU-7 son del AuthCore común.
- Fuera por ahora: el frontend. RF-09 (alerta al 80 %) quedó cubierto con M-01, RF-10 (notificaciones) con M-02 y RF-12 (reportes) con M-03. Hoy el aviso va al log; un canal de correo o Socket.io sería otro adaptador de `NotificacionPort`.

## 6. Ordenar y limpiar el repositorio

Está descrito paso a paso, con inventario, comandos, verificaciones y reversión, en [LIMPIEZA_REPO.md](LIMPIEZA_REPO.md).
Resumen: etiqueta de respaldo → una carpeta por commit con `git rm` → actualizar referencias → verificar → PR aparte.

## 7. Decisiones abiertas

Ninguna se resuelve sin confirmación. Anota aquí la respuesta y la fecha.

| # | Decisión | Quién | Respuesta |
|---|---|---|---|
| 1 | ¿Se archiva `authcore/` (el del grupo)? **Ojo:** es la única implementación en el repositorio de HU-1 y HU-3 (registro y asignación de roles); el AuthCore desplegado solo hace login. | Equipo + profesor | — |
| 2 | ¿Se archiva `domain-service/` (Node)? Las ramas `architecture/capas`, `architecture/mvc` y `architecture/oop` se hicieron sobre él. Se borraron el 2026-11-26 y quedan en las etiquetas `archivo/architecture-*` (ver `LIMPIEZA_REPO.md`). | Equipo + profesor | — |
| 3 | ¿Se archiva `frontend/` o alguien lo adapta al contrato del servicio Java? | Equipo | — |
| 4 | ¿Qué detalles de la tabla de la fase B.6 aplica el dueño del AuthCore? | Dueño del AuthCore | — |
| 5 | `Diagramas/` (casos de uso, clases, ER, subidos en abril de 2026). | Juan | **Resuelta (2026-11-22):** pertenecen a otra materia y nada del desarrollo actual depende de ellos. Se retiran en el PR de limpieza (fase C); hasta entonces siguen en `origin` y quedan en la etiqueta de respaldo. Falta el visto bueno de quien los subió. |
| 6 | ¿Se hacen M-08 y M-09, que cambian reglas confirmadas? | Equipo + profesor | — |
