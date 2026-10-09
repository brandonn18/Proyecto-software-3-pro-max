// Casos de uso reales + adaptadores reales (PostgreSQL). Solo authcore y el
// SMTP son dobles: comprueba que la composición hexagonal funciona de punta a punta.
const app = require('../../src/application');
const infra = require('../../src/infrastructure');
const { DirectorioEnMemoria, RealtimeEspia, RelojFijo } = require('../application/fakes');
const { abrirBdDePrueba } = require('./bdDePrueba');

const ANA = { id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true };
const LUIS = { id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true };
const actor = ({ id, nombre, rol }) => ({ id, nombre, rol });

let bd;
let deps;
let casos;

beforeAll(async () => {
  bd = await abrirBdDePrueba();
});

beforeEach(async () => {
  await bd.limpiar();
  await bd.modelos.SLAConfig.create({ prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 80 });
  const realtime = new RealtimeEspia();
  const notificacionRepository = new infra.SequelizeNotificacionRepository(bd.modelos);
  deps = {
    clock: new RelojFijo(new Date()),
    ticketRepository: new infra.SequelizeTicketRepository(bd.modelos),
    auditoria: new infra.SequelizeAuditoriaRepository(bd.modelos),
    slaConfigRepository: new infra.SequelizeSLAConfigRepository(bd.modelos),
    notificacionRepository,
    notificaciones: new infra.NotificacionInAppAdapter({ repositorio: notificacionRepository, realtime }),
    realtime,
    email: new infra.NodemailerEmailAdapter({ transporter: { sendMail: jest.fn().mockResolvedValue({}) }, remitente: 't@t' }),
    userDirectory: new DirectorioEnMemoria([ANA, LUIS]),
    logger: { error: jest.fn() },
  };
  deps.asignarAutomaticamente = new app.AsignarAutomaticamente(deps);
  casos = {
    crear: new app.CrearTicket(deps),
    cambiarEstado: new app.CambiarEstadoTicket(deps),
    gestionar: new app.GestionarTicket(deps),
    verificarSLA: new app.VerificarSLA(deps),
    bandeja: new app.BandejaNotificaciones(deps),
  };
});

afterAll(async () => { await bd.cerrar(); });

describe('Flujo completo sobre PostgreSQL', () => {
  it('debería crear, autoasignar, resolver y dejar auditoría y notificaciones persistidas', async () => {
    const creado = await casos.crear.ejecutar({
      titulo: 'VPN caída', descripcion: 'Sin acceso remoto', tipo: 'incidente', categoria: 'red', prioridad: 'alta',
    }, actor(LUIS));
    expect(creado).toMatchObject({ estado: 'asignado', tecnicoId: 20, tecnico_nombre: 'Ana Técnica', usuario_nombre: 'Luis Usuario' });

    await casos.cambiarEstado.ejecutar(creado.id, { estado: 'en_proceso' }, actor(ANA));
    await casos.cambiarEstado.ejecutar(creado.id, { estado: 'resuelto', comentario: 'Reinicio del túnel' }, actor(ANA));

    const { ticket, auditorias } = await casos.gestionar.obtener(creado.id, actor(LUIS));
    expect(ticket.estado).toBe('resuelto');
    expect(auditorias.map((a) => a.accion)).toEqual(['TICKET_CREADO', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO']);
    expect(auditorias[2].usuario).toEqual({ id: 20, nombre: 'Ana Técnica' });
    expect((await casos.bandeja.listar(actor(LUIS))).items.map((n) => n.tipo).sort()).toEqual(['creacion', 'resolucion']);
  });

  it('debería alertar SLA una sola vez y persistir el flag', async () => {
    const creado = await casos.crear.ejecutar({
      titulo: 'Servidor', descripcion: 'x', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta',
    }, actor(LUIS));
    deps.clock.avanzarHoras(7);
    expect(await casos.verificarSLA.ejecutar()).toBe(1);
    expect(await casos.verificarSLA.ejecutar()).toBe(0);
    expect((await deps.ticketRepository.buscarPorId(creado.id)).sla_alerta_enviada).toBe(true);
    expect(deps.realtime.eventos.filter((e) => e.evento === 'notificacion:nueva')).toHaveLength(1);
  });

  it('debería generar IDs únicos al crear en paralelo', async () => {
    const datos = { titulo: 'Paralelo', descripcion: 'x', tipo: 'solicitud', categoria: 'software', prioridad: 'alta' };
    const creados = await Promise.all(Array.from({ length: 5 }, () => casos.crear.ejecutar(datos, actor(LUIS))));
    expect(new Set(creados.map((t) => t.id)).size).toBe(5);
  });
});
