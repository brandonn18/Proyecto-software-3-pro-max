const { Client } = require('pg');

// Conexión por prefijo: ORIGEN_DB_*, AUTHCORE_DB_*, DOMAIN_DB_*
const configDesdeEnv = (prefijo, env = process.env) => {
  const leer = (campo) => {
    const valor = env[`${prefijo}_DB_${campo}`];
    if (valor === undefined || valor === '') throw new Error(`Falta la variable de entorno ${prefijo}_DB_${campo}`);
    return valor;
  };
  return {
    host: leer('HOST'),
    port: parseInt(env[`${prefijo}_DB_PORT`] || '5432', 10),
    database: leer('NAME'),
    user: leer('USER'),
    password: leer('PASSWORD'),
    ssl: env[`${prefijo}_DB_SSL`] === 'true' ? { rejectUnauthorized: false } : false,
  };
};

const conectar = async (config) => {
  const cliente = new Client(config);
  await cliente.connect();
  return cliente;
};

// PostgreSQL admite como máximo 65535 parámetros por consulta
const FILAS_POR_LOTE = 500;

// INSERT multi-fila con parámetros ($1, $2...): nunca se interpolan valores
const _insertarLote = (cliente, tabla, columnas, filas) => {
  const valores = [];
  const tuplas = filas.map((fila) => `(${columnas.map((c) => { valores.push(fila[c]); return `$${valores.length}`; }).join(', ')})`);
  return cliente.query(`INSERT INTO "${tabla}" (${columnas.map((c) => `"${c}"`).join(', ')}) VALUES ${tuplas.join(', ')}`, valores);
};

const insertar = async (cliente, tabla, filas) => {
  if (!filas.length) return 0;
  const columnas = Object.keys(filas[0]);
  for (let i = 0; i < filas.length; i += FILAS_POR_LOTE) {
    await _insertarLote(cliente, tabla, columnas, filas.slice(i, i + FILAS_POR_LOTE));
  }
  return filas.length;
};

// Deja la secuencia del id en MAX(id) para que los próximos INSERT no choquen
const ajustarSecuencia = (cliente, tabla) => cliente.query(
  `SELECT setval(pg_get_serial_sequence('"${tabla}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${tabla}"`
);

const contar = async (cliente, tabla) => parseInt((await cliente.query(`SELECT COUNT(*) AS n FROM "${tabla}"`)).rows[0].n, 10);

module.exports = { configDesdeEnv, conectar, insertar, ajustarSecuencia, contar, FILAS_POR_LOTE };
