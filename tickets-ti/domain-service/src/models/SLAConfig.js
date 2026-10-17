// MODELO SLAConfig: horas y porcentaje de alerta por prioridad.
const { Model, DataTypes } = require('sequelize');
const { PRIORIDADES } = require('./apoyo/catalogos');
const { noEncontrado, errorValidacion } = require('./apoyo/errores');
const politicaSLA = require('./apoyo/politicaSLA');

const _enteroEnRango = (valor, campo, min, max) => {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw errorValidacion(`${campo} debe ser un entero entre ${min} y ${max}`);
  }
  return valor;
};

class SLAConfig extends Model {
  // → { horas, porcentajeAlerta? } con los valores por defecto si no hay fila
  static async reglaPara(prioridad) {
    const config = await this.findOne({ where: { prioridad } });
    return { horas: politicaSLA.horasPara(prioridad, config), porcentajeAlerta: config?.porcentaje_alerta };
  }

  static listarOrdenado() {
    return this.findAll({ order: [['tiempo_horas', 'ASC']] });
  }

  // Solo tiempo_horas y porcentaje_alerta son editables; la prioridad no cambia
  // (en el monolito se podía vía req.body).
  static async actualizarPermitido(id, { tiempo_horas, porcentaje_alerta }) {
    const cambios = {};
    if (tiempo_horas !== undefined) cambios.tiempo_horas = _enteroEnRango(tiempo_horas, 'tiempo_horas', 1, 8760);
    if (porcentaje_alerta !== undefined) cambios.porcentaje_alerta = _enteroEnRango(porcentaje_alerta, 'porcentaje_alerta', 1, 100);
    const config = await this.findByPk(id);
    if (!config) throw noEncontrado('Configuración SLA no encontrada');
    return config.update(cambios);
  }
}

const ATRIBUTOS = {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  prioridad: { type: DataTypes.ENUM(...PRIORIDADES), allowNull: false, unique: true },
  tiempo_horas: { type: DataTypes.INTEGER, allowNull: false },
  porcentaje_alerta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 80 },
};

const iniciar = (sequelize) => SLAConfig.init(ATRIBUTOS, { sequelize, modelName: 'SLAConfig', tableName: 'sla_configs', timestamps: true });

module.exports = { SLAConfig, iniciar };
