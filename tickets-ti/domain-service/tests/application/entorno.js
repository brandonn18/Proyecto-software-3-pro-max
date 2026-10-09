// Arma todos los casos de uso con dobles en memoria, como lo hará la
// composición real con los adaptadores de infraestructura.
const app = require('../../src/application');
const f = require('./fakes');

const ADMIN = Object.freeze({ id: 1, nombre: 'Admin', rol: 'administrador' });
const ANA = Object.freeze({ id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true });
const BETO = Object.freeze({ id: 21, nombre: 'Beto Técnico', email: 'beto@test', rol: 'tecnico', activo: true });
const INACTIVO = Object.freeze({ id: 22, nombre: 'Ciro Inactivo', email: 'ciro@test', rol: 'tecnico', activo: false });
const LUIS = Object.freeze({ id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true });
const MARIA = Object.freeze({ id: 11, nombre: 'María Usuaria', email: 'maria@test', rol: 'usuario', activo: true });

const actor = ({ id, nombre, rol }) => ({ id, nombre, rol });

const crearEntorno = ({ usuarios = [ANA, BETO, INACTIVO, LUIS, MARIA], slaConfigs = [] } = {}) => {
  const clock = new f.RelojFijo();
  const deps = {
    clock,
    ticketRepository: new f.TicketRepositoryEnMemoria({ clock }),
    auditoria: new f.AuditoriaEnMemoria(),
    notificaciones: new f.NotificacionesEnMemoria(),
    realtime: new f.RealtimeEspia(),
    email: new f.EmailEspia(),
    userDirectory: new f.DirectorioEnMemoria([...usuarios]),
    slaConfigRepository: new f.SLAConfigEnMemoria(slaConfigs),
    logger: { error: jest.fn() },
  };
  deps.notificacionRepository = deps.notificaciones;
  deps.asignarAutomaticamente = new app.AsignarAutomaticamente(deps);
  const casos = {
    crear: new app.CrearTicket(deps),
    asignar: new app.AsignarTicket(deps),
    cambiarEstado: new app.CambiarEstadoTicket(deps),
    reabrir: new app.ReabrirTicket(deps),
    gestionar: new app.GestionarTicket(deps),
    verificarSLA: new app.VerificarSLA(deps),
  };
  return { deps, casos };
};

const datosTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

// Deja que corran las tareas en segundo plano (emails)
const esperarSegundoPlano = () => new Promise((r) => setImmediate(r));

module.exports = { crearEntorno, datosTicket, actor, esperarSegundoPlano, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA };
