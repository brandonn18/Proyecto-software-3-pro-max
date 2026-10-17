'use strict';

// Sin FKs a users: los usuarios viven en authcore (otra base, otra cuenta de AWS).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
      id: { type: Sequelize.STRING(20), primaryKey: true },
      titulo: { type: Sequelize.STRING(200), allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: false },
      tipo: { type: Sequelize.ENUM('incidente', 'solicitud'), allowNull: false },
      categoria: { type: Sequelize.ENUM('hardware', 'software', 'red', 'accesos', 'servicios_ti'), allowNull: false },
      prioridad: { type: Sequelize.ENUM('baja', 'media', 'alta', 'critica'), allowNull: false, defaultValue: 'media' },
      estado: {
        type: Sequelize.ENUM('abierto', 'asignado', 'en_proceso', 'en_espera', 'resuelto', 'cerrado'),
        allowNull: false,
        defaultValue: 'abierto',
      },
      usuarioId: { type: Sequelize.INTEGER, allowNull: false },
      usuario_nombre: { type: Sequelize.STRING(100), allowNull: false },
      tecnicoId: { type: Sequelize.INTEGER, allowNull: true },
      tecnico_nombre: { type: Sequelize.STRING(100), allowNull: true },
      reabierto: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      motivo_reapertura: { type: Sequelize.TEXT, allowNull: true },
      sla_limite: { type: Sequelize.DATE, allowNull: true },
      sla_alerta_enviada: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('tickets', ['estado']);
    await queryInterface.addIndex('tickets', ['tecnicoId', 'estado']);
    await queryInterface.addIndex('tickets', ['usuarioId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
    for (const tipo of ['tipo', 'categoria', 'prioridad', 'estado']) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_tickets_${tipo}";`);
    }
  },
};
