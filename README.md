# Sistema de Gestión de Tickets de Soporte TI

**Ingeniería del Software III — Universidad de Pamplona, 2026**
Brandon Jair Martínez Ruda · Juan Esteban Basto Dávila

Sistema para registrar, asignar y dar seguimiento a incidentes y solicitudes de soporte TI, con control de SLA por
prioridad, avisos y reportes de gestión. El entregable vigente es
**[`tickets-ti/domain-service-java/`](tickets-ti/domain-service-java/README.md)**: un *domain service* en Java 17 y
Spring Boot 3.5.6 con arquitectura hexagonal, que valida localmente los JWT del AuthCore.

Para continuar el trabajo, el punto de partida es [`tickets-ti/PENDIENTES.md`](tickets-ti/PENDIENTES.md), con el estado y
la hoja de ruta. Las reglas de trabajo, arquitectura y negocio están en [`tickets-ti/CLAUDE.md`](tickets-ti/CLAUDE.md).

## Servicios

| Servicio | Dónde | Tecnología | Qué hace |
|---|---|---|---|
| **Domain service** (entregable) | `tickets-ti/domain-service-java/`, puerto 8082 | Java 17, Spring Boot 3.5.6, Maven; H2 en desarrollo y MySQL (RDS) en producción; esquema con Flyway | Tickets, asignación automática, ciclo de estados, reapertura, reasignación, consulta por rol y por páginas, SLA y alertas, avisos, reportes |
| **AuthCore desplegado** | Repositorio `nubwiapp/login` (Taller 2), en la EC2, puerto 8080. **No está versionado aquí** (fase B de `PENDIENTES.md`) | Java 21, Spring Boot, MySQL | `POST /api/auth/login`: emite el JWT (HS256, claim `role`) que valida el domain service |
| **AuthCore del grupo** | `tickets-ti/authcore/`, puerto 8081 | Java 21, Spring Boot 4.1, Gradle, PostgreSQL | Login, registro y asignación de roles (HU-1 y HU-3). No es el desplegado |

## Qué hace el domain service

- **HU-8 a HU-12:** crear un ticket con código `TKT-AAAA-NNNN` y asignación automática al técnico con menos carga,
  ciclo de estados, reapertura con motivo, reasignación y consulta según el rol.
- **Mejoras M-01 a M-07:**
  - M-01: alerta al consumir el 80 % del SLA y marcado de vencidos.
  - M-02: avisos por un puerto de notificaciones.
  - M-03: reportes para el administrador.
  - M-04: migraciones Flyway.
  - M-05: paginación.
  - M-06: consecutivo sin choques bajo concurrencia.
  - M-07: política de asignación intercambiable.
- Detalle de reglas, endpoints y diseño: [README del servicio](tickets-ti/domain-service-java/README.md).

## Cómo empezar

```bash
git clone https://github.com/brandonn18/Proyecto-software-3-pro-max.git
cd Proyecto-software-3-pro-max
git config core.longpaths true                    # Windows: evita «Filename too long»
cd tickets-ti/domain-service-java
mvn verify                                        # requiere JDK 17 y Maven 3.9+
export JWT_SECRET_BASE64=<CLAVE_COMPARTIDA>       # la misma del AuthCore; nunca en el repositorio
mvn spring-boot:run                               # http://localhost:8082, H2 en memoria
```

- Producción y despliegue en la EC2: [`deploy/DESPLIEGUE.md`](tickets-ti/domain-service-java/deploy/DESPLIEGUE.md).
  Antes del primer despliegue con Flyway hay que seguir su paso 10.
- Pruebas manuales: `requests.http` y la colección de Postman en `tickets-ti/domain-service-java/deploy/postman/`.
- AuthCore del grupo en local: `cd tickets-ti && docker compose up -d`. Necesita `tickets-ti/.env` (ver `.env.example`) y
  `authcore/.env`.

## Estructura del repositorio

```
README.md · CLAUDE.md
tickets-ti/
├── domain-service-java/     entregable: código, pruebas, deploy/ (runbook, systemd, Postman), requests.http
├── authcore/                AuthCore Java del grupo (no es el desplegado)
├── PENDIENTES.md            estado, hoja de ruta por fases, backlog de mejoras, decisiones abiertas
├── CLAUDE.md                reglas de trabajo, arquitectura, reglas de negocio e integración con el AuthCore
├── HISTORIAS_DE_USUARIO.md  historias de RF-06, RF-09 a RF-12 (borrador para el Excel)
├── LIMPIEZA_REPO.md         cómo se retiró el código histórico y cómo recuperarlo
└── docker-compose.yml       entorno local del AuthCore del grupo
```

## Pruebas

`mvn verify` corre las pruebas de dominio, aplicación, contrato (memoria y JPA), REST, integración, concurrencia y la
regla de arquitectura hexagonal (ArchUnit). El 2026-11-26 eran **192 pruebas, todas en verde**. La evidencia está en
los PR #7 a #14.

## Código histórico

El 2026-11-26, con la aprobación del equipo y del profesor, se retiró lo que ya no se usaba:

- el monolito Node/Express y sus herramientas;
- el domain service Node;
- el frontend React con su nginx;
- las plantillas ECS de AWS, que no eran lo desplegado;
- los documentos del monolito;
- los diagramas de otra materia.

Todo sigue en el historial:

```bash
git checkout archivo/pre-limpieza-2026-11 -- tickets-ti/backend        # recupera una carpeta
git switch -c estado-anterior archivo/pre-limpieza-2026-11             # abre el estado completo de antes
git switch -c architecture/capas archivo/architecture-capas            # variantes por arquitectura (capas, mvc, oop)
```
