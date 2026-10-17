// App HTTP completa sobre tickets_domain_test. authcore, SMTP y Socket.io son
// dobles; los tokens se firman con JWT_SECRET igual que lo haría authcore.
const request = require('supertest');
const Aplicacion = require('../../src/Aplicacion');
const { DirectorioEnMemoria, EmailEspia, RealtimeEspia } = require('../dobles');
const { abrirBdDePrueba } = require('../infraestructura/bdDePrueba');
const { firmarComoAuthcore } = require('../helpers/jwtAuthcore');

const USUARIOS = Object.freeze({
  admin: { id: 1, nombre: 'Admin', email: 'admin@test', rol: 'administrador', activo: true },
  ana: { id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true },
  beto: { id: 21, nombre: 'Beto Técnico', email: 'beto@test', rol: 'tecnico', activo: true },
  luis: { id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true },
  maria: { id: 11, nombre: 'María Usuaria', email: 'maria@test', rol: 'usuario', activo: true },
});

const tokenPara = (usuario, opciones) => firmarComoAuthcore(usuario, opciones);

const abrirServidorDePrueba = async () => {
  const bd = await abrirBdDePrueba();
  const ctx = { bd };
  // modulos: { comentarios: true } enciende /api/v1/tickets/:id/comentarios
  ctx.reiniciar = async ({ usuarios = Object.values(USUARIOS), modulos = {} } = {}) => {
    await bd.limpiar();
    await bd.modelos.SLAConfig.bulkCreate([
      { prioridad: 'critica', tiempo_horas: 4 }, { prioridad: 'alta', tiempo_horas: 8 },
      { prioridad: 'media', tiempo_horas: 24 }, { prioridad: 'baja', tiempo_horas: 72 },
    ]);
    ctx.directorio = new DirectorioEnMemoria([...usuarios]);
    ctx.email = new EmailEspia();
    ctx.realtime = new RealtimeEspia();
    ctx.logger = { error: jest.fn(), info: jest.fn() };
    ctx.aplicacion = new Aplicacion({ ...bd, directorio: ctx.directorio, correo: ctx.email, canal: ctx.realtime, logger: ctx.logger });
    ctx.app = ctx.aplicacion.crearHttp({ jwtSecret: process.env.JWT_SECRET, modulos, origenPermitido: '*', esTest: true });
  };
  // como(usuario).get('/api/...') → request autenticado
  ctx.como = (usuario) => {
    const token = tokenPara(usuario);
    const metodo = (m) => (ruta) => request(ctx.app)[m](ruta).set('Authorization', `Bearer ${token}`);
    return { get: metodo('get'), post: metodo('post'), put: metodo('put'), patch: metodo('patch'), delete: metodo('delete') };
  };
  ctx.cerrar = bd.cerrar;
  return ctx;
};

const datosTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime desde ayer', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

module.exports = { abrirServidorDePrueba, USUARIOS, tokenPara, datosTicket };
