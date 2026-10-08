const { insertar, ajustarSecuencia, contar } = require('./bd');
const { transformar } = require('./transformar');

// Orden de inserción: respeta las FKs dentro de cada base destino
const TABLAS = {
  authcore: ['users', 'audit_logs'],
  domain: ['tickets', 'audit_logs', 'notifications', 'sla_configs'],
};
const CON_SECUENCIA = { authcore: ['users', 'audit_logs'], domain: ['audit_logs', 'notifications', 'sla_configs'] };

const leerOrigen = async (origen) => {
  const todo = (sql) => origen.query(sql).then((r) => r.rows);
  return {
    users: await todo('SELECT * FROM users ORDER BY id'),
    tickets: await todo('SELECT * FROM tickets ORDER BY "createdAt", id'),
    auditLogs: await todo('SELECT * FROM audit_logs ORDER BY id'),
    notifications: await todo('SELECT * FROM notifications ORDER BY id'),
    slaConfigs: await todo('SELECT * FROM sla_configs ORDER BY id'),
  };
};

// Fail fast: no se mezcla con datos existentes (sla_configs trae los valores por defecto de la migración)
const exigirDestinoVacio = async (cliente, nombre, tablas) => {
  for (const tabla of tablas.filter((t) => t !== 'sla_configs')) {
    const n = await contar(cliente, tabla);
    if (n > 0) throw new Error(`${nombre}.${tabla} ya tiene ${n} filas: la migración solo corre sobre bases recién migradas`);
  }
};

const _escribir = async (cliente, nombre, datos) => {
  if (nombre === 'domain') await cliente.query('DELETE FROM sla_configs');
  for (const tabla of TABLAS[nombre]) await insertar(cliente, tabla, datos[tabla]);
  for (const tabla of CON_SECUENCIA[nombre]) await ajustarSecuencia(cliente, tabla);
};

const _verificar = async (cliente, nombre, datos) => {
  for (const tabla of TABLAS[nombre]) {
    const enDestino = await contar(cliente, tabla);
    if (enDestino !== datos[tabla].length) throw new Error(`${nombre}.${tabla}: se esperaban ${datos[tabla].length} filas y hay ${enDestino}`);
  }
};

const resumen = (plan) => ({
  authcore: Object.fromEntries(TABLAS.authcore.map((t) => [t, plan.authcore[t].length])),
  domain: Object.fromEntries(TABLAS.domain.map((t) => [t, plan.domain[t].length])),
  avisos: plan.avisos,
});

// Lee el origen, transforma y (si ejecutar) escribe ambos destinos en
// transacciones que se confirman juntas al final o se revierten las dos.
const migrar = async ({ origen, authcore, domain, ejecutar = false }) => {
  const plan = transformar(await leerOrigen(origen));
  await exigirDestinoVacio(authcore, 'authcore', TABLAS.authcore);
  await exigirDestinoVacio(domain, 'domain', TABLAS.domain);
  if (!ejecutar) return { ejecutado: false, ...resumen(plan) };

  await authcore.query('BEGIN');
  await domain.query('BEGIN');
  try {
    await _escribir(authcore, 'authcore', plan.authcore);
    await _escribir(domain, 'domain', plan.domain);
    await _verificar(authcore, 'authcore', plan.authcore);
    await _verificar(domain, 'domain', plan.domain);
    await authcore.query('COMMIT');
    await domain.query('COMMIT');
  } catch (err) {
    await authcore.query('ROLLBACK').catch(() => {});
    await domain.query('ROLLBACK').catch(() => {});
    throw err;
  }
  return { ejecutado: true, ...resumen(plan) };
};

module.exports = { migrar, leerOrigen, TABLAS };
