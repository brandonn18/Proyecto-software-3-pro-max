# Sistema de Gestión de Tickets de Soporte TI

> **Documento histórico.** Describe el monolito Node/Express y el stack Docker anteriores, que ya no son el entregable. El entregable vigente es [`domain-service-java/`](domain-service-java/README.md). Estado y próximos pasos: [`PENDIENTES.md`](PENDIENTES.md) · Reglas de trabajo: [`CLAUDE.md`](CLAUDE.md).

Sistema web para gestión de incidentes y solicitudes de soporte técnico, desarrollado como proyecto de **Ingeniería de Software II** — Universidad de Pamplona.

**Autores:** Brandon Jair Martínez Ruda · Juan Esteban Basto Dávila  
**Repositorio:** https://github.com/brandonn18/Ing_SoftII/

---

## Descripción

Plataforma que permite a usuarios reportar tickets de soporte, a técnicos gestionarlos con ciclo de vida completo, y a administradores supervisar el sistema con dashboards en tiempo real. Incluye alertas SLA automáticas, notificaciones via Socket.io y reportes por rol.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 18 + Express 4 |
| ORM | Sequelize 6 + PostgreSQL 15 |
| Autenticación | JWT (8h) + bcrypt (12 rounds) |
| Tiempo real | Socket.io 4 |
| Frontend | React 18 + Tailwind CSS 3 |
| Gráficas | Recharts |
| Tests | Jest + Supertest |
| Contenedores | Docker + Docker Compose |

---

## Requisitos previos

- **Node.js** 18+
- **PostgreSQL** 15+ (sin Docker)
- **Docker** 24+ y **Docker Compose** v2 (con Docker)
- **npm** 9+

---

## Instalación y puesta en marcha

### Opción A — Con Docker (recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/brandonn18/Ing_SoftII.git
cd Ing_SoftII/tickets-ti

# 2. Copiar y configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores

# 3. Levantar todos los servicios
npm run docker:up

# 4. Cargar datos iniciales (primera vez)
docker exec tickets_backend node src/seeders/seed.js

# La app estará en: http://localhost:80
```

Comandos Docker útiles:
```bash
npm run docker:logs    # Ver logs en tiempo real
npm run docker:down    # Detener contenedores
npm run docker:reset   # Resetear todo (borra volúmenes)
```

### Opción B — Sin Docker (desarrollo local)

```bash
# 1. Clonar repositorio
git clone https://github.com/brandonn18/Ing_SoftII.git
cd Ing_SoftII/tickets-ti

# 2. Instalar dependencias
npm run install:all

# 3. Configurar entorno del backend
cp backend/.env.example backend/.env
# Editar backend/.env con credenciales de tu PostgreSQL local

# 4. Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE tickets_ti;"

# 5. Ejecutar migraciones y seeders
npm run migrate
npm run seed

# 6. Iniciar en modo desarrollo (backend + frontend en paralelo)
npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:3000
```

---

## Variables de entorno

Copia `backend/.env.example` a `backend/.env` y completa los valores:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del backend | `3001` |
| `NODE_ENV` | Entorno | `development` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_NAME` | Nombre de la BD | `tickets_ti` |
| `DB_USER` | Usuario PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña PostgreSQL | `postgres` |
| `JWT_SECRET` | Clave secreta JWT (mín. 32 chars) | — |
| `JWT_EXPIRES_IN` | Expiración del token | `8h` |
| `EMAIL_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `EMAIL_USER` | Email remitente | `soporte@empresa.com` |
| `EMAIL_PASS` | Contraseña o App Password | — |
| `FRONTEND_URL` | URL del frontend (CORS) | `http://localhost:3000` |

---

## Credenciales por defecto (seeder)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@empresa.com | Admin123! | Administrador |
| tecnico1@empresa.com | Tecnico123! | Técnico |
| tecnico2@empresa.com | Tecnico123! | Técnico |
| usuario1@empresa.com | Usuario123! | Usuario |

> Cambiar estas contraseñas en producción.

---

## Comandos de desarrollo

```bash
# Desarrollo (raíz)
npm run dev            # Backend + Frontend en paralelo
npm run migrate        # Ejecutar migraciones
npm run seed           # Cargar datos iniciales
npm run test:all       # Correr suite de tests

# Backend (cd backend)
npm run dev            # Nodemon
npm run test           # Jest --runInBand
npm run test:coverage  # Cobertura
npm run migrate        # npx sequelize-cli db:migrate
npm run migrate:undo   # Revertir todas las migraciones
npm run seed           # Ejecutar seeder

# Frontend (cd frontend)
npm start              # CRA dev server
npm run build          # Build de producción
```

