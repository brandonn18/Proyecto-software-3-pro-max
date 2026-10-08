const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { bcryptRounds } = require('../config/auth');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING(255), allowNull: false },
  rol: {
    type: DataTypes.ENUM('usuario', 'tecnico', 'administrador'),
    defaultValue: 'usuario',
  },
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  intentos_login: { type: DataTypes.INTEGER, defaultValue: 0 },
  bloqueado_hasta: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, bcryptRounds);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, bcryptRounds);
      }
    },
  },
});

User.prototype.validarPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.deletedAt;
  return values;
};

module.exports = User;
