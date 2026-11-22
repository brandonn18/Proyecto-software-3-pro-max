# Guía de Pruebas Manuales

> **Documento histórico.** Guía para el monolito Node, reemplazado. Las pruebas manuales vigentes están en `domain-service-java/requests.http` y en `domain-service-java/deploy/postman/`. Ver [`PENDIENTES.md`](PENDIENTES.md).
## Sistema de Gestión de Tickets TI — Ingeniería de Software II

**Proyecto:** Sistema de Gestión de Tickets para TI  
**Universidad:** Universidad de Pamplona  
**Evaluador:** Docente / Jurado  
**Versión del sistema:** 1.0.0  

---

## Antes de empezar

### Requisitos del entorno

| Requisito | Versión mínima | Verificar con |
|-----------|---------------|---------------|
| Node.js | 18.x | `node --version` |
| PostgreSQL | 14.x | `psql --version` |
| npm | 9.x | `npm --version` |
| Navegador | Chrome 110+ / Firefox 115+ | — |

### Preparar la base de datos

```powershell
# Crear la base de datos (si no existe)
psql -U postgres -c "CREATE DATABASE tickets_ti_dev;"

# Crear el usuario de prueba (si no existe)
psql -U postgres -c "CREATE USER tickets_user WITH PASSWORD 'tickets_pass';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tickets_ti_dev TO tickets_user;"
```

### Configurar variables de entorno

Crear el archivo `tickets-ti/backend/.env` con el siguiente contenido:

```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tickets_ti_dev
DB_USER=postgres
DB_PASSWORD=tu_password_postgres
JWT_SECRET=una_clave_secreta_muy_larga_para_jwt_minimo_32_caracteres
JWT_EXPIRES_IN=8h
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=tu_usuario_mailtrap
EMAIL_PASS=tu_password_mailtrap
FRONTEND_URL=http://localhost:3000
```

> **Nota sobre emails:** Para pruebas locales, los emails se pueden deshabilitar dejando las variables EMAIL_* con valores ficticios. El sistema continuará funcionando sin envío real de correos.

### Levantar el sistema

```powershell
# Terminal 1 — Backend
cd tickets-ti/backend
npm install
npm run migrate    # Ejecuta migraciones de Sequelize
npm run seed       # Carga datos iniciales (usuarios de ejemplo)
npm start          # Servidor en http://localhost:5000

# Terminal 2 — Frontend
cd tickets-ti/frontend
npm install
npm start          # Aplicación en http://localhost:3000
```

### Usuarios pre-cargados por el seeder

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | admin@ticketsti.com | Admin123! |
| Técnico 1 | carlos.tech@ticketsti.com | Tecnico123! |
| Técnico 2 | laura.tech@ticketsti.com | Tecnico123! |
| Usuario final | juan.usuario@ticketsti.com | Usuario123! |

---

## CP001 — Registro de nuevo ticket

**Objetivo:** Verificar que un usuario puede crear un ticket y se genera un ID único con formato correcto.

**Pasos:**

1. Abrir `http://localhost:3000` en el navegador.
2. Iniciar sesión con el usuario final: `juan.usuario@ticketsti.com` / `Usuario123!`.
3. Hacer clic en **"Nuevo Ticket"** o navegar a la sección de tickets.
4. Completar el formulario:
   - Título: `Impresora HP LaserJet sin conexión`
   - Descripción: `La impresora del piso 2, sala de reuniones, no responde desde esta mañana.`
   - Tipo: `Incidente`
   - Categoría: `Hardware`
   - Prioridad: `Alta`
5. Hacer clic en **"Crear Ticket"**.

**Resultado esperado:**
- ✅ El sistema muestra un mensaje de confirmación.
- ✅ El ticket aparece en la lista con un ID en formato `TKT-2026-XXXX`.
- ✅ El estado inicial es **"abierto"** o **"asignado"** (si hay técnicos disponibles).
- ✅ El ticket es visible en el panel del técnico asignado.

