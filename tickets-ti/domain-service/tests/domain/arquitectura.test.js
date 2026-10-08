// Guardia de la arquitectura hexagonal: domain/ no puede depender de
// frameworks ni de capas externas (CLAUDE.md, sección "Hexagonal").
const fs = require('fs');
const path = require('path');

const DIR_DOMINIO = path.join(__dirname, '../../src/domain');
const PROHIBIDOS = [/^sequelize/, /^pg/, /^express/, /^socket\.io/, /^nodemailer/, /^axios/, /^node-cron/,
  /application\//, /infrastructure\//];

const listarJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return listarJs(ruta);
  return e.name.endsWith('.js') ? [ruta] : [];
});

const importsDe = (archivo) =>
  [...fs.readFileSync(archivo, 'utf8').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

describe('Arquitectura de domain/', () => {
  const archivos = listarJs(DIR_DOMINIO);

  it('debería tener archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [path.relative(DIR_DOMINIO, a), a]))(
    '%s no debería importar frameworks ni capas externas', (_nombre, archivo) => {
      const ilegales = importsDe(archivo).filter((imp) => PROHIBIDOS.some((p) => p.test(imp)));
      expect(ilegales).toEqual([]);
    });

  it('domain/ no debería leer el reloj del sistema (usa el puerto Clock)', () => {
    const conReloj = archivos.filter((a) => /new Date\(\)|Date\.now\(\)/.test(fs.readFileSync(a, 'utf8')));
    expect(conReloj.map((a) => path.basename(a))).toEqual([]);
  });
});
