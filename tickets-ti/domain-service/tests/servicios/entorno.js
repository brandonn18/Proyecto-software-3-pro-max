// La Aplicacion real, pero con repositorios en memoria y dobles de las
// interfaces externas: los servicios no notan la diferencia (polimorfismo).
const Aplicacion = require('../../src/Aplicacion');
const { FabricaDeActores } = require('../../src/entidades/actores');
const { RelojFijo, RealtimeEspia, EmailEspia, DirectorioEnMemoria } = require('../dobles');
const m = require('./enMemoria');

const ANA = Object.freeze({ id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true });
const BETO = Object.freeze({ id: 21, nombre: 'Beto Técnico', email: 'beto@test', rol: 'tecnico', activo: true });
const INACTIVO = Object.freeze({ id: 22, nombre: 'Ciro Inactivo', email: 'ciro@test', rol: 'tecnico', activo: false });
const LUIS = Object.freeze({ id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true });
const MARIA = Object.freeze({ id: 11, nombre: 'María Usuaria', email: 'maria@test', rol: 'usuario', activo: true });
const ADMIN = Object.freeze({ id: 1, nombre: 'Admin', rol: 'administrador' });

// Actor a partir de los datos de un usuario (como lo haría el JWT)
const actor = ({ id, nombre, rol }) => FabricaDeActores.crear({ id, nombre, rol });

const crearEntorno = ({ usuarios = [ANA, BETO, INACTIVO, LUIS, MARIA], slaConfigs = [], reportes = {} } = {}) => {
  const reloj = new RelojFijo();
  const repositorios = {
    tickets: new m.TicketsEnMemoria(reloj), auditoria: new m.AuditoriaEnMemoria(), notificaciones: new m.NotificacionesEnMemoria(),
    configuracionSLA: new m.ConfiguracionSLAEnMemoria(slaConfigs), comentarios: new m.ComentariosEnMemoria(), reportes: new m.ConsultaDeReportesEspia(reportes),
  };
  const externos = { directorio: new DirectorioEnMemoria([...usuarios]), correo: new EmailEspia(), canal: new RealtimeEspia(), reloj, logger: { error: jest.fn() } };
  const aplicacion = new Aplicacion({ repositorios, ...externos });
  return { ...repositorios, ...externos, servicios: aplicacion.servicios };
};

const datosTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

module.exports = { crearEntorno, datosTicket, actor, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA };
