# Historias de usuario de los requisitos sin historia propia

Ingeniería del Software III · Tickets TI · borrador del 2026-11-26 (tarea E.1 de [PENDIENTES.md](PENDIENTES.md)).

El profesor observó en el Excel que **RF-06, RF-09, RF-10, RF-11 y RF-12** no tenían historia propia: en la tabla de
trazabilidad del documento de entrega aparecen con «—». Este archivo propone esas historias, en el mismo formato que
HU-01 a HU-05 de ese documento (*Como… quiero… para…* y criterios *Dado… cuando… entonces…*).

Cada criterio describe lo que **ya hace** el servicio Java y nombra la prueba automática que lo verifica, así la
evidencia queda trazable. Lo que no está hecho aparece marcado como **pendiente**.

**Antes de pasarlas al Excel, falta que el equipo:**

1. Confirme los números. RF-06 y RF-11 corresponden a HU-11 y HU-12 del backlog del servicio Java. Para RF-09, RF-10 y
   RF-12 se proponen HU-13, HU-14 y HU-15, pero hay que cotejarlos con el tablero de Trello, que ya llega hasta HU-15.
2. Estime **prioridad** (1 a 10) y **dimensión** (10 a 100). Este borrador no las inventa.

Las definiciones de los requisitos están tomadas del documento «Tickets TI — Entrega: requisitos, arquitectura,
despliegue y SOLID» (páginas 2 y 3).

## Resumen

| Requisito | Historia | Estado | Pruebas que lo verifican |
|---|---|---|---|
| RF-06 Reasignar | HU-11 | Hecho | `TicketsRestTest.reasignacion`, `TicketServiceTest`, `NotificacionesTest.reasignacion` |
| RF-09 Alerta de SLA al 80 % | HU-13 (propuesta) | Hecho (M-01) | `SlaTicketTest`, `VerificacionSlaServiceTest`, `VerificacionSlaIntegracionTest` |
| RF-10 Notificaciones | HU-14 (propuesta) | **Parcial** (M-02): avisa por el log; faltan la bandeja y el tiempo real | `NotificacionesTest`, `NotificacionRegistroAdapterTest` |
| RF-11 Cada rol ve lo suyo | HU-12 | Hecho | `TicketsRestTest.consultas`, `TicketServiceTest`, `ConsultaPaginadaTest` |
| RF-12 Reportes | HU-15 (propuesta) | Hecho (M-03) | `ReporteServiceTest`, `ReportesRestTest`, `ReporteQueryContractTest` |

## HU-11 — Reasignar un ticket (RF-06)

**Como** administrador, **quiero** reasignar un ticket a otro técnico, **para** repartir la carga o cubrir a quien no
puede atenderlo.

- **Dado** un ticket vigente asignado a un técnico, **cuando** lo reasigno a otro técnico registrado, **entonces** queda
  asignado al nuevo, conserva su estado y el historial dice «Reasignado de *anterior* a *nuevo*».
- **Dado** que soy técnico o usuario, **cuando** intento reasignar, **entonces** recibo «acceso denegado» (403).
- **Dado** un técnico que no está registrado, **cuando** reasigno a ese técnico, **entonces** recibo «no encontrado» (404).
- **Dado** el mismo técnico que ya lo tiene, **cuando** lo reasigno, **entonces** el sistema lo rechaza (409).
- **Dado** un ticket resuelto o cerrado, **cuando** intento reasignarlo, **entonces** el sistema lo rechaza (409).
- **Dado** que reasigno un ticket, **entonces** se avisa la asignación al nuevo técnico (M-02).

Endpoint: `POST /api/tickets/{codigo}/assign`.

## HU-12 — Ver solo los tickets que me corresponden (RF-11)

**Como** usuario, técnico o administrador, **quiero** ver solo los tickets que me corresponden, **para** no ver
información ajena y encontrar rápido lo mío.

- **Dado** que soy usuario, **cuando** consulto los tickets, **entonces** veo solo los que yo creé.
- **Dado** que soy técnico, **cuando** consulto, **entonces** veo los que tengo asignados y los que yo creé.
- **Dado** que soy administrador, **cuando** consulto, **entonces** veo todos.
- **Dado** un ticket de otra persona, **cuando** pido su detalle, **entonces** recibo «acceso denegado» (403); si no
  existe, «no encontrado» (404).
