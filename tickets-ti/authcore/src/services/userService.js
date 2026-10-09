const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../models');
const auditService = require('./auditService');
const emailService = require('./emailService');
const { verificarEmailLibre } = require('./authService');
const { AppError } = require('../utils/AppError');

const ATTRS_PUBLICOS = ['id', 'nombre', 'email', 'rol', 'activo', 'createdAt'];
const ATTRS_DIRECTORIO = ['id', 'nombre', 'email', 'rol', 'activo'];
const CHARS_PASSWORD = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// crypto.randomInt en vez de Math.random: la contraseña temporal es un secreto
const _generarPasswordTemporal = () => {
  const aleatorios = Array.from({ length: 8 }, () => CHARS_PASSWORD[crypto.randomInt(CHARS_PASSWORD.length)]);
  return `${aleatorios.join('')}1!`;
};

const _logErrorEmail = (tipo) => (err) => console.error(`Error enviando email de ${tipo}:`, err.message);

const _construirFiltro = ({ rol, activo, search }) => {
  const where = {};
  if (rol) where.rol = rol;
  if (activo !== undefined) where.activo = activo === 'true';
  if (search) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }
  return where;
};

const listar = async ({ page = 1, limit = 20, ...filtros }) => {
  const pagina = parseInt(page, 10);
  const porPagina = parseInt(limit, 10);
  const { count, rows } = await User.findAndCountAll({
    where: _construirFiltro(filtros),
    attributes: ATTRS_PUBLICOS,
    order: [['createdAt', 'DESC']],
    limit: porPagina,
    offset: (pagina - 1) * porPagina,
  });
  return { items: rows, meta: { total: count, page: pagina, limit: porPagina, totalPages: Math.ceil(count / porPagina) } };
};

const _buscarOFallar = async (id, opciones = {}) => {
  const user = await User.findByPk(id, opciones);
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  return user;
};

const obtenerPorId = (id) => _buscarOFallar(id, { attributes: ATTRS_PUBLICOS });

const crear = async ({ nombre, email, password, rol }, adminId) => {
  await verificarEmailLibre(email);
  const user = await User.create({ nombre, email, password, rol });
  emailService.sendWelcomeEmail(user, password).catch(_logErrorEmail('bienvenida'));
  await auditService.registrar(adminId, 'CREAR_USUARIO', { email, rol });
  return user;
};

const actualizar = async (id, cambios, adminId) => {
  const user = await _buscarOFallar(id);
  const { nombre, email, rol, activo } = cambios;
  await user.update({ nombre, email, rol, activo });
  await auditService.registrar(adminId, 'ACTUALIZAR_USUARIO', { targetId: user.id, cambios });
  return user;
};

const desactivar = async (id, adminId) => {
  const user = await _buscarOFallar(id);
  if (user.id === adminId) throw new AppError(400, 'No puedes desactivar tu propia cuenta');
  await user.update({ activo: false });
  await auditService.registrar(adminId, 'DESACTIVAR_USUARIO', { targetId: user.id, email: user.email });
};

const resetearPassword = async (id, adminId) => {
  const user = await _buscarOFallar(id);
  const temporal = _generarPasswordTemporal();
  await user.update({ password: temporal, intentos_login: 0, bloqueado_hasta: null });
  emailService.sendPasswordResetEmail(user, temporal).catch(_logErrorEmail('reset'));
  await auditService.registrar(adminId, 'RESET_PASSWORD', { targetId: user.id, email: user.email });
  return user.email;
};

const alternarActivo = async (id) => {
  const user = await _buscarOFallar(id);
  await user.update({ activo: !user.activo });
  return user;
};

const listarTecnicos = ({ incluirInactivos = false } = {}) =>
  User.findAll({
    where: incluirInactivos ? { rol: 'tecnico' } : { rol: 'tecnico', activo: true },
    attributes: incluirInactivos ? ATTRS_DIRECTORIO : ['id', 'nombre', 'email'],
    order: [['nombre', 'ASC']],
  });

const obtenerParaDirectorio = (id) => _buscarOFallar(id, { attributes: ATTRS_DIRECTORIO });

module.exports = {
  listar, obtenerPorId, crear, actualizar, desactivar, resetearPassword,
  alternarActivo, listarTecnicos, obtenerParaDirectorio,
};