**Verificación adicional:**
- Crear un segundo ticket y confirmar que tiene un ID diferente (correlativo).

---

## CP002 — Clasificación por categoría

**Objetivo:** Verificar que las 5 categorías del sistema son aceptadas y se guardan correctamente.

**Pasos:**

1. Sesión iniciada como usuario final (del CP001).
2. Crear 5 tickets, uno por cada categoría:
   - Ticket 1: Categoría **Hardware** — "Monitor con parpadeo"
   - Ticket 2: Categoría **Software** — "Excel no responde"
   - Ticket 3: Categoría **Red** — "Sin acceso a internet"
   - Ticket 4: Categoría **Accesos** — "No puedo ingresar al ERP"
   - Ticket 5: Categoría **Servicios TI** — "Solicitud de nuevo equipo"
3. Verificar que cada ticket aparece en la lista con la categoría correcta.

**Resultado esperado:**
- ✅ Las 5 categorías aparecen correctamente en el formulario de creación.
- ✅ Cada ticket guardado muestra su categoría correspondiente.
- ✅ El filtro por categoría en la lista funciona para cada una.

---

## CP003 — Asignación automática al técnico con menor carga

**Objetivo:** Verificar que el sistema asigna nuevos tickets al técnico con menos tickets activos.

**Pasos:**

1. Iniciar sesión como **Administrador**: `admin@ticketsti.com` / `Admin123!`.
2. En el panel de administración, verificar la carga actual de cada técnico.
3. Crear un nuevo ticket como usuario (cambiar de sesión o abrir ventana privada).
4. Volver al panel de administrador y verificar a qué técnico fue asignado.
5. Crear 2 tickets más y verificar el patrón de asignación.

**Resultado esperado:**
- ✅ El ticket se asigna automáticamente sin intervención manual.
- ✅ El técnico con menos tickets activos recibe la asignación.
- ✅ Si ambos técnicos tienen la misma carga, se asigna al de ID menor (desempate determinístico).
- ✅ El estado del ticket cambia de "abierto" a "asignado" inmediatamente.

---

## CP004 — Cambio de estado por técnico

**Objetivo:** Verificar las transiciones de estado válidas e inválidas.

**Pasos:**

1. Iniciar sesión como **Técnico 1**: `carlos.tech@ticketsti.com` / `Tecnico123!`.
2. Localizar un ticket asignado al técnico 1.
3. Cambiar el estado a **"En Proceso"** y agregar un comentario: "Iniciando diagnóstico del hardware".
4. Verificar que el estado cambió correctamente.
5. Intentar cambiar directamente a **"Cerrado"** (sin pasar por "Resuelto").

**Resultado esperado:**
- ✅ La transición `asignado → en_proceso` se realiza correctamente.
- ✅ El historial del ticket registra el cambio de estado y el comentario.
- ✅ La transición `en_proceso → cerrado` es **rechazada** con un mensaje de error claro.
- ✅ Un técnico no puede modificar tickets asignados a otro técnico.

**Transiciones válidas del sistema:**

```
abierto → asignado → en_proceso ⇄ en_espera
                    en_proceso → resuelto → cerrado
                    resuelto/cerrado → abierto (solo por reapertura)
```

---

## CP005 — Reapertura de ticket resuelto

**Objetivo:** Verificar que el usuario puede reabrir un ticket resuelto con un motivo justificado.

**Pasos:**

1. Como **Técnico 1**, marcar un ticket como **"Resuelto"** con comentario "Problema solucionado, equipo funcionando".
2. Cambiar a sesión de **usuario final**.
3. Localizar el ticket resuelto.
4. Hacer clic en **"Reabrir Ticket"**.
5. Ingresar motivo: "El problema reapareció al día siguiente. El equipo volvió a fallar."
6. Confirmar la reapertura.

