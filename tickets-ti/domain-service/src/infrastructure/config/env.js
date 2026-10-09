// Lectura de variables de entorno con fail fast: si falta una obligatoria,
// el servicio no arranca en vez de usar un valor por defecto inseguro.

const requerirEnv = (nombre) => {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno obligatoria ${nombre}`);
  }
  return valor;
};

const configDB = () => ({
  database: requerirEnv('DB_NAME'),
  username: requerirEnv('DB_USER'),
  password: requerirEnv('DB_PASSWORD'),
  host: requerirEnv('DB_HOST'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: process.env.DB_SSL === 'true',
});

const configAuthcore = () => ({
  baseUrl: requerirEnv('AUTHCORE_URL'),
  internalKey: requerirEnv('AUTHCORE_INTERNAL_KEY'),
  timeoutMs: parseInt(process.env.AUTHCORE_TIMEOUT_MS || '3000', 10),
});

module.exports = { requerirEnv, configDB, configAuthcore };
