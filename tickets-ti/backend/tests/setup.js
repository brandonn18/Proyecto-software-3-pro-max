// Configura el entorno ANTES de que Jest cargue cada suite de tests.
// No puede usar globals de Jest (jest.mock, etc.) — solo Node.js puro.

// Carga la conexión de la DB de pruebas; override evita heredar DB_NAME de desarrollo
require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimo_32_caracteres_ok!';
process.env.JWT_EXPIRES_IN = '8h';

// Usar DB de test separada si está configurada
if (process.env.DB_NAME_TEST) {
  process.env.DB_NAME = process.env.DB_NAME_TEST;
}

// Silenciar nodemailer en tests (email.js ya lo hace, pero refuerza)
process.env.EMAIL_HOST = 'localhost';
process.env.EMAIL_USER = 'test@test.local';
process.env.EMAIL_PASS = 'test';