**Resultado esperado:**
- ✅ El ticket vuelve al estado **"abierto"**.
- ✅ El campo "Reabierto" aparece como **Sí** en el detalle del ticket.
- ✅ El motivo de reapertura se muestra en el historial.
- ✅ El SLA se reinicia con un nuevo tiempo límite calculado desde el momento de reapertura.
- ✅ Se asigna nuevamente a un técnico automáticamente.

---

## CP006 — Notificación al asignar ticket

**Objetivo:** Verificar que el técnico recibe notificación cuando se le asigna un ticket.

**Pasos:**

1. Iniciar sesión como **Técnico 1**.
2. Verificar el número actual de notificaciones (ícono de campana).
3. En otra ventana/sesión, crear un ticket nuevo como usuario final con prioridad **"Alta"**.
4. Volver a la sesión del técnico.

**Resultado esperado:**
- ✅ El contador de notificaciones del técnico aumenta.
- ✅ La notificación indica el ID del ticket y que fue asignado.
- ✅ Al hacer clic en la notificación, navega al detalle del ticket.
- ✅ Al marcar como leída, el contador disminuye.

**Verificación de tiempo:**
- La notificación debe aparecer en menos de 5 segundos (Socket.io en tiempo real).
- Si no aparece en tiempo real, refrescar la página y verificar en la sección de notificaciones.

---

## CP007 — Autenticación con credenciales válidas

**Objetivo:** Verificar el flujo completo de autenticación.

**Pasos:**

1. Navegar a `http://localhost:3000`.
2. Ingresar: email `juan.usuario@ticketsti.com` / contraseña `Usuario123!`.
3. Verificar redirección y datos del usuario en la interfaz.
4. Cerrar sesión.
5. Intentar acceder directamente a `http://localhost:3000/tickets` sin autenticación.

**Resultado esperado:**
- ✅ Login exitoso redirige según el rol:
  - Administrador → `/dashboard`
  - Técnico → `/tickets`
  - Usuario → `/tickets`
- ✅ El nombre del usuario aparece en la barra superior.
- ✅ El campo **contraseña no es visible** en ninguna respuesta de la API (verificar con DevTools → Network).
- ✅ Acceso sin token redirige al login.
- ✅ Un token expirado o inválido resulta en redirección al login.

**Prueba negativa:**

6. Intentar login con contraseña incorrecta: `PasswordMalo123`.
7. Verificar mensaje de error claro.

---

## CP008 — Bloqueo de cuenta tras 5 intentos fallidos

**Objetivo:** Verificar el mecanismo de protección contra fuerza bruta.

**Pasos:**

1. Navegar al formulario de login.
2. Ingresar email `juan.usuario@ticketsti.com` con contraseña incorrecta **5 veces consecutivas**.
   - Intentos 1–4: verificar que el mensaje dice "Email o contraseña incorrectos".
3. En el intento **5**, verificar el mensaje de error.
4. Intentar el **6to intento** con la contraseña correcta `Usuario123!`.

**Resultado esperado:**
- ✅ Los primeros 4 intentos muestran "Email o contraseña incorrectos".
- ✅ En el 5to intento (o el 6to si el sistema cuenta desde 0), la cuenta se bloquea.
- ✅ El mensaje cambia a **"Cuenta bloqueada temporalmente. Intenta nuevamente en 15 minutos."**
- ✅ Incluso con la contraseña correcta, el login es rechazado mientras la cuenta está bloqueada.
- ✅ El administrador puede ver la cuenta bloqueada en el panel de gestión de usuarios.

**Desbloqueo:**
- Esperar 15 minutos, O bien el administrador puede desbloquear manualmente desde el panel.

---

## CP009 — Dashboard diferenciado por rol

**Objetivo:** Verificar que cada rol ve información adaptada a sus responsabilidades.

### Verificación como Administrador

1. Iniciar sesión como `admin@ticketsti.com`.
2. Navegar al **Dashboard** (`/dashboard`).

