const userService = require('../services/userService');

const getAll = async (req, res, next) => {
  try {
    const { items, meta } = await userService.listar(req.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const user = await userService.obtenerPorId(req.params.id);
    res.json({ success: true, data: user, message: 'OK' });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const user = await userService.crear(req.body, req.user.id);
    res.status(201).json({ success: true, data: user, message: 'Usuario creado exitosamente' });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const user = await userService.actualizar(req.params.id, req.body, req.user.id);
    res.json({ success: true, data: user, message: 'Usuario actualizado' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await userService.desactivar(req.params.id, req.user.id);
    res.json({ success: true, data: null, message: 'Usuario desactivado correctamente' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const email = await userService.resetearPassword(req.params.id, req.user.id);
    res.json({ success: true, data: null, message: `Contraseña temporal enviada al correo ${email}` });
  } catch (error) {
    next(error);
  }
};

const toggleActivo = async (req, res, next) => {
  try {
    const user = await userService.alternarActivo(req.params.id);
    res.json({ success: true, data: user, message: `Usuario ${user.activo ? 'activado' : 'desactivado'}` });
  } catch (error) {
    next(error);
  }
};

const getTecnicos = async (req, res, next) => {
  try {
    const tecnicos = await userService.listarTecnicos();
    res.json({ success: true, data: tecnicos, message: 'OK' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getById, create, update, remove, resetPassword, toggleActivo, getTecnicos };
