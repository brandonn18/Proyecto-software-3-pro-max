'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: {
        type: Sequelize.STRING(20), allowNull: true,
        references: { model: 'tickets', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      usuarioId: { type: Sequelize.INTEGER, allowNull: true },
      usuario_nombre: { type: Sequelize.STRING(100), allowNull: true },
      accion: { type: Sequelize.STRING(100), allowNull: false },
      detalle: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['ticketId']);

    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      usuarioId: { type: Sequelize.INTEGER, allowNull: false },
      ticketId: {
        type: Sequelize.STRING(20), allowNull: true,
        references: { model: 'tickets', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      tipo: { type: Sequelize.STRING(50), allowNull: false },
      mensaje: { type: Sequelize.TEXT, allowNull: false },
      leida: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('notifications', ['usuarioId', 'leida']);

    await queryInterface.createTable('sla_configs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      prioridad: { type: Sequelize.ENUM('baja', 'media', 'alta', 'critica'), allowNull: false, unique: true },
      tiempo_horas: { type: Sequelize.INTEGER, allowNull: false },
      porcentaje_alerta: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 80 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    const ahora = new Date();
    await queryInterface.bulkInsert('sla_configs', [
      { prioridad: 'critica', tiempo_horas: 4, porcentaje_alerta: 80, createdAt: ahora, updatedAt: ahora },
      { prioridad: 'alta', tiempo_horas: 8, porcentaje_alerta: 80, createdAt: ahora, updatedAt: ahora },
      { prioridad: 'media', tiempo_horas: 24, porcentaje_alerta: 80, createdAt: ahora, updatedAt: ahora },
      { prioridad: 'baja', tiempo_horas: 72, porcentaje_alerta: 80, createdAt: ahora, updatedAt: ahora },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sla_configs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sla_configs_prioridad";');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('audit_logs');
  },
};
