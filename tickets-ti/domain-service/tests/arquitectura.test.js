// Guardia de Modelo-Vista-Controlador:
// - models/ tiene los datos y las reglas; no conoce HTTP, vistas ni controladores.
// - views/ son funciones puras: reciben datos y devuelven JSON/HTML; no consultan nada.
// - controllers/ orquestan: reciben los modelos ya definidos (no los importan),
//   llaman a sus métodos y eligen la vista. No hacen consultas.
// - routes/ conectan cada path (o expresión cron) con una acción del controlador.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const carpeta = (nombre) => new RegExp(`(^|/|\\.)${nombre}(/|$)`);
const PERSISTENCIA = [/^sequelize/, /^pg/];
const WEB = [/^express$/, /^cors$/, /^helmet$/, /^morgan$/, /^sanitize-html$/, /^express-validator$/];
const EXTERNOS = [/^socket\.io/, /^nodemailer/, /^jsonwebtoken/, /^node-cron/];
// Constantes compartidas que cualquiera puede leer
const MODELO_SALVO_CONSTANTES = /models\/(?!apoyo\/(errores|catalogos)$)/;

const REGLAS = [
  { nombre: 'models', prohibidos: [...WEB, ...EXTERNOS, carpeta('views'), carpeta('controllers'), carpeta('routes'), carpeta('middlewares'), carpeta('lib')] },
  { nombre: 'views', prohibidos: [...PERSISTENCIA, ...WEB, ...EXTERNOS, carpeta('models'), carpeta('controllers'), carpeta('routes'), carpeta('lib')] },
  { nombre: 'controllers', prohibidos: [...PERSISTENCIA, ...EXTERNOS, MODELO_SALVO_CONSTANTES, /\.\.\/models$/, carpeta('routes'), carpeta('lib')] },
  { nombre: 'routes', prohibidos: [...PERSISTENCIA, carpeta('controllers'), carpeta('views'), carpeta('lib')] },
  { nombre: 'lib', prohibidos: [...WEB, carpeta('controllers'), carpeta('routes'), carpeta('middlewares'), /views\/(?!correos\/)/] },
];

const listarJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return listarJs(ruta);
  return e.name.endsWith('.js') ? [ruta] : [];
});

const importsDe = (archivo) =>
  [...fs.readFileSync(archivo, 'utf8').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

describe.each(REGLAS)('$nombre/', ({ nombre, prohibidos }) => {
  const dir = path.join(SRC, nombre);
  const archivos = listarJs(dir);

  it('debería tener archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [path.relative(dir, a), a]))('%s debería respetar su papel en MVC', (_nombre, archivo) => {
    const ilegales = importsDe(archivo).filter((imp) => prohibidos.some((p) => p.test(imp)));
    expect(ilegales).toEqual([]);
  });
});

describe('Vistas puras', () => {
  it('ninguna vista debería ser async ni hacer await', () => {
    const conEspera = listarJs(path.join(SRC, 'views')).filter((a) => /\basync\b|\bawait\b/.test(fs.readFileSync(a, 'utf8')));
    expect(conEspera.map((a) => path.relative(SRC, a))).toEqual([]);
  });
});

describe('Controladores sin consultas', () => {
  it('ningún controlador debería llamar a findAll/findOne/count/create/update de Sequelize directamente', () => {
    const consultas = /\.(findAll|findOne|findByPk|findAndCountAll|count|create|bulkCreate)\(/;
    const ilegales = listarJs(path.join(SRC, 'controllers')).filter((a) => consultas.test(fs.readFileSync(a, 'utf8')));
    expect(ilegales.map((a) => path.relative(SRC, a))).toEqual([]);
  });
});
