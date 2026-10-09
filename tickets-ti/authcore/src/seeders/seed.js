// Usuarios de desarrollo. Se crean en el mismo orden que el seeder del
// monolito para que los ids coincidan con los tickets sembrados en domain-service.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize, User } = require('../models');

const USUARIOS = [
  { email: 'admin@empresa.com', nombre: 'Administrador', password: 'Admin123!', rol: 'administrador' },
  { email: 'tecnico1@empresa.com', nombre: 'Carlos Técnico', password: 'Tecnico123!', rol: 'tecnico' },
  { email: 'tecnico2@empresa.com', nombre: 'Laura Técnica', password: 'Tecnico123!', rol: 'tecnico' },
  { email: 'usuario1@empresa.com', nombre: 'Pedro Usuario', password: 'Usuario123!', rol: 'usuario' },
  { email: 'usuario2@empresa.com', nombre: 'María Usuario', password: 'Usuario123!', rol: 'usuario' },
  { email: 'usuario3@empresa.com', nombre: 'Juan Usuario', password: 'Usuario123!', rol: 'usuario' },
];

const seed = async () => {
  await sequelize.sync({ force: true });
  // Secuencial para conservar el orden de ids; el hook beforeCreate hashea la contraseña
  for (const { email, ...defaults } of USUARIOS) {
    await User.findOrCreate({ where: { email }, defaults });
  }
  console.log(`authcore: ${USUARIOS.length} usuarios sembrados.`);
};

seed()
  .catch((err) => {
    console.error('authcore: error en el seeder:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
