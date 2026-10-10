/**
 * Integración real: crea tres bases desde cero con las migraciones de backend
 * (origen) y domain-service, y arranca el authcore Java para que Hibernate cree
 * su esquema. Siembra datos del monolito, migra y comprueba el login en authcore.
 * Lee la conexión de herramientas/migrar-monolito/.env.test. Requiere Java 21.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.test'), override: true });
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { conectar, contar, configDesdeEnv } = require('../src/bd');
const { migrar } = require('../src/migracion');
const { levantarAuthcore } = require('./authcoreJava');

const RAIZ = path.join(__dirname, '../../..');
const BASES = { origen: 'tickets_mig_origen_test', authcore: 'tickets_mig_authcore_test', domain: 'tickets_mig_domain_test' };
const conexion = (database) => ({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT, 10), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
});

const recrearBase = async (nombre) => {
  const admin = new Client(conexion('postgres'));
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombre}"`);
  await admin.end();
};

// Corre las migraciones reales de un proyecto contra la base indicada
const migrarEsquema = (carpeta, database) => {
  execFileSync(process.execPath, [require.resolve('sequelize-cli/lib/sequelize', { paths: [path.join(RAIZ, carpeta)] }), 'db:migrate'], {
    cwd: path.join(RAIZ, carpeta),
    env: { ...process.env, NODE_ENV: 'development', DB_NAME: database },
    stdio: 'pipe',
  });
};

const sembrarOrigen = async (c) => {
  // Hash bcrypt real de 'Usuario123!' (4 rondas para que el test sea rápido) para comprobar el login tras migrar
  const hash = require(path.join(RAIZ, 'backend/node_modules/bcryptjs')).hashSync('Usuario123!', 4);
  await c.query(`INSERT INTO users (nombre, email, password, rol, activo, intentos_login, "createdAt", "updatedAt") VALUES
    ('Administrador','admin@empresa.com',$1,'administrador',true,0,now(),now()),
    ('Carlos Técnico','tecnico1@empresa.com',$1,'tecnico',true,0,now(),now()),
    ('Laura Técnica','tecnico2@empresa.com',$1,'tecnico',false,0,now(),now()),
    ('Pedro Usuario','usuario1@empresa.com',$1,'usuario',true,0,now(),now())`, [hash]);
  await c.query(`INSERT INTO sla_configs (prioridad, tiempo_horas, porcentaje_alerta, "createdAt", "updatedAt") VALUES
    ('critica',4,80,now(),now()),('alta',6,75,now(),now()),('media',24,80,now(),now()),('baja',72,80,now(),now())`);
  // 3600 tickets: obliga a insertar en lotes (más de 65535 parámetros en total)
  await c.query(`INSERT INTO tickets (id, titulo, descripcion, tipo, categoria, prioridad, estado, "usuarioId", "tecnicoId", sla_limite, "createdAt", "updatedAt")
    SELECT 'TKT-2026-' || lpad(g::text, 4, '0'), 'Ticket ' || g, 'desc', 'incidente', 'red', 'alta',
      CASE WHEN g % 2 = 0 THEN 'asignado' ELSE 'abierto' END::enum_tickets_estado, 4, CASE WHEN g % 2 = 0 THEN 2 END,
      now() + interval '8 hours', now() - (g || ' minutes')::interval, now()
    FROM generate_series(1, 3600) g`);
  await c.query(`UPDATE tickets SET "deletedAt" = now() WHERE id = 'TKT-2026-3600'`);
  await c.query(`INSERT INTO audit_logs ("usuarioId", "ticketId", accion, detalle, "createdAt") VALUES
    (4, NULL, 'LOGIN_EXITOSO', '{}', now()), (4, 'TKT-2026-0002', 'TICKET_CREADO', '{}', now()), (1, 'TKT-2026-0002', 'TICKET_ASIGNADO', '{"tecnicoId":2}', now())`);
  await c.query(`INSERT INTO notifications ("usuarioId", "ticketId", tipo, mensaje, leida, "createdAt") VALUES
    (2, 'TKT-2026-0002', 'asignacion', 'Se te ha asignado', false, now()), (4, 'TKT-2026-0002', 'creacion', 'Creado', true, now())`);
};

let c;
let authcore;

beforeAll(async () => {
  for (const nombre of Object.values(BASES)) await recrearBase(nombre);
  migrarEsquema('backend', BASES.origen);
  migrarEsquema('domain-service', BASES.domain);
  authcore = await levantarAuthcore(conexion(BASES.authcore));
  c = {
    origen: await conectar(conexion(BASES.origen)),
    authcore: await conectar(conexion(BASES.authcore)),
    domain: await conectar(conexion(BASES.domain)),
  };
  await sembrarOrigen(c.origen);
});

afterAll(async () => {
  await Promise.all(Object.values(c || {}).map((cliente) => cliente.end()));
  if (authcore) await authcore.detener();
});

const postJson = (ruta, cuerpo) => fetch(`${authcore.url}${ruta}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
});

// Payload del JWT sin verificar la firma (solo para leer los claims en el test)
const claimsDe = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('Migración del monolito', () => {
  it('debería simular sin escribir nada', async () => {
    const r = await migrar({ ...c, ejecutar: false });
    expect(r).toMatchObject({ ejecutado: false, authcore: { users: 3, user_roles: 5 }, domain: { tickets: 3600, audit_logs: 2, notifications: 2, sla_configs: 4 } });
    expect(r.avisos).toContain('Usuario 3 (tecnico2@empresa.com) inactivo o eliminado: no se migra a authcore');
    expect(await contar(c.authcore, 'users')).toBe(0);
    expect(await contar(c.domain, 'tickets')).toBe(0);
  });

  it('debería revertir AMBOS destinos si falla a mitad de camino', async () => {
    const domainQueFalla = { query: (sql, v) => (/INSERT INTO "notifications"/.test(sql) ? Promise.reject(new Error('fallo simulado')) : c.domain.query(sql, v)) };
    await expect(migrar({ ...c, domain: domainQueFalla, ejecutar: true })).rejects.toThrow('fallo simulado');
    expect(await contar(c.authcore, 'users')).toBe(0);
    expect(await contar(c.domain, 'tickets')).toBe(0);
    expect(await contar(c.domain, 'sla_configs')).toBe(4);
  });

  it('debería migrar todo y conservar ids, snapshots y configuración SLA', async () => {
    const r = await migrar({ ...c, ejecutar: true });
    expect(r.ejecutado).toBe(true);
    const t = (await c.domain.query(`SELECT * FROM tickets WHERE id = 'TKT-2026-0002'`)).rows[0];
    expect(t).toMatchObject({ usuarioId: 4, usuario_nombre: 'Pedro Usuario', tecnicoId: 2, tecnico_nombre: 'Carlos Técnico', estado: 'asignado' });
    expect((await c.domain.query(`SELECT "deletedAt" FROM tickets WHERE id = 'TKT-2026-3600'`)).rows[0].deletedAt).not.toBeNull();
    expect((await c.domain.query(`SELECT tiempo_horas FROM sla_configs WHERE prioridad = 'alta'`)).rows[0].tiempo_horas).toBe(6);
    expect((await c.domain.query(`SELECT usuario_nombre FROM audit_logs WHERE accion = 'TICKET_ASIGNADO'`)).rows[0].usuario_nombre).toBe('Administrador');
    expect((await c.authcore.query(`SELECT id FROM users WHERE username = 'tecnico2@empresa.com'`)).rows).toEqual([]);
  });

  it('debería dejar la secuencia de authcore lista para nuevos registros', async () => {
    const res = await postJson('/api/auth/register', { username: 'nuevo', password: 'secreta1' });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(5);
  });

  it('debería negarse a correr de nuevo sobre destinos con datos', async () => {
    await expect(migrar({ ...c, ejecutar: false })).rejects.toThrow(/ya tiene \d+ filas/);
  });

  it('debería permitir login en authcore con la contraseña bcrypt migrada', async () => {
    const res = await postJson('/api/auth/login', { username: 'usuario1@empresa.com', password: 'Usuario123!' });
    expect(res.status).toBe(200);
    expect(claimsDe((await res.json()).token)).toMatchObject({ sub: 'usuario1@empresa.com', uid: 4, roles: ['USER'] });
  });

  it('debería exponer al técnico migrado en el directorio interno de authcore', async () => {
    const res = await fetch(`${authcore.url}/internal/tecnicos`, { headers: { 'X-Internal-Key': authcore.claveInterna } });
    const tecnicos = await res.json();
    expect(tecnicos.map((t) => [t.id, t.username])).toEqual([[2, 'tecnico1@empresa.com']]);
  });

  it('debería exigir todas las variables de conexión', () => {
    expect(() => configDesdeEnv('ORIGEN', {})).toThrow('Falta la variable de entorno ORIGEN_DB_HOST');
  });
});
