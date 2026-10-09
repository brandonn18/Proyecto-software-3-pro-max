const authService = require('../services/authService');
const tokenService = require('../services/tokenService');

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body.email, req.body.password);
    res.json({ success: true, data, message: 'Login exitoso' });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const data = await authService.registrar(req.body);
    res.status(201).json({ success: true, data, message: 'Registro exitoso' });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user, req.tokenDecoded, req.token);
    res.json({ success: true, data: null, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    next(error);
  }
};

const refresh = (req, res, next) => {
  try {
    const token = tokenService.renovar(req.tokenDecoded, req.user);
    res.json({ success: true, data: { token }, message: 'Token renovado' });
  } catch (error) {
    next(error);
  }
};

const me = (req, res) => {
  res.json({ success: true, data: req.user, message: 'OK' });
};

const changePassword = async (req, res, next) => {
  try {
    await authService.cambiarPassword(req.user, req.body.passwordActual, req.body.passwordNuevo);
    res.json({ success: true, data: null, message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register, logout, refresh, me, changePassword };
