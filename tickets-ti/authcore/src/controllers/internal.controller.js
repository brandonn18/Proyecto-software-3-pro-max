// Endpoints consumidos por AuthcoreUserAdapter (domain-service).
// Devuelven solo datos de directorio: nunca password ni datos de login.
const userService = require('../services/userService');

const getUsuario = async (req, res, next) => {
  try {
    const user = await userService.obtenerParaDirectorio(req.params.id);
    res.json({ success: true, data: user, message: 'OK' });
  } catch (error) {
    next(error);
  }
};

const getTecnicos = async (req, res, next) => {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    const tecnicos = await userService.listarTecnicos({ incluirInactivos });
    res.json({ success: true, data: tecnicos, message: 'OK' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsuario, getTecnicos };