**Debe mostrar:**
- ✅ Total de tickets en el sistema
- ✅ Tickets por estado (abiertos, en proceso, resueltos, cerrados)
- ✅ Número de técnicos activos
- ✅ Tickets por prioridad (crítica, alta, media, baja)
- ✅ Métricas de SLA (tickets en alerta, vencidos)

### Verificación como Técnico

1. Iniciar sesión como `carlos.tech@ticketsti.com`.
2. Navegar a la sección de tickets o dashboard técnico.

**Debe mostrar:**
- ✅ Solo los tickets asignados a **este técnico**
- ✅ Sus tickets activos (no los del otro técnico)
- ✅ No tiene acceso al resumen global del sistema

### Verificación como Usuario

1. Iniciar sesión como `juan.usuario@ticketsti.com`.
2. Navegar a tickets.

**Debe mostrar:**
- ✅ Solo los tickets creados **por este usuario**
- ✅ No tiene acceso al dashboard de administración
- ✅ Intentar navegar a `/dashboard` → redirige o muestra error 403

---

## CP010 — Alerta SLA al 80% del tiempo consumido

**Objetivo:** Verificar que el sistema alerta cuando un ticket consume el 80% de su SLA.

**Configuración de SLA por prioridad:**

| Prioridad | Tiempo total | Alerta al | Tiempo para alerta |
|-----------|-------------|-----------|-------------------|
| Crítica | 4 horas | 80% | 3 horas 12 min |
| Alta | 8 horas | 80% | 6 horas 24 min |
| Media | 24 horas | 80% | 19 horas 12 min |
| Baja | 72 horas | 80% | 57 horas 36 min |

**Pasos para prueba acelerada:**

1. Iniciar sesión como administrador.
2. Desde la consola de DB o la API, crear un ticket con `sla_limite` próximo a vencer:
   ```sql
   -- Crear ticket con SLA casi vencido (10 minutos restantes de un total de 8h)
   -- Esto simula que ha pasado el 97% del tiempo
   INSERT INTO tickets (id, titulo, descripcion, tipo, categoria, prioridad, estado, 
     usuario_id, sla_limite, created_at, updated_at)
   VALUES ('TKT-SLA-TEST', 'Test SLA', 'Verificación', 'incidente', 'hardware', 'alta',
     'asignado', <id_usuario>, NOW() + INTERVAL '10 minutes', NOW() - INTERVAL '7 hours 50 minutes', NOW());
   ```
3. Navegar al dashboard de administrador.

**Resultado esperado:**
- ✅ El ticket aparece marcado con indicador visual de alerta SLA (color naranja o rojo).
- ✅ La sección "Tickets en alerta SLA" del dashboard lo lista.
- ✅ El técnico asignado recibe notificación de alerta.
- ✅ Una vez vencido el SLA, el estado visual cambia a "SLA vencido" (indicador rojo).

**Verificación del cálculo:**
- Porcentaje consumido = (tiempo transcurrido / tiempo total) × 100
- Alerta se activa cuando porcentaje ≥ 80%

---

## CP011 — Registro de usuario por administrador

**Objetivo:** Verificar que solo el administrador puede crear nuevos usuarios.

**Pasos:**

1. Iniciar sesión como administrador.
2. Navegar a **Gestión de Usuarios** → **Nuevo Usuario**.
3. Completar el formulario:
   - Nombre: `Pedro García`
   - Email: `pedro.garcia@empresa.com`
   - Contraseña: `Pedro1234!`
   - Rol: `Técnico`
4. Hacer clic en **"Crear Usuario"**.
5. Verificar que el usuario aparece en la lista.
6. Cerrar sesión e iniciar sesión con las credenciales del nuevo usuario.

**Resultado esperado:**
- ✅ El usuario se crea correctamente con los datos ingresados.
- ✅ La **contraseña no aparece** en la respuesta ni en la lista de usuarios.
- ✅ El nuevo usuario puede iniciar sesión inmediatamente.
- ✅ El nuevo técnico aparece disponible para recibir asignaciones.

