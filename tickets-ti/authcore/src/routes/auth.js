const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const { validar } = require('../middlewares/validar');

const reglasPassword = (campo) =>
  body(campo)
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe contener al menos 1 mayúscula')
    .matches(/[0-9]/).withMessage('Debe contener al menos 1 número');

router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], validar, ctrl.login);

router.post('/register', [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  reglasPassword('password'),
], validar, ctrl.register);

router.post('/logout', verifyToken, ctrl.logout);
router.post('/refresh', verifyToken, ctrl.refresh);
router.get('/me', verifyToken, ctrl.me);

router.put('/change-password', verifyToken, [
  body('passwordActual').notEmpty().withMessage('Contraseña actual requerida'),
  reglasPassword('passwordNuevo'),
], validar, ctrl.changePassword);

module.exports = { router, reglasPassword };
