// Lectura de variables de entorno con fail fast: si falta una obligatoria,
// el servicio no arranca en vez de usar un valor por defecto inseguro.
class Entorno {
  static requerir(nombre) {
    const valor = process.env[nombre];
    if (valor === undefined || valor === '') throw new Error(`Falta la variable de entorno obligatoria ${nombre}`);
    return valor;
  }

  static baseDeDatos() {
    return {
      database: Entorno.requerir('DB_NAME'),
      username: Entorno.requerir('DB_USER'),
      password: Entorno.requerir('DB_PASSWORD'),
      host: Entorno.requerir('DB_HOST'),
      port: parseInt(process.env.DB_PORT || '5432', 10),
      ssl: process.env.DB_SSL === 'true',
    };
  }

  static authcore() {
    return {
      baseUrl: Entorno.requerir('AUTHCORE_URL'),
      internalKey: Entorno.requerir('AUTHCORE_INTERNAL_KEY'),
      timeoutMs: parseInt(process.env.AUTHCORE_TIMEOUT_MS || '3000', 10),
    };
  }

  // Comentarios de tickets: apagado por defecto, igual que en main. MODULO_CAPAS,
  // MODULO_MVC y MODULO_OOP de main no aplican aquí: si llegan, se ignoran.
  static modulos() {
    return { comentarios: process.env.MODULO_COMENTARIOS === 'true' };
  }
}

module.exports = Entorno;
