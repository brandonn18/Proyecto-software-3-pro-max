# domain-service — Modelo-Vista-Controlador (rama `architecture/mvc`)

Esta rama aplica **MVC** a todo domain-service. La versión original y desplegada
es la hexagonal de `main`. La API HTTP, los eventos de Socket.io, el esquema de
la base y las variables de entorno son los mismos, así que el frontend, authcore
y el despliegue en AWS no cambian.

```
   petición HTTP                      cron (cada 5 y 15 min)
        │                                     │
        ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│ routes/          │  path → acción  │ routes/tareas.js │  expresión → acción
└────────┬─────────┘                 └────────┬─────────┘
         ▼                                    ▼
┌───────────────────────────────────────────────────────┐
│ controllers/   leen la petición, llaman a los modelos │
│                y eligen la vista. Sin reglas ni SQL.  │
└──────────┬──────────────────────────────┬─────────────┘
  pide datos│                              │le pasa los datos
           ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│ models/                  │   │ views/                           │
│ Ticket, AuditLog,        │   │ JSON: respuesta, ticketView,     │
│ Notification, SLAConfig, │   │   reporteView, comentarioView... │
│ TicketComentario         │   │ HTML: html/ (panel de admin)     │
│ (Sequelize + reglas)     │   │ Email: correos/plantillas        │
│ Usuario (authcore),      │   │ Funciones puras: no consultan    │
│ Reporte (agregaciones)   │   └──────────────────────────────────┘
└──────────┬───────────────┘
           ▼
 PostgreSQL · lib/ (authcore HTTP, SMTP, Socket.io)
```

## Qué hace cada carpeta

| Carpeta | Papel |
|---|---|
| `models/` | **Modelo gordo (Active Record)**: cada clase extiende `Model` de Sequelize y trae sus reglas. `Ticket.abrir()`, `ticket.cambiarEstado()`, `ticket.asignarManual()`, `Ticket.verificarSLA()`... `Usuario` y `Reporte` no tienen tabla: leen de authcore y agregan cifras. |
| `models/apoyo/` | Reglas puras que usan los modelos (SLA, asignación, acceso, ID) y el registro de servicios externos |
| `views/` | Arman la salida: el JSON de la API, el HTML del panel y el HTML de los emails |
| `controllers/` | Una acción por endpoint: lee `req`, llama al modelo y responde con una vista |
| `routes/` | Paths HTTP y validación de entrada (express-validator); `tareas.js` hace lo mismo con el cron |
| `middlewares/` | JWT de authcore, roles, rate limit, validación y errores → HTTP |
| `lib/` | Clientes de servicios externos: authcore, SMTP, Socket.io |
| `config/` | Variables de entorno, conexión, migraciones |

## Reglas (las hace cumplir `tests/arquitectura.test.js`)

- `models/` no importa Express, vistas, controladores ni `lib/`. Los servicios
  externos le llegan por `configurarServicios()` al arrancar.
- `views/` no importa modelos ni frameworks, y no es `async`: solo transforma datos.
- `controllers/` no importa modelos (los recibe ya definidos) ni hace consultas.
- `routes/` no conoce vistas ni controladores concretos: recibe el controlador.

## Qué cambia respecto de hexagonal (`main`)

| | Hexagonal (`main`) | MVC (esta rama) |
|---|---|---|
| Dónde viven las reglas | Entidad `Ticket` pura en `domain/` | En el modelo Sequelize `Ticket` (`models/Ticket.js`) |
| Persistencia | Puerto `TicketRepository` + adaptador | El modelo se guarda solo (`this.update()`, `this.destroy()`) |
| Orquestación | Casos de uso en `application/` | Métodos del modelo; el controlador solo los llama |
| Forma del JSON | `presentadores.js` dentro del adaptador HTTP | `views/` |
| Servicios externos | Puertos inyectados por constructor | Registro `models/apoyo/servicios.js` configurado al arrancar |
| Cambiar de base de datos | Nuevo adaptador; el dominio no cambia | Las reglas están atadas a Sequelize: hay que tocar los modelos |
| Probar reglas | Sin base de datos, con dobles de los puertos | Contra la base de prueba (Active Record) |

## Comentarios

| Flag | Ruta | Responde |
|---|---|---|
| `MODULO_COMENTARIOS=true` | `/api/v1/tickets/:id/comentarios` | JSON (igual que `main`) |
| `MODULO_MVC=true` | `/api/v1/mvc/tickets/:id/comentarios` | HTML, solo administrador (igual que `main`) |

Las dos usan el mismo modelo `TicketComentario`; cambia solo la vista.
`MODULO_CAPAS` y `MODULO_OOP` no aplican en esta rama y se ignoran.

## Tests

```powershell
npm test
```

| Carpeta | Qué prueba |
|---|---|
| `tests/http/` | El contrato HTTP. Los mismos tests de `main`; solo cambian las rutas de `require` |
| `tests/models/` | Modelos contra la base de prueba y las reglas puras de `models/apoyo/` |
| `tests/views/` | Vistas JSON y HTML sin base de datos |
| `tests/controllers/` | Controlador de tareas con modelos falsos |
| `tests/lib/` | authcore falso, SMTP falso, Socket.io real |
| `tests/arquitectura.test.js` | Papel de cada carpeta |
