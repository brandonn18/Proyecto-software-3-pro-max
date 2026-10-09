/**
 * Caracterización del contrato de autenticación del monolito.
 * Fija el comportamiento que authcore debe conservar y el que domain-service
 * necesita del JWT (claims) antes de separar los servicios.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { crearUsuario, obtenerToken } = require('../helpers/factories');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Contrato JWT', () => {
  it('debería incluir id, email, rol, nombre, iat y exp en el payload', async () => {
    // Arrange
    const usuario = await crearUsuario();
    // Act
    const token = await obtenerToken(usuario.email, 'Usuario123!');
    const payload = jwt.decode(token);
    // Assert
    expect(Object.keys(payload).sort()).toEqual(['email', 'exp', 'iat', 'id', 'nombre', 'rol']);
    expect(payload).toMatchObject({ id: usuario.id, email: usuario.email, rol: 'usuario', nombre: usuario.nombre });
  });

  it('debería expirar según JWT_EXPIRES_IN (8h en test)', async () => {
    const usuario = await crearUsuario();
    const { iat, exp } = jwt.decode(await obtenerToken(usuario.email, 'Usuario123!'));
    expect(exp - iat).toBe(8 * 60 * 60);
  });
});

describe('Contrato de login', () => {
  it('debería responder { token, user } sin password', async () => {
    const usuario = await crearUsuario();
    const res = await request(app).post('/api/auth/login').send({ email: usuario.email, password: 'Usuario123!' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['token', 'user']);
    expect(res.body.data.user).not.toHaveProperty('password');
  });
});

describe('Contrato de verifyToken', () => {
  it('debería rechazar con 401 el token de un usuario desactivado después del login', async () => {
    // Comportamiento actual: verifyToken consulta la BD en cada request.
    // Con JWT sin estado en domain-service este caso dejará de cumplirse allí.
    const usuario = await crearUsuario();
    const token = await obtenerToken(usuario.email, 'Usuario123!');
    await User.update({ activo: false }, { where: { id: usuario.id } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Usuario no válido o inactivo' });
  });

  it('debería rechazar con 401 un token después de logout', async () => {
    const usuario = await crearUsuario();
    const token = await obtenerToken(usuario.email, 'Usuario123!');

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${token}`);

    expect(logout.status).toBe(200);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalidado');
  });

  it('debería rechazar con 401 un token firmado con otro secreto', async () => {
    const falso = jwt.sign({ id: 1, rol: 'administrador' }, 'otro_secreto_cualquiera_de_32_chars!!');
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
  });

  it('debería rechazar con 401 un request sin header Authorization', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Token no proporcionado' });
  });
});

describe('Contrato de /api/auth/me', () => {
  it('debería devolver el usuario sin password', async () => {
    const usuario = await crearUsuario();
    const token = await obtenerToken(usuario.email, 'Usuario123!');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: usuario.id, email: usuario.email, rol: 'usuario', activo: true });
    expect(res.body.data).not.toHaveProperty('password');
  });
});
