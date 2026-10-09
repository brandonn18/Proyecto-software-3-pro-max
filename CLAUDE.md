# Guía general de desarrollo — Brandon Martínez

## Identidad del entorno
- OS: Windows 11, terminal PowerShell
- Runtime principal: Node.js 18+
- Editor: VS Code
- Control de versiones: Git + GitHub
- Idioma del código: español (variables, funciones, comentarios)

---

## Principios de arquitectura

- **Separación de responsabilidades**: controllers solo orquestan, la lógica va en services
- **No repetir lógica**: si algo se usa en más de un lugar, extráelo a utils/ o services/
- **Fail fast**: valida entradas al inicio de cada función, no al final
- **Inmutabilidad**: prefiere `const` sobre `let`; nunca uses `var`
- **Funciones pequeñas**: máximo 30 líneas por función; si crece, divídela

---
---

## Migración semestre actual — authcore + domain-service hexagonal

Este proyecto se está migrando de un backend monolítico a dos servicios, para
cumplir los requisitos de la materia actual.

### Servicios
- `authcore/`: login, usuarios, emisión y validación de JWT. Servicio independiente.
- `domain-service/`: tickets, SLA, asignación, notificaciones. Arquitectura hexagonal.
- domain-service valida el JWT emitido por authcore vía JWT_SECRET compartido
  (variable de entorno, nunca hardcodeado).

### Datos de usuario
- authcore es el único dueño de la tabla de usuarios.
- domain-service NUNCA se conecta a la base de datos de authcore.
- domain-service obtiene usuarios a través del puerto `UserDirectoryPort`,
  implementado por `AuthcoreUserAdapter`, que llama a la API de authcore vía HTTP
  (AUTHCORE_URL en variable de entorno).
- Al asignar un técnico, el ticket guarda `tecnico_id` y `tecnico_nombre` como
  snapshot; no se usan includes contra tablas de usuario.

### Hexagonal en domain-service
- `domain/`: entidades y reglas de negocio puras. Prohibido importar Sequelize,
  Express o Socket.io aquí.
- `application/`: casos de uso. Reciben sus dependencias (puertos) por constructor,
  nunca las instancian directamente.
- `application/ports/`: interfaces (TicketRepository, NotificationPort,
  UserDirectoryPort, Clock).
- `infrastructure/`: adaptadores que implementan los puertos (Sequelize,
  Socket.io, HTTP hacia authcore).
- Los controllers solo traducen HTTP → caso de uso. No deben contener reglas de negocio.

### SOLID en domain-service
- Antes de agregar código nuevo, revisa si viola SRP, OCP, LSP, ISP o DIP.
- Si refactorizas una violación, menciona en el commit qué principio corriges
  (ej: `refactor(sla): aplica DIP extrayendo interfaz TicketRepository`).

### Al migrar un módulo existente
1. No modifiques el módulo original hasta tener tests de caracterización.
2. Extrae el dominio primero, con tests que no dependan de la base de datos.
3. Luego los puertos, luego el caso de uso, luego los adaptadores.
4. Corre toda la suite después de cada paso. Nunca avances con tests en rojo.

### AWS
- authcore y domain-service pueden desplegarse en cuentas de AWS distintas;
  se comunican solo por HTTPS, sin compartir VPC ni base de datos.
- Nunca generes ni uses credenciales de AWS dentro de Claude Code; `aws configure`
  lo maneja el usuario fuera de esta sesión.
- Ningún secreto (JWT_SECRET, credenciales de BD) va en el repo; siempre variable
  de entorno o Secrets Manager.

## Node.js / Express — reglas fijas

### Estructura de respuesta API (SIEMPRE esta forma)
```js
// Éxito
res.status(200).json({ success: true, data: resultado, message: 'OK' });

// Error
res.status(400).json({ success: false, message: 'Descripción del error', errors: [] });

// Lista paginada
res.status(200).json({ success: true, data: items, meta: { total, page, limit, totalPages } });
```

### Manejo de errores async (SIEMPRE)
```js
// Nunca dejes un async sin try/catch o sin pasarlo al next()
const obtenerTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error); // siempre pasa al errorHandler central
  }
};
```

### Lo que NO hacer en Express
- No poner lógica de negocio en routes ni en controllers directamente → va en services/
- No devolver el campo `password` en ninguna respuesta (usar `{ exclude: ['password'] }` en Sequelize)
- No usar `res.send()` para JSON, siempre `res.json()`
- No hardcodear valores de configuración; todo va en variables de entorno via `process.env`
- No confiar en validaciones del cliente; siempre validar en el servidor con express-validator

