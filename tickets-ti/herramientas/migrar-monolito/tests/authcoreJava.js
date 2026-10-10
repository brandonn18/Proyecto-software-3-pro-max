// Levanta el authcore real (Java / Spring Boot) contra una base de prueba:
// Hibernate crea users y user_roles al arrancar, igual que en producción.
// Requiere Java 21; compila el jar con el wrapper de Gradle si no existe.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const DIR_AUTHCORE = path.join(__dirname, '../../../authcore');
const DIR_JARS = path.join(DIR_AUTHCORE, 'build/libs');
const SECRETOS = Object.freeze({
  JWT_SECRET: 'test_jwt_secret_minimo_32_caracteres_ok!',
  AUTHCORE_INTERNAL_KEY: 'test_internal_key_minimo_32_caracteres!!',
});

const _buscarJar = () => (fs.existsSync(DIR_JARS) ? fs.readdirSync(DIR_JARS).find((f) => f.endsWith('.jar')) : undefined);

const _asegurarJar = () => {
  if (!_buscarJar()) {
    // Ruta absoluta y entre comillas: la carpeta del proyecto tiene espacios
    const gradlew = path.join(DIR_AUTHCORE, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    execFileSync(`"${gradlew}"`, ['bootJar', '--console=plain'], { cwd: DIR_AUTHCORE, stdio: 'pipe', shell: true });
  }
  return path.join(DIR_JARS, _buscarJar());
};

const _puertoLibre = () => new Promise((resolve) => {
  const servidor = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = servidor.address();
    servidor.close(() => resolve(port));
  });
});

const _esperarSalud = async (url, proceso, intentos = 120) => {
  for (let i = 0; i < intentos; i += 1) {
    if (proceso.exitCode !== null) throw new Error(`authcore terminó al arrancar (código ${proceso.exitCode})`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('authcore no respondió /api/health a tiempo');
};

// conexion: { host, port, user, password, database }
const levantarAuthcore = async (conexion) => {
  const jar = _asegurarJar();
  const puerto = await _puertoLibre();
  const proceso = spawn('java', ['-jar', jar], {
    env: {
      ...process.env, ...SECRETOS, PORT: String(puerto), ADMIN_PASSWORD: '',
      DB_HOST: conexion.host, DB_PORT: String(conexion.port), DB_NAME: conexion.database,
      DB_USER: conexion.user, DB_PASSWORD: conexion.password,
    },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${puerto}`;
  await _esperarSalud(url, proceso);
  const detener = () => new Promise((resolve) => {
    if (proceso.exitCode !== null) return resolve();
    proceso.once('exit', () => resolve());
    proceso.kill();
  });
  return { url, detener, claveInterna: SECRETOS.AUTHCORE_INTERNAL_KEY };
};

module.exports = { levantarAuthcore };
