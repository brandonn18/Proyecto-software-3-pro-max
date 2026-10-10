#!/usr/bin/env node
/**
 * Migración ÚNICA de datos: monolito (backend/) → authcore + domain-service.
 *
 * Requisitos:
 *   1. Bases destino creadas, con su esquema y sin datos: domain-service con
 *      sus migraciones (npm run migrate) y authcore arrancado una vez para que
 *      Hibernate cree users y user_roles (sin ADMIN_PASSWORD, para que quede vacía).
 *   2. Variables ORIGEN_DB_*, AUTHCORE_DB_* y DOMAIN_DB_* (HOST, PORT, NAME,
 *      USER, PASSWORD, SSL) en el entorno o en herramientas/migrar-monolito/.env.
 *
 * Uso:
 *   npm run simular    → lee y transforma, muestra conteos; NO escribe nada
 *   npm run ejecutar   → escribe en ambos destinos (todo o nada)
 *
 * Es una herramienta de operación: solo este script ve las tres bases.
 * domain-service sigue sin conectarse nunca a la base de authcore.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { configDesdeEnv, conectar } = require('./src/bd');
const { migrar } = require('./src/migracion');

const main = async () => {
  const ejecutar = process.argv.includes('--ejecutar');
  const clientes = {};
  try {
    clientes.origen = await conectar(configDesdeEnv('ORIGEN'));
    clientes.authcore = await conectar(configDesdeEnv('AUTHCORE'));
    clientes.domain = await conectar(configDesdeEnv('DOMAIN'));
    const resultado = await migrar({ ...clientes, ejecutar });
    console.log(ejecutar ? 'Migración completada:' : 'SIMULACIÓN (nada se escribió). Usa --ejecutar para migrar:');
    console.log(JSON.stringify({ authcore: resultado.authcore, domain: resultado.domain }, null, 2));
    resultado.avisos.forEach((a) => console.warn(`AVISO: ${a}`));
  } catch (err) {
    console.error('La migración falló y no se escribió nada:', err.message);
    process.exitCode = 1;
  } finally {
    await Promise.all(Object.values(clientes).map((c) => c.end().catch(() => {})));
  }
};

main();
