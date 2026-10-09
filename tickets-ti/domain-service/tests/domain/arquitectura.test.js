// Guardia de la arquitectura hexagonal (CLAUDE.md, sección "Hexagonal"):
// domain/ y application/ no dependen de frameworks ni de infrastructure/,
// y ninguna de las dos lee el reloj del sistema (usan el puerto Clock).
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../src');
const FRAMEWORKS = [/^sequelize/, /^pg/, /^express/, /^socket\.io/, /^nodemailer/, /^axios/, /^node-cron/];

const CAPAS = [
  { nombre: 'domain', prohibidos: [...FRAMEWORKS, /application\//, /infrastructure\//], sinReloj: true },
  { nombre: 'application', prohibidos: [...FRAMEWORKS, /infrastructure\//], sinReloj: true },
  // Los controllers solo traducen HTTP → caso de uso: nada de Sequelize ni repositorios
  { nombre: 'infrastructure/http', prohibidos: [/^sequelize/, /^pg/, /persistencia\//, /directorio\//], sinReloj: false },
];

const listarJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return listarJs(ruta);
  return e.name.endsWith('.js') ? [ruta] : [];
});

const importsDe = (archivo) =>
  [...fs.readFileSync(archivo, 'utf8').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

describe.each(CAPAS)('Arquitectura de $nombre/', ({ nombre, prohibidos, sinReloj }) => {
  const dir = path.join(SRC, nombre);
  const archivos = listarJs(dir);

  it('debería tener archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [path.relative(dir, a), a]))(
    '%s no debería importar frameworks ni capas externas', (_nombre, archivo) => {
      const ilegales = importsDe(archivo).filter((imp) => prohibidos.some((p) => p.test(imp)));
      expect(ilegales).toEqual([]);
    });

  if (sinReloj) {
    it('no debería leer el reloj del sistema (usa el puerto Clock)', () => {
      const conReloj = archivos.filter((a) => /new Date\(\)|Date\.now\(\)/.test(fs.readFileSync(a, 'utf8')));
      expect(conReloj.map((a) => path.relative(dir, a))).toEqual([]);
    });
  }
});
