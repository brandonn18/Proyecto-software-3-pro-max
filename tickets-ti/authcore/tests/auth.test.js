/**
 * Port de tests/auth.test.js, tests/unit/auth.test.js (CP007, CP008, refresh)
 * y tests/characterization/contratoAuth.test.js del monolito.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize, User, AuditLog } = require('../src/models');
const { crearUsuario, crearAdmin, obtenerToken, PASSWORDS } = require('./helpers/factories');

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
const conToken = (req, token) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /api/auth/login', () => {
  it('CP007 - debería retornar { token, user } sin password con credenciales válidas', async () => {
    const usuario = await crearUsuario({ nombre: 'Pedro Usuario' });
    const res = await login(usuario.email, PASSWORDS.usuario);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['token', 'user']);
    expect(res.body.data.user).toMatchObject({ email: usuario.email, nombre: 'Pedro Usuario', rol: 'usuario' });
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(res.body.data.user).not.toHaveProperty('deletedAt');
  });

  it('CP007 - debería reiniciar intentos_login tras un login exitoso', async () => {
    const admin = await crearAdmin();
    await login(admin.email, 'incorrecta');
    await login(admin.email, PASSWORDS.administrador);
    await admin.reload();
    expect(admin.intentos_login).toBe(0);
  });

  it('debería responder 401 genérico con contraseña incorrecta e incrementar intentos', async () => {
    const usuario = await crearUsuario();
    const res = await login(usuario.email, 'incorrecta');
    await usuario.reload();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'Credenciales inválidas' });
    expect(usuario.intentos_login).toBe(1);
  });

  it('debería responder 401 con email inexistente', async () => {
    const res = await login('noexiste@test.com', 'Admin123!');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas');
  });

  it('debería responder 400 con errors si faltan campos', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('debería responder 403 si la cuenta está inactiva', async () => {
    const usuario = await crearUsuario({ activo: false });
    const res = await login(usuario.email, PASSWORDS.usuario);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cuenta inactiva');
  });

  it('debería auditar LOGIN_EXITOSO', async () => {
    const usuario = await crearUsuario();
    await login(usuario.email, PASSWORDS.usuario);
    const audit = await AuditLog.findOne({ where: { usuarioId: usuario.id, accion: 'LOGIN_EXITOSO' } });
    expect(audit).not.toBeNull();
  });
});

describe('CP008 — Bloqueo de cuenta tras 5 intentos fallidos', () => {
  it('debería bloquear en el 5.º intento y responder 423 aun con la contraseña correcta', async () => {
    const usuario = await crearUsuario();
    for (let i = 0; i < 5; i++) await login(usuario.email, 'incorrecta');

    const res = await login(usuario.email, PASSWORDS.usuario);
    await usuario.reload();

    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/bloqueada/i);
    expect(new Date(usuario.bloqueado_hasta).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('POST /api/auth/register', () => {
  it('debería registrar con rol usuario y devolver token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Nuevo', email: 'nuevo@test.com', password: 'Nuevo123!', rol: 'administrador',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.rol).toBe('usuario');
  });

  it('debería rechazar contraseña débil con 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ nombre: 'X', email: 'debil@test.com', password: 'weak' });
    expect(res.status).toBe(400);
  });

  it('debería rechazar email duplicado con 409', async () => {
    const usuario = await crearUsuario();
    const res = await request(app).post('/api/auth/register').send({ nombre: 'Dup', email: usuario.email, password: 'Admin123!' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, message: 'El email ya está registrado' });
  });
});

describe('Contrato JWT', () => {
  it('debería incluir exactamente id, email, rol, nombre, iat y exp', async () => {
    const usuario = await crearUsuario();
    const payload = jwt.decode(await obtenerToken(usuario));
    expect(Object.keys(payload).sort()).toEqual(['email', 'exp', 'iat', 'id', 'nombre', 'rol']);
    expect(payload).toMatchObject({ id: usuario.id, email: usuario.email, rol: 'usuario', nombre: usuario.nombre });
  });

  it('debería expirar según JWT_EXPIRES_IN (1h: domain-service no ve el logout)', async () => {
    const usuario = await crearUsuario();
    const { iat, exp } = jwt.decode(await obtenerToken(usuario));
    expect(exp - iat).toBe(60 * 60);
  });
});

describe('verifyToken', () => {
  it('debería responder 401 sin header Authorization', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Token no proporcionado' });
  });

  it('debería responder 401 con token malformado', async () => {
    const res = await conToken(request(app).get('/api/auth/me'), 'tokenbasura');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('debería responder 401 con token firmado con otro secreto', async () => {
    const falso = jwt.sign({ id: 1, rol: 'administrador' }, 'otro_secreto_cualquiera_de_32_chars!!');
    const res = await conToken(request(app).get('/api/auth/me'), falso);
    expect(res.status).toBe(401);
  });

  it('debería responder 401 si el usuario fue desactivado después del login', async () => {
    const usuario = await crearUsuario();
    const token = await obtenerToken(usuario);
    await User.update({ activo: false }, { where: { id: usuario.id } });
    const res = await conToken(request(app).get('/api/auth/me'), token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Usuario no válido o inactivo' });
  });

  it('debería responder 401 con "Token invalidado" después de logout', async () => {
    const usuario = await crearUsuario();
    const token = await obtenerToken(usuario);
    const logout = await conToken(request(app).post('/api/auth/logout'), token);
    const res = await conToken(request(app).get('/api/auth/me'), token);
    expect(logout.status).toBe(200);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalidado');
  });
});

describe('GET /api/auth/me', () => {
  it('debería devolver el usuario autenticado sin password', async () => {
    const usuario = await crearUsuario();
    const res = await conToken(request(app).get('/api/auth/me'), await obtenerToken(usuario));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: usuario.id, email: usuario.email, rol: 'usuario', activo: true });
    expect(res.body.data).not.toHaveProperty('password');
  });
});

describe('POST /api/auth/refresh', () => {
  const firmar = (usuario, expiresIn) =>
    jwt.sign({ id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre }, process.env.JWT_SECRET, { expiresIn });

  it('debería renovar un token al que le queda menos de 1 hora', async () => {
    const usuario = await crearUsuario();
    const token = firmar(usuario, '1800s');
    const res = await conToken(request(app).post('/api/auth/refresh'), token);
    expect(res.status).toBe(200);
    expect(res.body.data.token).not.toBe(token);
  });

  it('debería responder 400 si al token le queda más de 1 hora', async () => {
    const usuario = await crearUsuario();
    const res = await conToken(request(app).post('/api/auth/refresh'), firmar(usuario, '8h'));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/auth/change-password', () => {
  it('debería cambiar la contraseña y permitir login con la nueva', async () => {
    const usuario = await crearUsuario();
    const res = await conToken(request(app).put('/api/auth/change-password'), await obtenerToken(usuario))
      .send({ passwordActual: PASSWORDS.usuario, passwordNuevo: 'NuevaClave123' });
    const relogin = await login(usuario.email, 'NuevaClave123');
    expect(res.status).toBe(200);
    expect(relogin.status).toBe(200);
  });

  it('debería responder 400 si la contraseña actual es incorrecta', async () => {
    const usuario = await crearUsuario();
    const res = await conToken(request(app).put('/api/auth/change-password'), await obtenerToken(usuario))
      .send({ passwordActual: 'Incorrecta1', passwordNuevo: 'NuevaClave123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Contraseña actual incorrecta');
  });
});
