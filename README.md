# Sistema de Gestión de Tickets de Soporte TI

**Ingeniería de Software II — Universidad de Pamplona, 2026**  
Brandon Jair Martínez Ruda · Juan Esteban Basto Dávila

---

## Descripción

Sistema web completo para la gestión de tickets de soporte técnico. Permite registrar, clasificar, asignar y dar seguimiento a incidentes y solicitudes de TI, con control de SLA, notificaciones en tiempo real y dashboards diferenciados por rol.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 18 + Express 4 |
| ORM / DB | Sequelize 6 + PostgreSQL 14 |
| Autenticación | JWT (8h) + bcrypt (12 rondas) |
| Tiempo real | Socket.io 4 |
| Frontend | React 18 + Tailwind CSS |
| Testing | Jest 29 + Supertest + React Testing Library |
| Contenedores | Docker + Docker Compose |

### Arquitectura por servicios (semestre actual)

El monolito (`tickets-ti/backend/`) se está reemplazando por dos servicios:

| Servicio | Tecnología | Responsabilidad |
|---|---|---|
| `tickets-ti/authcore/` | Java 21 + Spring Boot 4, hexagonal + PostgreSQL | Usuarios, login y emisión de JWT (`sub`, `uid`, `roles`) |
| `tickets-ti/domain-service/` | Node.js + Express, hexagonal + PostgreSQL | Tickets, SLA, asignación, notificaciones, Socket.io |

- API de authcore: `POST /api/auth/register`, `POST /api/auth/login` → `{ token }`,
  `GET /api/auth/users` y `POST /api/auth/users/{id}/roles` (solo `ADMIN`).
  Roles: `ADMIN`, `TECNICO`, `USER` (domain-service los traduce a administrador / técnico / usuario).
- domain-service valida el JWT con el mismo `JWT_SECRET` y consulta usuarios por
  `GET /internal/users/{id}` y `GET /internal/tecnicos` (cabecera `X-Internal-Key`).
- Tests de authcore: `cd tickets-ti/authcore && ./gradlew test` (H2 en memoria, sin base de datos).
- Despliegue en dos cuentas de AWS: `tickets-ti/infra/aws/README.md`.

---

## Funcionalidades implementadas

- Registro y clasificación de tickets por tipo, categoría y prioridad
- Asignación automática al técnico con menor carga de trabajo activa
- Ciclo de vida completo: `abierto → asignado → en_proceso ⇄ en_espera → resuelto → cerrado`
- Reapertura de tickets resueltos/cerrados con motivo registrado y SLA reiniciado
- Control de SLA por prioridad (crítica 4h, alta 8h, media 24h, baja 72h) con alerta al 80%
- Notificaciones en tiempo real vía Socket.io (asignación, cambios de estado, alertas SLA)
- Dashboards diferenciados: administrador (global), técnico (sus tickets), usuario (los suyos)
- Bloqueo de cuenta tras 5 intentos fallidos de login (15 minutos)
- Historial de auditoría de todos los cambios de estado
- Soft-delete en todos los modelos (Sequelize `paranoid: true`)
- Sanitización de campos libres con `sanitize-html`

---

## Roles del sistema

| Rol | Capacidades |
|-----|------------|
| **Usuario** | Crear tickets, ver los propios, reabrir resueltos |
| **Técnico** | Ver tickets asignados, cambiar estado, agregar comentarios |
| **Administrador** | Gestión completa: usuarios, tickets, reportes, reasignación |

---

## Estructura del repositorio

```
Ing_SoftII/
├── tickets-ti/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/          # DB, auth, email, Socket.io
│   │   │   ├── controllers/     # auth, tickets, users, notifications, reports, sla
│   │   │   ├── middlewares/     # JWT, roles, errorHandler, rateLimiter
│   │   │   ├── models/          # User, Ticket, Notification, SLAConfig, AuditLog
│   │   │   ├── routes/          # Definición de endpoints
│   │   │   ├── services/        # ticketService, assignmentService, slaService, notificationService
│   │   │   └── utils/           # helpers, validators, idGenerator
│   │   └── tests/
│   │       ├── unit/            # auth, tickets, notifications (53 tests)
│   │       ├── integration/     # ticketLifecycle — flujo E2E (17 tests)
│   │       ├── performance/     # carga concurrente, P95 < 2000ms (3 tests)
│   │       └── acceptance/      # script standalone CP001–CP012
│   ├── frontend/
│   │   └── src/
│   │       ├── pages/           # Login, Tickets, TicketDetail, TicketCreate, Dashboard, Users, Reports
│   │       ├── components/      # Layout, Navbar, Sidebar, Badge, PrivateRoute
│   │       ├── context/         # AuthContext, NotificationContext
│   │       ├── hooks/           # useAuth, useTickets, useNotifications
│   │       └── services/        # api, authService, ticketService, socketService
│   ├── COVERAGE_REPORT.md       # Análisis de cobertura por capa
│   └── MANUAL_TEST_GUIDE.md     # Guía paso a paso para el evaluador
├── docker-compose.yml
└── README.md
```

