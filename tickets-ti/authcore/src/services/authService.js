const { User } = require('../models');
const { maxLoginAttempts, lockDurationMinutes } = require('../config/auth');
const tokenService = require('./tokenService');
const auditService = require('./auditService');
const { AppError } = require('../utils/AppError');

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

const _estaBloqueado = (user) =>
  Boolean(user.bloqueado_hasta) && new Date() < new Date(user.bloqueado_hasta);

const _registrarFallo = async (user) => {
  const intentos = user.intentos_login + 1;
  const bloqueado_hasta = intentos >= maxLoginAttempts
    ? new Date(Date.now() + lockDurationMinutes * 60 * 1000)
    : null;
  await user.update({ intentos_login: intentos, bloqueado_hasta });
  await auditService.registrar(user.id, 'LOGIN_FALLIDO', {
    motivo: 'password_incorrecto', intentos, bloqueado: Boolean(bloqueado_hasta),
  });
};

const _verificarPuedeEntrar = async (user, email) => {
  if (_estaBloqueado(user)) {
    await auditService.registrar(user.id, 'LOGIN_FALLIDO', { motivo: 'cuenta_bloqueada', email });
    throw new AppError(423, 'Cuenta bloqueada temporalmente. Intenta más tarde.');
  }
};

const login = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError(401, CREDENCIALES_INVALIDAS);
  await _verificarPuedeEntrar(user, email);

  if (!(await user.validarPassword(password))) {
    await _registrarFallo(user);
    throw new AppError(401, CREDENCIALES_INVALIDAS);
  }
  if (!user.activo) {
    await auditService.registrar(user.id, 'LOGIN_FALLIDO', { motivo: 'cuenta_inactiva' });
    throw new AppError(403, 'Cuenta inactiva');
  }

  await user.update({ intentos_login: 0, bloqueado_hasta: null });
  await auditService.registrar(user.id, 'LOGIN_EXITOSO', { email });
  return { token: tokenService.generar(user), user };
};

const _verificarEmailLibre = async (email) => {
  const existe = await User.findOne({ where: { email }, paranoid: false });
  if (existe) throw new AppError(409, 'El email ya está registrado');
};

const registrar = async ({ nombre, email, password }) => {
  await _verificarEmailLibre(email);
  const user = await User.create({ nombre, email, password, rol: 'usuario' });
  return { token: tokenService.generar(user), user };
};

const logout = async (user, decoded, token) => {
  tokenService.invalidar(decoded, token);
  await auditService.registrar(user.id, 'LOGOUT');
};

const cambiarPassword = async (user, passwordActual, passwordNuevo) => {
  if (!(await user.validarPassword(passwordActual))) {
    throw new AppError(400, 'Contraseña actual incorrecta');
  }
  await user.update({ password: passwordNuevo });
};

module.exports = { login, registrar, logout, cambiarPassword, verificarEmailLibre: _verificarEmailLibre };
