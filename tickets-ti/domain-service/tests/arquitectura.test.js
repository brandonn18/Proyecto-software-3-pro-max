// Guardia del diseño orientado a objetos:
// - entidades/, valores/, errores/, interfaces/ y servicios/ no dependen de
//   frameworks ni de infraestructura/, y no leen el reloj del sistema.
// - servicios/ solo conoce interfaces (clases abstractas), nunca implementaciones.
// - Encapsulamiento: las entidades y los valores no tienen campos públicos.
// - Cada implementación de infraestructura extiende la interfaz que cumple.
// - Solo src/Aplicacion.js instancia y conecta las clases concretas.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src');
const FRAMEWORKS = [/^sequelize/, /^pg/, /^express/, /^socket\.io/, /^nodemailer/, /^jsonwebtoken/, /^node-cron/, /^sanitize-html/];
const INFRAESTRUCTURA = /(^|\/)infraestructura(\/|$)/;
const NUCLEO = ['entidades', 'valores', 'errores', 'interfaces', 'servicios'];

const listarJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return listarJs(ruta);
  return e.name.endsWith('.js') ? [ruta] : [];
});
const leer = (archivo) => fs.readFileSync(archivo, 'utf8');
const importsDe = (archivo) => [...leer(archivo).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
const rel = (archivo) => path.relative(SRC, archivo).split(path.sep).join('/');

describe.each(NUCLEO)('%s/', (carpeta) => {
  const archivos = listarJs(path.join(SRC, carpeta));

  it('debería tener archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [rel(a), a]))('%s no debería importar frameworks ni infraestructura', (_n, archivo) => {
    expect(importsDe(archivo).filter((imp) => FRAMEWORKS.some((p) => p.test(imp)) || INFRAESTRUCTURA.test(imp))).toEqual([]);
  });

  it('no debería leer el reloj del sistema (usa la interfaz Reloj)', () => {
    expect(archivos.filter((a) => /new Date\(\)|Date\.now\(\)/.test(leer(a))).map(rel)).toEqual([]);
  });
});

describe('servicios/', () => {
  it('solo debería depender de interfaces, entidades, valores, errores y otros servicios', () => {
    const permitidos = /^\.\.\/(interfaces|entidades|valores|errores)(\/|$)|^\.\//;
    const ilegales = listarJs(path.join(SRC, 'servicios')).flatMap((a) => importsDe(a).filter((imp) => !permitidos.test(imp)).map((imp) => `${rel(a)} → ${imp}`));
    expect(ilegales).toEqual([]);
  });
});

describe('Encapsulamiento', () => {
  it.each(['entidades', 'valores'])('%s/ no debería asignar campos públicos (solo #privados)', (carpeta) => {
    const publicos = listarJs(path.join(SRC, carpeta)).filter((a) => /this\.[A-Za-z_]\w*\s*=(?!=)/.test(leer(a)));
    expect(publicos.map(rel)).toEqual([]);
  });
});

describe('Herencia de las implementaciones', () => {
  const INTERFACES = Object.keys(require('../src/interfaces'));
  const concretas = listarJs(path.join(SRC, 'infraestructura')).filter((a) => /^(Repositorio|Consulta|Directorio|Correo|Canal|Reloj)/.test(path.basename(a)));

  it.each(concretas.map((a) => [rel(a), a]))('%s debería extender una interfaz', (_n, archivo) => {
    const padre = leer(archivo).match(/class \w+ extends (\w+)/)?.[1];
    expect(INTERFACES).toContain(padre);
  });
});

describe('Composición', () => {
  it('fuera de infraestructura/, solo Aplicacion.js debería importar clases de infraestructura', () => {
    const ilegales = listarJs(SRC).filter((a) => !INFRAESTRUCTURA.test(rel(a)) && rel(a) !== 'Aplicacion.js')
      .flatMap((a) => importsDe(a).filter((imp) => INFRAESTRUCTURA.test(imp)).map((imp) => `${rel(a)} → ${imp}`));
    expect(ilegales).toEqual([]);
  });

  it('la capa HTTP no debería tocar la persistencia', () => {
    const ilegales = listarJs(path.join(SRC, 'infraestructura/http')).flatMap((a) => importsDe(a).filter((imp) => /persistencia|^sequelize/.test(imp)));
    expect(ilegales).toEqual([]);
  });
});
