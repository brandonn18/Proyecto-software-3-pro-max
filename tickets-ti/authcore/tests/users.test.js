// jest.mock se iza al tope: intercepta antes de que userService importe emailService
jest.mock('../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'mock-test' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-test' }),
}));

const request = require('supertest');
const app = require('../src/app');
const { sequelize, AuditLog } = require('../src/models');
const emailService = require('../src/services/emailService');
const { crearAdmin, crearTecnico, crearUsuario, obtenerToken } = require('./helpers/factories');

let admin, adminToken;

const comoAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);
const datosNuevo = (overrides = {}) => ({
  nombre: 'Técnico Nuevo', email: `nuevo${Date.now()}${Math.random()}@test.com`, password: 'Tecnico123!', rol: 'tecnico', ...overrides,
});

beforeAll(async () => {
  await sequelize.sync({ force: true });
  admin = await crearAdmin();
  adminToken = await obtenerToken(admin);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CP011 — Admin crea usuario con rol asignado', () => {
  it('debería crear el usuario con su rol y sin password en la respuesta', async () => {
    const res = await comoAdmin(request(app).post('/api/users')).send(datosNuevo());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rol: 'tecnico', activo: true });
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('debería enviar el email de bienvenida y auditar CREAR_USUARIO', async () => {
    const datos = datosNuevo({ rol: 'usuario' });
    await comoAdmin(request(app).post('/api/users')).send(datos);
    const audit = await AuditLog.findOne({ where: { usuarioId: admin.id, accion: 'CREAR_USUARIO' }, order: [['id', 'DESC']] });
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendWelcomeEmail.mock.calls[0][0]).toHaveProperty('email', datos.email);
    expect(audit.detalle).toEqual({ email: datos.email, rol: 'usuario' });
  });

  it('debería responder 409 si el email ya existe', async () => {
    const existente = await crearUsuario();
    const res = await comoAdmin(request(app).post('/api/users')).send(datosNuevo({ email: existente.email }));
    expect(res.status).toBe(409);
  });

  it('debería responder 403 si quien crea no es administrador', async () => {
    const usuario = await crearUsuario();
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${await obtenerToken(usuario)}`).send(datosNuevo());
    expect(res.status).toBe(403);
  });

  it('debería responder 400 con rol inválido', async () => {
    const res = await comoAdmin(request(app).post('/api/users')).send(datosNuevo({ rol: 'superusuario' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/users', () => {
  it('debería listar con meta de paginación y sin password', async () => {
    const res = await comoAdmin(request(app).get('/api/users?limit=2'));
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
    res.body.data.forEach((u) => expect(u).not.toHaveProperty('password'));
  });

  it('debería filtrar por rol y búsqueda', async () => {
    await crearTecnico({ nombre: 'Zacarías Buscable' });
    const res = await comoAdmin(request(app).get('/api/users?rol=tecnico&search=zacar'));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nombre).toBe('Zacarías Buscable');
  });
});

describe('GET /api/users/:id', () => {
  it('debería devolver el usuario', async () => {
    const usuario = await crearUsuario();
    const res = await comoAdmin(request(app).get(`/api/users/${usuario.id}`));
    expect(res.body.data).toMatchObject({ id: usuario.id, email: usuario.email });
  });

  it('debería responder 404 si no existe', async () => {
    const res = await comoAdmin(request(app).get('/api/users/999999'));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Usuario no encontrado' });
  });

  it('debería responder 400 con id no numérico', async () => {
    const res = await comoAdmin(request(app).get('/api/users/abc'));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/:id', () => {
  it('debería actualizar solo los campos permitidos', async () => {
    const usuario = await crearUsuario();
    const res = await comoAdmin(request(app).put(`/api/users/${usuario.id}`)).send({ nombre: 'Renombrado', intentos_login: 99 });
    await usuario.reload();
    expect(res.status).toBe(200);
    expect(usuario.nombre).toBe('Renombrado');
    expect(usuario.intentos_login).toBe(0);
  });
});

describe('DELETE /api/users/:id', () => {
  it('debería desactivar al usuario sin borrarlo', async () => {
    const usuario = await crearUsuario();
    const res = await comoAdmin(request(app).delete(`/api/users/${usuario.id}`));
    await usuario.reload();
    expect(res.body).toEqual({ success: true, data: null, message: 'Usuario desactivado correctamente' });
    expect(usuario.activo).toBe(false);
  });

  it('debería responder 400 si el admin intenta desactivarse a sí mismo', async () => {
    const res = await comoAdmin(request(app).delete(`/api/users/${admin.id}`));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No puedes desactivar tu propia cuenta');
  });
});

describe('POST /api/users/:id/reset-password', () => {
  it('debería desbloquear, enviar email con la temporal y permitir login con ella', async () => {
    const usuario = await crearUsuario({ intentos_login: 5, bloqueado_hasta: new Date(Date.now() + 600000) });
    const res = await comoAdmin(request(app).post(`/api/users/${usuario.id}/reset-password`));
    const temporal = emailService.sendPasswordResetEmail.mock.calls[0][1];
    const relogin = await request(app).post('/api/auth/login').send({ email: usuario.email, password: temporal });
    expect(res.body.message).toBe(`Contraseña temporal enviada al correo ${usuario.email}`);
    expect(temporal).toMatch(/^[A-Za-z2-9]{8}1!$/);
    expect(relogin.status).toBe(200);
  });
});

describe('PATCH /api/users/:id/toggle-activo', () => {
  it('debería alternar activo', async () => {
    const usuario = await crearUsuario();
    const res = await comoAdmin(request(app).patch(`/api/users/${usuario.id}/toggle-activo`));
    expect(res.body).toMatchObject({ data: { activo: false }, message: 'Usuario desactivado' });
  });
});

describe('GET /api/users/tecnicos', () => {
  it('debería listar solo técnicos activos como { id, nombre, email } para un técnico', async () => {
    const tecnico = await crearTecnico();
    const inactivo = await crearTecnico({ activo: false });
    const res = await request(app).get('/api/users/tecnicos').set('Authorization', `Bearer ${await obtenerToken(tecnico)}`);
    const ids = res.body.data.map((t) => t.id);
    expect(res.status).toBe(200);
    res.body.data.forEach((t) => expect(Object.keys(t).sort()).toEqual(['email', 'id', 'nombre']));
    expect(ids).toContain(tecnico.id);
    expect(ids).not.toContain(inactivo.id);
  });

  it('debería responder 403 a un usuario normal', async () => {
    const usuario = await crearUsuario();
    const res = await request(app).get('/api/users/tecnicos').set('Authorization', `Bearer ${await obtenerToken(usuario)}`);
    expect(res.status).toBe(403);
  });
});