---

## Sequelize — reglas fijas

```js
// Al definir un modelo, siempre incluir timestamps y paranoid para soft delete
const Ticket = sequelize.define('Ticket', { ... }, {
  timestamps: true,      // createdAt, updatedAt automáticos
  paranoid: true,        // deletedAt para soft delete (nunca borrar físico)
  tableName: 'tickets'   // nombre explícito de la tabla en snake_case
});

// Al hacer queries, nunca traer todos los campos si no se necesitan
// MAL:
await User.findAll();
// BIEN:
await User.findAll({ attributes: ['id', 'nombre', 'email', 'rol'] });

// Al hacer findOne, siempre verificar si existe antes de usar
const user = await User.findByPk(id);
if (!user) return res.status(404)...
```

---

## React — reglas fijas

### Componentes
- Un componente = un archivo; PascalCase para el nombre (`TicketList.jsx`)
- Props siempre con PropTypes o TypeScript (preferir tipado explícito)
- No lógica de negocio en componentes; usar custom hooks para eso
- Máximo 150 líneas por componente; si crece, dividir en sub-componentes

### Estado y efectos
```js
// Siempre limpiar efectos que usen suscripciones o timers
useEffect(() => {
  const subscription = socket.on('evento', handler);
  return () => socket.off('evento', handler); // cleanup obligatorio
}, []);

// No llamar la API directamente en el componente
// MAL: fetch('/api/tickets') dentro del componente
// BIEN: usar un custom hook useTickets() o un service
```

### Tailwind
- Mobile-first: primero estilos base, luego `md:` y `lg:`
- No mezclar Tailwind con CSS inline (`style={{}}`); elegir uno
- Colores del sistema: usar variables consistentes, no valores arbitrarios

---

## Testing — reglas fijas

### Estructura de un test
```js
describe('ticketService', () => {
  describe('createTicket', () => {
    it('debería generar ID en formato TKT-YYYY-NNNN', async () => {
      // Arrange
      const datos = { titulo: 'Test', categoria: 'hardware', prioridad: 'alta' };
      // Act
      const ticket = await ticketService.createTicket(datos, usuarioId);
      // Assert
      expect(ticket.id).toMatch(/^TKT-\d{4}-\d{4}$/);
    });
  });
});
```

### Reglas
- Cada test es independiente: no depende del orden de ejecución ni de otros tests
- Usar `beforeEach`/`afterEach` para setup y limpieza de DB de pruebas
- Mockear servicios externos (email, socket) SIEMPRE; nunca enviar emails reales en tests
- Nombrar tests en español descriptivo: "debería...", "no debería..."
- Cobertura mínima objetivo: 80% en services y controllers

---

## Git — flujo de trabajo

```bash
# Flujo por módulo
git checkout -b feature/modulo-usuarios
# ... desarrollo ...
git add .
git commit -m "feat(usuarios): implementa autenticación JWT con bloqueo de cuenta"
git push origin feature/modulo-usuarios
# Pull request → revisión → merge a main
```

### Convención de commits (Conventional Commits)
- `feat(scope): descripción` — nueva funcionalidad
- `fix(scope): descripción` — corrección de bug
- `test(scope): descripción` — añadir o corregir tests
- `refactor(scope): descripción` — mejora de código sin cambio de comportamiento
- `docs(scope): descripción` — cambios en documentación

### Nunca
- Commit directo a `main`
- Commit con `node_modules/`, archivos `.env`, o binarios
- Mensaje de commit genérico como "fix", "changes", "update"

---

## Seguridad — checklist antes de cada commit

- [ ] Ninguna contraseña o API key hardcodeada en el código
- [ ] El campo `password` no aparece en ninguna respuesta JSON
- [ ] Todas las rutas protegidas tienen el middleware `verifyToken`
- [ ] Las rutas de admin tienen además `requireRole('administrador')`
- [ ] Los inputs del usuario pasan por express-validator antes de usarse
- [ ] No hay `console.log` con datos sensibles (tokens, passwords, datos personales)

---

## Eficiencia con Claude Code

- **Sé específico en los pedidos**: "añade validación de email en el endpoint POST /api/users" 
  es mejor que "mejora la validación"
- **Un problema a la vez**: no pidas 3 cosas distintas en un mismo mensaje
- **Incluye el error completo**: si hay un bug, pega el stack trace completo, no solo el mensaje
- **Confirma antes de cambios grandes**: si Claude Code va a modificar más de 3 archivos,
  pide que explique el plan antes de ejecutarlo
- **Usa /clear entre tareas no relacionadas**: limpia el contexto para no confundir Claude Code