**Pruebas negativas:**

7. Como usuario final, intentar crear un usuario vía API directamente:
   ```
   POST http://localhost:5000/api/users
   Authorization: Bearer <token_usuario_final>
   ```
   → Debe recibir **403 Forbidden**.

8. Intentar crear un usuario con email duplicado:
   → Debe recibir un error indicando que el email ya está registrado.

9. Intentar crear con contraseña débil (menos de 8 caracteres o sin mayúsculas):
   → Debe recibir error de validación.

---

## CP012 — Cierre de ticket resuelto

**Objetivo:** Verificar que un ticket resuelto puede ser cerrado y que las transiciones inválidas son rechazadas.

**Pasos:**

1. Como **Técnico 1**, tomar un ticket en proceso y marcarlo como **"Resuelto"** con comentario de resolución.
2. Verificar que el estado cambió a "resuelto".
3. Como **Administrador**, localizar el ticket resuelto.
4. Cambiar el estado a **"Cerrado"**.
5. Verificar que el ticket aparece como cerrado en la lista.
6. Intentar volver el ticket a "En Proceso" desde el estado "Cerrado".

**Resultado esperado:**
- ✅ La transición `resuelto → cerrado` se realiza correctamente.
- ✅ El ticket cerrado aparece en la lista con badge "cerrado".
- ✅ La transición `cerrado → en_proceso` es **rechazada** con mensaje de error.
- ✅ El único camino desde "cerrado" es la reapertura (que lo pasa a "abierto").
- ✅ Los tickets cerrados contribuyen a las métricas de "resueltos" en el dashboard.

---

## Pruebas de regresión recomendadas

Después de ejecutar los 12 CPs, verificar que las funcionalidades base siguen operativas:

| Check | Acción | Resultado esperado |
|-------|--------|-------------------|
| Lista de tickets | GET /api/tickets | Paginación correcta, 20 por página |
| Filtros | Filtrar por estado, prioridad, categoría | Resultados correctos en cada filtro |
| Búsqueda | Buscar por texto en título | Resultados relevantes |
| Detalle de ticket | Abrir ticket individual | Historial de cambios visible |
| Logout | Cerrar sesión | Token invalidado, redirige al login |

---

## Herramientas de depuración

### Verificar logs del backend

```powershell
# Logs en tiempo real
cd tickets-ti/backend
npm start   # Los logs aparecen en la consola
```

### Verificar respuestas de la API

Usar el archivo `tickets-ti/backend/docs/api.http` con VS Code REST Client, o importar la colección Postman si está disponible.

### Verificar estado de la base de datos

```sql
-- Ver todos los tickets
SELECT id, titulo, estado, prioridad, usuario_id, tecnico_id, sla_limite FROM tickets ORDER BY created_at DESC;

-- Ver usuarios y su estado de bloqueo
SELECT id, nombre, email, rol, intentos_fallidos, bloqueado_hasta FROM users;

-- Ver notificaciones recientes
SELECT id, tipo, mensaje, leida, usuario_id, ticket_id FROM notifications ORDER BY created_at DESC LIMIT 20;
```

---

## Ejecutar suite de tests automatizados

Para completar la verificación, ejecutar los tests automatizados:

```powershell
# Tests unitarios e integración (backend)
cd tickets-ti/backend
npm test

# Tests con cobertura
npm run test:coverage

# Script de aceptación standalone (corre CP001-CP012 automáticamente)
npm run acceptance

# Tests frontend
cd tickets-ti/frontend
npm test -- --watchAll=false
```

**Resultados esperados:**
- Backend: 90/90 tests PASS
- Frontend: 22/22 tests PASS
- Acceptance script: 12/12 CP PASS

---

*Guía generada para la evaluación del proyecto — Ingeniería de Software II, Universidad de Pamplona, 2026.*
