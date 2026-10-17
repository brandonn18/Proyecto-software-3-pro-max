const { Router } = require('express');
const { body, param, query } = require('express-validator');
const Autenticacion = require('../Autenticacion');
const Validacion = require('../Validacion');

const soloAdmin = Autenticacion.requiereRol('administrador');
const adminOTecnico = Autenticacion.requiereRol('administrador', 'tecnico');
const validar = Validacion.resultado;

const REGLAS_SLA = [
  param('id').isInt().withMessage('id inválido'),
  body('tiempo_horas').optional().isInt({ min: 1 }).withMessage('tiempo_horas debe ser entero positivo').toInt(),
  body('porcentaje_alerta').optional().isInt({ min: 1, max: 100 }).withMessage('porcentaje_alerta entre 1 y 100').toInt(),
];

class RutasDeReportes {
  // /api/reports — incluye /sla-config por compatibilidad con el frontend
  static crear(ctrl, slaCtrl) {
    const router = Router();
    router.get('/summary', soloAdmin, ctrl.resumenAdmin);
    router.get('/tickets-by-period', soloAdmin, [
      query('period').optional().isIn(['week', 'month', 'quarter']).withMessage('period inválido'),
    ], validar, ctrl.ticketsPorPeriodo);
    router.get('/technician-performance', soloAdmin, ctrl.rendimientoTecnicos);
    router.get('/sla-compliance', soloAdmin, ctrl.cumplimientoSLA);
    router.get('/my-dashboard', adminOTecnico, ctrl.dashboardTecnico);
    router.get('/my-tickets-summary', ctrl.resumenUsuario);
    router.get('/resumen', adminOTecnico, ctrl.resumenGeneral);
    router.get('/sla', adminOTecnico, ctrl.estadoSLA);
    router.get('/por-tecnico', adminOTecnico, ctrl.porTecnico);
    router.get('/sla-config', slaCtrl.listar);
    router.put('/sla-config/:id', soloAdmin, REGLAS_SLA, validar, slaCtrl.actualizar);
    return router;
  }

  // /api/sla
  static crearSLA(slaCtrl) {
    const router = Router();
    router.get('/', slaCtrl.listar);
    router.put('/:id', soloAdmin, REGLAS_SLA, validar, slaCtrl.actualizar);
    return router;
  }
}

module.exports = RutasDeReportes;