---

## Instalación y ejecución local

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+

### 1. Clonar y configurar

```bash
git clone https://github.com/brandonn18/Ing_SoftII.git
cd Ing_SoftII
```

### 2. Backend

```bash
cd tickets-ti/backend
npm install
```

Crear el archivo `.env` (existe `.env.example` como referencia):

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tickets_ti
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=clave_secreta_minimo_32_caracteres
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:3000
```

```bash
# Crear tablas y cargar datos iniciales
node src/seeders/seed.js

# Iniciar servidor (puerto 3001)
npm start
```

### 3. Frontend

```bash
cd tickets-ti/frontend
npm install
npm start          # Abre http://localhost:3000
```

---

## Ejecución con Docker

```bash
cd tickets-ti
docker-compose up --build
```

Servicios levantados:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- PostgreSQL: puerto `5432`

---

## Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@empresa.com` | `Admin123!` |
| Técnico 1 | `tecnico1@empresa.com` | `Tecnico123!` |
| Técnico 2 | `tecnico2@empresa.com` | `Tecnico123!` |
| Usuario | `usuario1@empresa.com` | `Usuario123!` |

---

## Suite de pruebas

```bash
# Tests unitarios e integración (90 tests)
cd tickets-ti/backend
npm test

# Reporte de cobertura
npm run test:coverage

# Script de aceptación autónomo — verifica CP001-CP012
npm run acceptance

# Tests de componentes React (22 tests)
cd tickets-ti/frontend
npm test -- --watchAll=false
```

**Resultados:** 112 tests en total — 90 backend + 22 frontend, todos pasando.

| Suite | Tests | Estado |
|-------|-------|--------|
| Unit — auth | 14 | PASS |
| Unit — tickets | 27 | PASS |
| Unit — notifications | 12 | PASS |
| Integration — ticketLifecycle | 17 | PASS |
| Performance — load | 3 | PASS |
| Frontend — TicketList | 12 | PASS |
| Frontend — LoginForm | 10 | PASS |

---

## API — Endpoints principales

| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| POST | `/api/auth/login` | Autenticación | Público |
| GET | `/api/auth/me` | Usuario autenticado | Autenticado |
| GET | `/api/tickets` | Listar tickets (filtros, paginación) | Autenticado |
| POST | `/api/tickets` | Crear ticket | Autenticado |
| GET | `/api/tickets/:id` | Detalle de ticket | Autenticado |
| PATCH | `/api/tickets/:id/status` | Cambiar estado | Técnico / Admin |
| POST | `/api/tickets/:id/reopen` | Reabrir ticket | Usuario / Admin |
| POST | `/api/tickets/:id/assign` | Reasignar técnico | Admin |
| GET | `/api/reports/summary` | Resumen global | Admin |
| GET | `/api/reports/my-dashboard` | Dashboard técnico | Técnico |
| GET | `/api/notifications` | Notificaciones del usuario | Autenticado |
| POST | `/api/users` | Crear usuario | Admin |

Todas las rutas protegidas requieren `Authorization: Bearer <token>`.

---

## Documentación del proyecto

| Artefacto | Ubicación |
|-----------|-----------|
| Plan de pruebas y gestión de riesgos | `tickets-ti/COVERAGE_REPORT.md` |
| Guía de pruebas manuales (evaluador) | `tickets-ti/MANUAL_TEST_GUIDE.md` |
| Script de aceptación CP001-CP012 | `tickets-ti/backend/tests/acceptance/acceptanceTests.js` |
---

## Casos de prueba cubiertos

| CP | Descripción | Prioridad |
|----|-------------|-----------|
| CP001 | Registro de ticket con ID único `TKT-YYYY-NNNN` | Alta |
| CP002 | Clasificación por las 5 categorías del sistema | Alta |
| CP003 | Asignación automática al técnico con menor carga | Alta |
| CP004 | Cambio de estado con transiciones válidas e inválidas | Alta |
| CP005 | Reapertura de ticket resuelto con motivo y nuevo SLA | Media |
| CP006 | Notificación generada al asignar ticket (≤ 5 min) | Media |
| CP007 | Login con JWT, sin password en respuesta, token inválido → 401 | Alta |
| CP008 | Bloqueo de cuenta tras 5 intentos fallidos | Alta |
| CP009 | Dashboard diferenciado según rol (admin / técnico / usuario) | Media |
| CP010 | Alerta SLA al 80% del tiempo consumido | Alta |
| CP011 | Creación de usuario por administrador, email duplicado → 409 | Media |
| CP012 | Cierre de ticket resuelto, transición inválida → 400 | Media |