---

## Estructura del proyecto

```
tickets-ti/
├── backend/
│   ├── src/
│   │   ├── config/         db.js, auth.js, email.js, database.js
│   │   ├── controllers/    auth, users, tickets, notifications, reports
│   │   ├── middlewares/    auth.js, roles.js, errorHandler.js, rateLimiter.js
│   │   ├── migrations/     6 archivos (users→categories→sla→tickets→notifications→audit)
│   │   ├── models/         User, Ticket, Category, Notification, SLAConfig, AuditLog
│   │   ├── routes/         auth, users, tickets, notifications, reports, sla
│   │   ├── seeders/        seed.js
│   │   ├── services/       ticketService, slaService, assignmentService,
│   │   │                   notificationService, socketService
│   │   └── utils/          helpers.js, constants.js, validators.js
│   ├── tests/
│   │   └── unit/           auth.test.js, tickets.test.js, notifications.test.js
│   ├── .env.example
│   ├── Dockerfile
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/     layout/ (Navbar, Layout), shared/ (Badge, PrivateRoute)
│   │   ├── context/        AuthContext.js, NotificationContext.js
│   │   ├── pages/          Login, Dashboard, Tickets, TicketDetail, Users,
│   │   │                   Reports, Notifications, Profile
│   │   │   └── dashboards/ AdminDashboard, TechnicianDashboard, UserDashboard
│   │   └── services/       api.js, authService, ticketService, socketService
│   ├── nginx.frontend.conf
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── package.json
```

---

## API — Endpoints principales

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → retorna JWT |
| POST | `/api/auth/logout` | Invalida el token |
| POST | `/api/auth/refresh` | Renueva token si expira en < 1h |
| GET | `/api/auth/me` | Datos del usuario autenticado |

### Tickets
| Método | Ruta | Roles |
|--------|------|-------|
| GET | `/api/tickets` | Todos (filtrado por rol) |
| POST | `/api/tickets` | Todos |
| GET | `/api/tickets/:id` | Todos (propio/asignado/todos) |
| PATCH | `/api/tickets/:id/status` | Admin, Técnico |
| POST | `/api/tickets/:id/assign` | Admin |
| POST | `/api/tickets/:id/reopen` | Usuario, Admin |
| DELETE | `/api/tickets/:id` | Admin |

### Notificaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/notifications` | Lista paginada (filtro por tipo) |
| GET | `/api/notifications/count` | Contador de no leídas |
| PATCH | `/api/notifications/:id/read` | Marcar como leída |
| PATCH | `/api/notifications/read-all` | Marcar todas como leídas |

### Reportes
| Método | Ruta | Roles |
|--------|------|-------|
| GET | `/api/reports/summary` | Admin |
| GET | `/api/reports/technician-performance` | Admin |
| GET | `/api/reports/sla-compliance` | Admin |
| GET | `/api/reports/tickets-by-period` | Admin |
| GET | `/api/reports/my-dashboard` | Admin, Técnico |
| GET | `/api/reports/my-tickets-summary` | Todos |

### Usuarios (Admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Listar usuarios |
| POST | `/api/users` | Crear usuario |
| PUT | `/api/users/:id` | Actualizar |
| DELETE | `/api/users/:id` | Soft-delete |
| POST | `/api/users/:id/reset-password` | Resetear contraseña |
| PATCH | `/api/users/:id/toggle-activo` | Activar/desactivar |

---

## Seguridad implementada

- **Helmet.js** — headers de seguridad HTTP (X-Frame-Options, CSP, etc.)
- **CORS restrictivo** — solo permite el origen configurado en `FRONTEND_URL`
- **Rate limiting global** — 100 req/15min por IP
- **Rate limiting auth** — 10 req/min en `/api/auth/login`
- **Bloqueo de cuenta** — 5 intentos fallidos → bloqueado 15 min
- **JWT con expiración** — 8 horas, token blacklist en logout
- **bcrypt 12 rounds** — hash de contraseñas
- **sanitize-html** — sanitización de campos de texto libre (titulo, descripcion, motivo_reapertura)
- **express-validator** — validación de todos los inputs
- **Sequelize ORM** — prevención de SQL injection por defecto
- **Campo password** — excluido de todas las respuestas JSON

---

## Tests

```bash
cd backend
npm test
# 35 tests en 3 suites: auth (13), tickets (15), notifications (7)
# Todos los casos de prueba del Plan de Pruebas: CP001-CP012
```

Cobertura objetivo: 80% en services y controllers.
