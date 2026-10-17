// Entorno de los tests de modelos: base de prueba y dobles de los
// colaboradores externos (authcore, SMTP, Socket.io, reloj).
const { configurarServicios } = require('../../src/models');
const { RelojFijo, RealtimeEspia, EmailEspia, DirectorioEnMemoria } = require('../dobles');

const ADMIN = Object.freeze({ id: 1, nombre: 'Admin', rol: 'administrador' });
const ANA = Object.freeze({ id: 20, nombre: 'Ana Técnica', email: 'ana@test', rol: 'tecnico', activo: true });
const BETO = Object.freeze({ id: 21, nombre: 'Beto Técnico', email: 'beto@test', rol: 'tecnico', activo: true });
const INACTIVO = Object.freeze({ id: 22, nombre: 'Ciro Inactivo', email: 'ciro@test', rol: 'tecnico', activo: false });
const LUIS = Object.freeze({ id: 10, nombre: 'Luis Usuario', email: 'luis@test', rol: 'usuario', activo: true });
const MARIA = Object.freeze({ id: 11, nombre: 'María Usuaria', email: 'maria@test', rol: 'usuario', activo: true });

const actor = ({ id, nombre, rol }) => ({ id, nombre, rol });

// bd: abrirBdDePrueba() | slaConfigs: filas a sembrar en sla_configs
const prepararEntorno = async (bd, { usuarios = [ANA, BETO, INACTIVO, LUIS, MARIA], slaConfigs = [] } = {}) => {
  await bd.limpiar();
  if (slaConfigs.length) await bd.modelos.SLAConfig.bulkCreate(slaConfigs);
  const ctx = {
    reloj: new RelojFijo(), tiempoReal: new RealtimeEspia(), correo: new EmailEspia(),
    directorio: new DirectorioEnMemoria([...usuarios]), logger: { error: jest.fn(), info: jest.fn() },
  };
  configurarServicios(ctx);
  return ctx;
};

const datosTicket = (overrides = {}) => ({
  titulo: 'Impresora sin conexión', descripcion: 'No imprime', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta', ...overrides,
});

module.exports = { prepararEntorno, datosTicket, actor, ADMIN, ANA, BETO, INACTIVO, LUIS, MARIA };
