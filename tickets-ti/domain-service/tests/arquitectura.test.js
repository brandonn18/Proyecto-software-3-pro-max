// Guardia de la arquitectura en capas: presentación → negocio → datos, nunca al
// revés y sin saltarse capas. comun/ es transversal: todas lo usan y él no
// conoce a ninguna.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const capa = (nombre) => new RegExp(`(^|/|\\.)${nombre}(/|$)`);
const PERSISTENCIA = [/^sequelize/, /^pg/];
const WEB = [/^express/, /^cors$/, /^helmet$/, /^morgan$/, /^sanitize-html$/];
const EXTERNOS = [/^socket\.io/, /^nodemailer/, /^node-cron/, /^jsonwebtoken/];

const REGLAS = [
  { nombre: 'comun', prohibidos: [capa('presentacion'), capa('negocio'), capa('datos'), ...PERSISTENCIA, ...WEB, ...EXTERNOS] },
  // Negocio no conoce HTTP ni consulta la base por su cuenta: usa los DAO
  { nombre: 'negocio', prohibidos: [capa('presentacion'), ...PERSISTENCIA, ...WEB, ...EXTERNOS] },
  // Datos no conoce reglas de negocio ni HTTP
  { nombre: 'datos', prohibidos: [capa('negocio'), capa('presentacion'), ...WEB] },
  // Presentación no se salta negocio para llegar a los datos
  { nombre: 'presentacion', prohibidos: [capa('datos'), ...PERSISTENCIA, /^socket\.io/, /^nodemailer/, /^jsonwebtoken/] },
];

const listarJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return listarJs(ruta);
  return e.name.endsWith('.js') ? [ruta] : [];
});

const importsDe = (archivo) =>
  [...fs.readFileSync(archivo, 'utf8').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

describe.each(REGLAS)('Capa $nombre/', ({ nombre, prohibidos }) => {
  const dir = path.join(SRC, nombre);
  const archivos = listarJs(dir);

  it('debería tener archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [path.relative(dir, a), a]))('%s solo debería depender de capas inferiores', (_nombre, archivo) => {
    const ilegales = importsDe(archivo).filter((imp) => prohibidos.some((p) => p.test(imp)));
    expect(ilegales).toEqual([]);
  });
});

describe('Ensamblaje', () => {
  it('solo src/capas.js debería conocer a la vez datos y negocio', () => {
    const raiz = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
    expect(raiz).toEqual(['capas.js']);
    expect(importsDe(path.join(SRC, 'capas.js'))).toEqual(['./datos', './negocio']);
  });

  it('las capas de arriba solo deberían usar datos/ a través de sus fachadas o integraciones', () => {
    const negocio = listarJs(path.join(SRC, 'negocio'));
    const aDatos = negocio.flatMap((a) => importsDe(a).filter((imp) => capa('datos').test(imp)));
    expect(aDatos.every((imp) => /datos\/integraciones\//.test(imp))).toBe(true);
  });
});