- **Dado** que filtro por estado, prioridad, categoría o tipo, **entonces** veo solo lo que cumple los filtros; un filtro
  desconocido se rechaza (400).
- **Dado** que pido una página (`page`, `size`), **entonces** recibo esa página, más recientes primero, y el total en
  `X-Total-Count` cuenta solo lo que puedo ver (M-05).

Endpoints: `GET /api/tickets`, `GET /api/tickets/{codigo}`.

## HU-13 (propuesta) — Alerta antes de que venza el SLA (RF-09)

**Como** técnico, **quiero** que el sistema avise cuando un ticket mío consumió el 80 % de su plazo, **para** atenderlo
antes de que venza.

- **Dado** un ticket vigente de prioridad alta (8 h), **cuando** pasó el 79 % del plazo, **entonces** no se alerta.
  **Cuando** llega al 80 %, **entonces** queda la alerta en su historial y se avisa (M-02).
- **Dado** un ticket ya alertado, **cuando** el sistema vuelve a revisar, **entonces** no lo alerta de nuevo.
- **Dado** un ticket que llega a su vencimiento sin resolverse, **entonces** se marca como vencido una sola vez y se
  avisa. Si venció sin alerta previa, por ejemplo con el servicio detenido, solo se marca vencido.
- **Dado** un ticket resuelto o cerrado, **entonces** no se alerta ni se marca, aunque haya pasado su plazo.
- **Dado** que reabro un ticket, **entonces** su plazo y sus alertas empiezan de nuevo.

Plazos: crítica 4 h, alta 8 h, media 24 h, baja 72 h. El documento de requisitos pedía revisar cada 15 minutos. El
servicio revisa cada minuto por defecto; se ajusta con `negocio.sla.intervalo-verificacion` (por ejemplo, `PT15M`).

## HU-14 (propuesta) — Enterarme de lo que pasa con mis tickets (RF-10)

**Como** usuario o técnico, **quiero** enterarme cuando se crea, asigna o resuelve un ticket mío y de sus alertas de
SLA, **para** actuar sin tener que revisar el sistema a cada rato.

Hoy «se avisa» significa que el servicio registra el aviso en su log, con el ticket, su dueño y su técnico. Todavía
no le llega a la persona (ver el último criterio).

- **Dado** que creo un ticket, **entonces** se avisa su creación y, si se asignó, su asignación al técnico.
- **Dado** que el administrador reasigna un ticket, **entonces** se avisa al nuevo técnico.
- **Dado** que el técnico resuelve un ticket, **entonces** se avisa al dueño.
- **Dado** que un ticket llega al 80 % de su plazo o vence, **entonces** se avisa.
- **Dado** que el canal de avisos falla, **cuando** hago cualquiera de esas operaciones, **entonces** la operación igual
  queda guardada.
- **Pendiente:** ver los avisos en una bandeja (`GET /api/notifications`) y recibirlos en tiempo real (Socket.io), como
  pide el documento de requisitos. Hoy el único canal es el log del servicio. Cada canal sería un adaptador nuevo de
  `NotificacionPort`, sin tocar los casos de uso.

## HU-15 (propuesta) — Reportes de gestión (RF-12)

**Como** administrador, **quiero** consultar reportes de resumen, cumplimiento de SLA y desempeño por técnico, **para**
decidir sobre la carga de trabajo y la calidad del servicio.

- **Dado** que pido el resumen, **entonces** veo los totales por estado, prioridad y categoría, cuántos están vigentes,
  cuántos sin asignar y cuántos vencidos sin resolver.
- **Dado** que pido el cumplimiento de SLA, **entonces** veo qué porcentaje de los tickets terminados se resolvió dentro
  del plazo, en total y por prioridad, y cuántos vigentes están vencidos o en riesgo (más del 80 % del plazo).
- **Dado** que pido el desempeño, **entonces** veo por cada técnico sus vigentes, su cumplimiento y los minutos promedio
  de resolución.
- **Dado** un ticket reabierto y resuelto otra vez, **entonces** se mide con su nuevo plazo y cuenta una sola vez.
- **Dado** que soy usuario o técnico, **cuando** pido un reporte, **entonces** recibo «acceso denegado» (403).

Endpoints: `GET /api/reportes/resumen`, `/api/reportes/sla` y `/api/reportes/tecnicos`. El documento de requisitos los
nombraba `/api/reports/*`; conviene corregir ese documento o decidir si se ofrecen también con esa ruta.
