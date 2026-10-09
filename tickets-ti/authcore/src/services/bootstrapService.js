const { User } = require('../models');

// Crea el primer administrador de un entorno nuevo (AWS). Es idempotente: si ya
// existe un usuario con ese email no lo toca, así puede correrse en cada despliegue.
// A diferencia del seeder de desarrollo, nunca borra tablas ni usa contraseñas fijas.
const asegurarAdministrador = async ({ email, password, nombre = 'Administrador' }) => {
  if (!email || !password) throw new Error('asegurarAdministrador requiere email y password');

  const existente = await User.findOne({ where: { email }, attributes: ['id', 'rol'], paranoid: false });
  if (existente) return { creado: false, id: existente.id };

  const admin = await User.create({ email, password, nombre, rol: 'administrador' });
  return { creado: true, id: admin.id };
};

module.exports = { asegurarAdministrador };
