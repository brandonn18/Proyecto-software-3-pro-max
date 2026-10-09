/**
 * factories.js — helpers para crear datos de prueba reutilizables.
 * Requiere que la DB ya esté sincronizada (sequelize.sync) antes de usarse.
 */
const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models');

let _seq = 0;
const seq = () => String(++_seq).padStart(4, '0');

const PASSWORDS = { administrador: 'Admin123!', tecnico: 'Tecnico123!', usuario: 'Usuario123!' };

const _crear = (rol, prefijo) => (overrides = {}) =>
  User.create({
    nombre: `${prefijo} ${seq()}`,
    email: `${prefijo.toLowerCase()}${seq()}@factory.test`,
    password: PASSWORDS[rol],
    rol,
    ...overrides,
  });

const crearAdmin = _crear('administrador', 'Admin');
const crearTecnico = _crear('tecnico', 'Tecnico');
const crearUsuario = _crear('usuario', 'Usuario');

const obtenerToken = async (user) => {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORDS[user.rol] });
  return res.body.data?.token || null;
};

module.exports = { crearAdmin, crearTecnico, crearUsuario, obtenerToken, PASSWORDS };
