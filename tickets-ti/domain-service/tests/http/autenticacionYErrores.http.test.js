const request = require('supertest');
const jwt = require('jsonwebtoken');
const { abrirServidorDePrueba, USUARIOS, tokenPara } = require('./servidorDePrueba');
const ManejadorDeErrores = require('../../src/infraestructura/http/ManejadorDeErrores');
const ProgramadorDeTareas = require('../../src/infraestructura/ProgramadorDeTareas');

const { CADA_15_MIN, CADA_5_MIN } = ProgramadorDeTareas;

let s;

beforeAll(async () => { s = await abrirServidorDePrueba(); await s.reiniciar(); });
afterAll(async () => { await s.cerrar(); });

const conToken = (token) => request(s.app).get('/api/tickets').set('Authorization', `Bearer ${token}`);

describe('Autenticación por JWT de authcore (sin consultar authcore)', () => {
  it('debería responder 401 sin token', async () => {
    const res = await request(s.app).get('/api/tickets');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Token no proporcionado' });
  });

  it.each([
    ['firmado con otro secreto', () => tokenPara(USUARIOS.admin, { secreto: 'otro_secreto_de_32_caracteres_minimo!' })],
    ['expirado', () => tokenPara(USUARIOS.admin, { expiresIn: -10 })],
    ['malformado', () => 'no.es.jwt'],
    ['sin rol válido', () => jwt.sign({ sub: 'x', uid: 1, roles: ['SUPERUSUARIO'] }, process.env.JWT_SECRET)],
    ['sin sub', () => jwt.sign({ uid: 1, roles: ['ADMIN'] }, process.env.JWT_SECRET)],
    ['sin uid', () => jwt.sign({ sub: 'admin', roles: ['ADMIN'] }, process.env.JWT_SECRET)],
    ['con el formato del authcore anterior', () => jwt.sign({ id: 1, rol: 'administrador', nombre: 'X' }, process.env.JWT_SECRET)],
  ])('debería responder 401 con un token %s', async (_caso, generar) => {
    const res = await conToken(generar());
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token inválido o expirado');
  });

  it('debería aceptar un token válido sin llamar al directorio', async () => {
    const espia = jest.spyOn(s.directorio, 'obtenerUsuario');
    expect((await conToken(tokenPara(USUARIOS.luis))).status).toBe(200);
    expect(espia).not.toHaveBeenCalled();
  });

  it('debería exponer /api/health sin token y 404 JSON en rutas desconocidas', async () => {
    expect((await request(s.app).get('/api/health')).body.data).toEqual({ status: 'ok', servicio: 'domain-service' });
    const res = await request(s.app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('debería responder 400 con JSON malformado', async () => {
    const res = await request(s.app).post('/api/tickets')
      .set('Authorization', `Bearer ${tokenPara(USUARIOS.luis)}`).set('Content-Type', 'application/json').send('{"titulo":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('JSON inválido');
  });
});

describe('errorHandler', () => {
  const resFalso = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it('no debería filtrar el mensaje interno en un 500', () => {
    const res = resFalso();
    const logger = { error: jest.fn() };
    new ManejadorDeErrores(logger).middleware(new Error('detalle interno de la BD'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Error interno del servidor', errors: [] });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('programarTareas', () => {
  const cronFalso = () => {
    const tareas = {};
    return { tareas, schedule: jest.fn((expr, fn) => { tareas[expr] = fn; return { stop: jest.fn() }; }) };
  };

  it('debería programar SLA cada 15 min y estadísticas cada 5 min', async () => {
    const cron = cronFalso();
    const tareas = { verificarSLA: jest.fn().mockResolvedValue(2), publicarEstadisticas: jest.fn().mockResolvedValue({}) };
    const logger = { error: jest.fn(), info: jest.fn() };
    new ProgramadorDeTareas({ tareas, cron, logger }).programar();
    await cron.tareas[CADA_15_MIN]();
    await cron.tareas[CADA_5_MIN]();
    expect(tareas.verificarSLA).toHaveBeenCalled();
    expect(tareas.publicarEstadisticas).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[SLA] 2 alerta(s) generadas');
  });

  it('debería registrar el error de una tarea sin propagarlo', async () => {
    const cron = cronFalso();
    const logger = { error: jest.fn() };
    const tareas = { verificarSLA: jest.fn().mockRejectedValue(new Error('BD caída')), publicarEstadisticas: jest.fn() };
    new ProgramadorDeTareas({ tareas, cron, logger }).programar();
    await expect(cron.tareas[CADA_15_MIN]()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('[SLA] error:', 'BD caída');
  });
});

describe('Aplicacion#crearHttp detrás de un proxy', () => {
  it('debería confiar en X-Forwarded-For solo si se configura trustProxy', () => {
    const base = { jwtSecret: 'x', esTest: true };
    expect(s.aplicacion.crearHttp({ ...base, trustProxy: 1 }).get('trust proxy')).toBe(1);
    expect(s.aplicacion.crearHttp(base).get('trust proxy')).toBe(false);
  });
});
