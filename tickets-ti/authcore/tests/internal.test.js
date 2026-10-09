/**
 * Contrato de /internal/* que consume AuthcoreUserAdapter en domain-service.
 */
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { crearTecnico, crearUsuario, obtenerToken } = require('./helpers/factories');

const conClave = (req, clave = process.env.AUTHCORE_INTERNAL_KEY) => req.set('x-internal-key', clave);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Protección de /internal', () => {
  it('debería responder 401 sin x-internal-key', async () => {
    const res = await request(app).get('/internal/tecnicos');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Clave interna inválida' });
  });

  it('debería responder 401 con una clave incorrecta', async () => {
    const res = await conClave(request(app).get('/internal/tecnicos'), 'clave_incorrecta');
    expect(res.status).toBe(401);
  });

  it('debería rechazar un JWT de usuario válido en lugar de la clave', async () => {
    const usuario = await crearUsuario();
    const res = await request(app).get('/internal/tecnicos').set('Authorization', `Bearer ${await obtenerToken(usuario)}`);
    expect(res.status).toBe(401);
  });

  it('no debería quedar expuesto bajo /api', async () => {
    const res = await conClave(request(app).get('/api/internal/tecnicos'));
    expect(res.status).toBe(404);
  });
});

describe('GET /internal/users/:id', () => {
  it('debería devolver { id, nombre, email, rol, activo } sin datos de login', async () => {
    const usuario = await crearUsuario({ nombre: 'Luis Directorio' });
    const res = await conClave(request(app).get(`/internal/users/${usuario.id}`));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: usuario.id, nombre: 'Luis Directorio', email: usuario.email, rol: 'usuario', activo: true });
  });

  it('debería devolver también usuarios inactivos', async () => {
    const usuario = await crearUsuario({ activo: false });
    const res = await conClave(request(app).get(`/internal/users/${usuario.id}`));
    expect(res.body.data.activo).toBe(false);
  });

  it('debería responder 404 si no existe', async () => {
    const res = await conClave(request(app).get('/internal/users/999999'));
    expect(res.status).toBe(404);
  });
});

describe('GET /internal/tecnicos', () => {
  it('debería listar solo técnicos activos, ordenados por nombre', async () => {
    await crearTecnico({ nombre: 'Zoe Activa' });
    await crearTecnico({ nombre: 'Ana Activa' });
    await crearTecnico({ nombre: 'Beto Inactivo', activo: false });
    const res = await conClave(request(app).get('/internal/tecnicos'));
    const nombres = res.body.data.map((t) => t.nombre);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b)));
    expect(nombres).toEqual(expect.arrayContaining(['Ana Activa', 'Zoe Activa']));
    expect(nombres).not.toContain('Beto Inactivo');
  });

  it('debería incluir inactivos con rol y activo si incluirInactivos=true', async () => {
    await crearTecnico({ nombre: 'Carla Inactiva', activo: false });
    const res = await conClave(request(app).get('/internal/tecnicos?incluirInactivos=true'));
    const carla = res.body.data.find((t) => t.nombre === 'Carla Inactiva');
    expect(carla).toMatchObject({ rol: 'tecnico', activo: false });
    expect(carla).not.toHaveProperty('password');
  });
});
