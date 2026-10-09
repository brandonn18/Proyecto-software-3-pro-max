// Configura el entorno ANTES de que Jest cargue cada suite de tests.
// No puede usar globals de Jest (jest.mock, etc.) — solo Node.js puro.

// Carga la conexión de la DB de pruebas; override evita heredar la de desarrollo
require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimo_32_caracteres_ok!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.AUTHCORE_INTERNAL_KEY = 'test_internal_key_minimo_32_caracteres!!';

// Silenciar nodemailer en tests (email.js ya lo hace, pero refuerza)
process.env.EMAIL_HOST = 'localhost';
process.env.EMAIL_USER = 'test@test.local';
process.env.EMAIL_PASS = 'test';
