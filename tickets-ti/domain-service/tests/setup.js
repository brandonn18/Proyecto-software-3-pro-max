// Configura el entorno ANTES de que Jest cargue cada suite de tests.
// Solo los tests de infraestructura usan la BD; dominio y aplicación no.

// Carga la conexión de la DB de pruebas; override evita heredar la de desarrollo
require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimo_32_caracteres_ok!';
process.env.AUTHCORE_INTERNAL_KEY = 'test_internal_key_minimo_32_caracteres!!';
