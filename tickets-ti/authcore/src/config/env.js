// Lectura de variables de entorno con fail fast: si falta una obligatoria,
// el servicio no arranca en vez de usar un valor por defecto inseguro.

const requerirEnv = (nombre) => {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno obligatoria ${nombre}`);
  }
  return valor;
};

module.exports = { requerirEnv };
