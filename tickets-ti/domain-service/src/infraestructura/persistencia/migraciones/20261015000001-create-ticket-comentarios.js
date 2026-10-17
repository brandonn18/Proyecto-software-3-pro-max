'use strict';

// Comentarios de tickets (MODULO_COMENTARIOS). Tabla nueva: no altera las
// existentes, así que se puede aplicar aunque el módulo esté apagado.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_comentarios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: {
        type: Sequelize.STRING(20), allowNull: false,
        references: { model: 'tickets', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      autorId: { type: Sequelize.INTEGER, allowNull: false },
      autor_nombre: { type: Sequelize.STRING(100), allowNull: false },
      autor_rol: { type: Sequelize.STRING(20), allowNull: false },
      texto: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('ticket_comentarios', ['ticketId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_comentarios');
  },
};
