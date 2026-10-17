# domain-service — arquitectura en capas (rama `architecture/capas`)

Esta rama aplica la **arquitectura tradicional en capas** a todo domain-service.
La versión original y desplegada es la hexagonal de `main`. La API HTTP, los
eventos de Socket.io, el esquema de la base y las variables de entorno son los
mismos, así que el frontend, authcore y el despliegue en AWS no cambian.

```
            HTTP (Express)            cron (node-cron)
                  │                          │
                  ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│ presentacion/   app.js, rutas/, controladores/,         │ ┐
│                 middlewares/, formato.js, programador.js│ │
└──────────────────────────┬──────────────────────────────┘ │
                           ▼ servicios                      │
┌─────────────────────────────────────────────────────────┐ │  comun/
│ negocio/        servicios/ (tickets, asignación, ciclo  │ │  catalogos,
│                 de vida, SLA, reportes, notificaciones, │ │  errores, env
│                 comentarios, sesión)                    │ │  (transversal)
│                 reglas/ (funciones puras sobre filas)   │ │
└──────────────────────────┬──────────────────────────────┘ │
                           ▼ DAO e integraciones concretos  │
┌─────────────────────────────────────────────────────────┐ │
│ datos/          dao/ (SQL vía Sequelize), modelos.js,   │ │
│                 integraciones/ (authcore HTTP, SMTP,    │ │
│                 Socket.io, JWT), migraciones/           │ ┘
└──────────────────────────┬──────────────────────────────┘
                           ▼
        PostgreSQL propia · authcore (HTTPS) · SMTP · navegador
```

## Reglas de dependencia

| Capa | Puede usar | No puede usar |
|---|---|---|
| `presentacion/` | `negocio/`, `comun/`, Express | `datos/`, Sequelize, Socket.io, nodemailer |
| `negocio/` | `datos/integraciones/` (solo `tokens.js`), `comun/` | `presentacion/`, Express, Sequelize |
| `datos/` | `comun/`, Sequelize, Socket.io, nodemailer, jsonwebtoken | `negocio/`, `presentacion/`, Express |
| `comun/` | nada | todas las capas |

`src/capas.js` apila datos → negocio; `presentacion/app.js` recibe solo los
servicios. `tests/arquitectura.test.js` hace cumplir la tabla.

## Qué cambia respecto de hexagonal (`main`)

| | Hexagonal (`main`) | Capas (esta rama) |
|---|---|---|
| Reglas del ticket | Entidad `Ticket` inmutable con métodos | Funciones en `negocio/reglas/reglasTicket.js` que reciben la fila y devuelven los cambios |
| Datos | Puertos (`TicketRepository`…) definidos por la aplicación | DAO concretos (`ticketsDAO`…) definidos por la capa de datos |
| Dirección de dependencias | Todo apunta al dominio | De arriba hacia abajo |
| Objetos que viajan | Entidades del dominio | Objetos planos (filas) |
| Verificación de dependencias | `verificarPuerto` en cada constructor | No hay contratos: negocio usa la API del DAO tal cual |
| Reloj | Puerto `Clock` | `reloj` opcional en `crearServicios` (por defecto, `new Date()`) |
| Cambiar de base de datos | Nuevo adaptador; el dominio no cambia | Reescribir `datos/dao/`; negocio no cambia mientras la API del DAO se mantenga |
| Probar negocio | Dobles en memoria de los puertos | Contra la base de prueba con los DAO reales; solo las integraciones externas son dobles |

## Mapa desde `main`

| `main` (hexagonal) | Esta rama |
|---|---|
| `domain/Ticket.js` | `negocio/reglas/reglasTicket.js` |
| `domain/politica*.js`, `idTicket.js` | `negocio/reglas/` |
| `domain/catalogos.js`, `domain/errores.js`, `application/errores.js` | `comun/` |
| `application/casosDeUso/*` | `negocio/servicios/*Service.js` |
| `application/ports/*` | no existen |
| `infrastructure/persistencia/Sequelize*Repository.js` | `datos/dao/*DAO.js` |
| `infrastructure/directorio`, `email`, `realtime` | `datos/integraciones/` |
| `infrastructure/http/*` | `presentacion/` |
| `infrastructure/programador.js` | `presentacion/programador.js` |
| `composicion.js` | `capas.js` |
| `modules/*_comentarios` (cuatro versiones) | comentarios integrados en las tres capas |

## Comentarios

`/api/v1/tickets/:id/comentarios` (GET y POST), igual que la versión hexagonal
de `main`, detrás de `MODULO_COMENTARIOS=true`. Las rutas `/api/v1/capas`,
`/mvc` y `/oop` de `main` no existen aquí: en esta rama todo el servicio ya está
en capas. Si el despliegue envía `MODULO_CAPAS`, `MODULO_MVC` o `MODULO_OOP`,
se ignoran.

## Tests

```powershell
npm test
```

| Carpeta | Qué prueba |
|---|---|
| `tests/http/` | El contrato HTTP. Los mismos tests de `main`; solo cambian las rutas de `require` |
| `tests/negocio/` | Reglas puras (sin base) y servicios sobre la base de prueba |
| `tests/datos/` | DAO contra PostgreSQL e integraciones (authcore falso, SMTP falso, Socket.io real) |
| `tests/arquitectura.test.js` | Reglas de dependencia entre capas |
