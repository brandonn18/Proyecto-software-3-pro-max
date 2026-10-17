# domain-service — diseño orientado a objetos (rama `architecture/oop`)

Esta rama aplica un **diseño orientado a objetos estricto** a todo domain-service:
todo es una clase con estado privado, y las decisiones se toman por
polimorfismo en lugar de `if` por tipo. La versión original y desplegada es la
hexagonal de `main`. La API HTTP, los eventos de Socket.io, el esquema de la base
y las variables de entorno son los mismos, así que el frontend, authcore y el
despliegue en AWS no cambian.

```
                        Aplicacion  (crea y conecta los objetos)
                             │
          ┌──────────────────┼──────────────────────────────┐
          ▼                  ▼                              ▼
  AplicacionHttp      servicios/                     infraestructura/
  Controlador*  ───▶  GestorDeTickets, CicloDeVida,  Repositorio*Sequelize
  (extienden          AsignadorDeTecnicos,           DirectorioAuthcore
  ControladorBase)    MonitorDeSLA, Notificador...   CorreoSMTP, CanalSocketIo
                             │                              │ extends
                 usan ▼      │      ▼ usan (solo abstractas)│
  ┌──────────────────────────┐   ┌──────────────────────────▼───┐
  │ entidades/               │   │ interfaces/ «abstractas»     │
  │ Ticket ◆── EstadoDeTicket│   │ RepositorioDeTickets         │
  │        ◆── DatosDeTicket │   │ DirectorioDeUsuarios         │
  │        ◆── VentanaSLA    │   │ ServicioDeCorreo, Reloj      │
  │ Actor ◁── Administrador  │   │ CanalEnTiempoReal            │
  │       ◁── Tecnico        │   │ EstrategiaDeAsignacion ...   │
  │       ◁── Solicitante    │   └──────────────────────────────┘
  └──────────────────────────┘
```

## Conceptos y dónde verlos

| Concepto | Dónde |
|---|---|
| **Encapsulamiento** | Todas las entidades y objetos de valor usan campos privados `#` y solo getters. `Ticket` cambia solo a través de `asignarA()`, `cambiarEstadoA()`, `reabrir()`... |
| **Abstracción** | `interfaces/`: 11 clases abstractas que no se pueden instanciar (`new.target`) y cuyos métodos lanzan `ErrorNoImplementado` |
| **Herencia** | `Actor` → `Administrador`, `Tecnico`, `Solicitante` · `EstadoDeTicket` → 6 estados · `ServicioDeTickets` → `GestorDeTickets`, `CicloDeVida`, `AsignadorDeTecnicos`, `GestorDeComentarios` · `ControladorBase` → 5 controladores · `ErrorDeDominio` → 4 errores |
| **Polimorfismo** | `actor.puedeVer(ticket)`, `puedeReabrir()`, `filtroDeListado()` responden distinto por subclase; `estado.transicionarA()` y `permiteComentar()` por estado; el `ManejadorDeErrores` elige el status HTTP por la clase del error |
| **Composición** | `Ticket` tiene un `EstadoDeTicket`, unos `DatosDeTicket`, una `VentanaSLA` y un `IdTicket` |
| **Inyección de dependencias** | Cada servicio recibe sus colaboradores por constructor y verifica con `instanceof` que extiendan la interfaz (`Dependencias.exigir`) |
| **Objetos de valor** | `IdTicket`, `Prioridad`, `VentanaSLA`, `DatosDeTicket`, `Paginacion`: inmutables y siempre válidos |

## Patrones de diseño

| Patrón | Clases |
|---|---|
| State | `EstadoDeTicket` y `Abierto`, `Asignado`, `EnProceso`, `EnEspera`, `Resuelto`, `Cerrado` |
| Strategy | `EstrategiaDeAsignacion` y `EstrategiaMenorCarga` (otra regla de asignación = otra subclase, sin tocar `AsignadorDeTecnicos`) |
| Factory | `FabricaDeActores` (rol → subclase), `EstadoDeTicket.desde(nombre)`, `Ticket.abrir()` / `Ticket.reconstruir()` |
| Template Method | `ControladorBase.accion()`: el esqueleto try/catch es común; cada controlador escribe solo su paso |
| Composition Root | `Aplicacion`: el único objeto que instancia clases concretas |

## Qué cambia respecto de hexagonal (`main`)

| | Hexagonal (`main`) | OOP (esta rama) |
|---|---|---|
| Permisos | Funciones en `politicaAcceso.js` con `if (rol === ...)` | Métodos de `Administrador`, `Tecnico` y `Solicitante` |
| Ciclo de vida | Mapa `TRANSICIONES_VALIDAS` | Una clase por estado (State) |
| Entidad | `Ticket` congelada (`Object.freeze`) con propiedades públicas; cada operación devuelve otra | `Ticket` con campos privados que se modifica a sí misma por métodos |
| Errores | `ErrorDominio` con un `codigo` | Jerarquía de clases; el status sale de la clase |
| Interfaces | `definirPuerto()` genera la clase y `verificarPuerto()` revisa que no falten métodos | Clases abstractas escritas a mano y verificación con `instanceof` |
| Organización | Por capa (domain, application, infrastructure) | Por tipo de objeto (entidades, valores, interfaces, servicios, infraestructura) |

## Comentarios

`/api/v1/tickets/:id/comentarios` (GET y POST) con `MODULO_COMENTARIOS=true`,
igual que la versión hexagonal de `main`. `MODULO_CAPAS`, `MODULO_MVC` y
`MODULO_OOP` no aplican en esta rama y se ignoran.

## Tests

```powershell
npm test
```

| Carpeta | Qué prueba |
|---|---|
| `tests/http/` | El contrato HTTP. Los mismos tests de `main`; solo cambian las rutas de `require` |
| `tests/entidades/` | Ticket, estados, actores, objetos de valor e interfaces, sin base de datos |
| `tests/servicios/` | Servicios con repositorios **en memoria que extienden las mismas interfaces** (sin base de datos) |
| `tests/infraestructura/` | Repositorios Sequelize contra PostgreSQL, authcore falso, SMTP falso, Socket.io real |
| `tests/arquitectura.test.js` | Dependencias, encapsulamiento (sin campos públicos), herencia de las implementaciones |
