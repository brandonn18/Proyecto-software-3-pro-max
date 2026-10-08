const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/users.controller');
const { verifyToken } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roles');
const { validar } = require('../middlewares/validar');
const { reglasPassword } = require('./auth');

const ROLES = ['usuario', 'tecnico', 'administrador'];
const soloAdmin = requireRole('administrador');
const idValido = [param('id').isInt().withMessage('id inválido'), validar];

router.use(verifyToken);

// Técnicos disponibles (admin y técnico, para asignaciones)
router.get('/technicians/available', requireRole('administrador', 'tecnico'), ctrl.getTecnicos);
// Alias legacy para compatibilidad con el frontend actual
router.get('/tecnicos', requireRole('administrador', 'tecnico'), ctrl.getTecnicos);

router.get('/', soloAdmin, ctrl.getAll);
router.get('/:id', soloAdmin, idValido, ctrl.getById);

router.post('/', soloAdmin, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  reglasPassword('password'),
  body('rol').isIn(ROLES).withMessage('Rol inválido'),
], validar, ctrl.create);

router.put('/:id', soloAdmin, idValido, [
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('rol').optional().isIn(ROLES).withMessage('Rol inválido'),
  body('activo').optional().isBoolean().withMessage('activo debe ser booleano'),
], validar, ctrl.update);

// Soft-delete: desactiva el usuario (activo=false)
router.delete('/:id', soloAdmin, idValido, ctrl.remove);
router.post('/:id/reset-password', soloAdmin, idValido, ctrl.resetPassword);
// Legacy toggle para el frontend
router.patch('/:id/toggle-activo', soloAdmin, idValido, ctrl.toggleActivo);

module.exports = router;
