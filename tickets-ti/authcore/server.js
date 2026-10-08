require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/models');

const PORT = process.env.PORT || 3002;

const iniciar = async () => {
  try {
    await sequelize.authenticate();
    console.log('authcore: base de datos conectada.');
    // En producción el esquema lo manejan las migraciones (npm run migrate)
    if (process.env.NODE_ENV === 'development') await sequelize.sync({ alter: true });
    app.listen(PORT, () => console.log(`authcore escuchando en el puerto ${PORT}`));
  } catch (error) {
    console.error('authcore: no se pudo iniciar:', error.message);
    process.exit(1);
  }
};

iniciar();
