// CONTROLADOR de tareas programadas: llama a los modelos y empuja la vista
// de estadísticas a los admins. Los modelos se reemplazan por dobles.
const { crearTareasController } = require('../../src/controllers/tareas.controller');
const { RealtimeEspia } = require('../dobles');

describe('crearTareasController', () => {
  const modelos = {
    Ticket: { verificarSLA: jest.fn().mockResolvedValue(2) },
    Reporte: { estadisticasTiempoReal: jest.fn().mockResolvedValue({ total: 5, abiertos: 2, enProceso: 1, resueltos: 1, slaVencidos: 0 }) },
    Usuario: { tecnicosActivos: jest.fn().mockResolvedValue([{ id: 20 }]) },
  };

  it('debería delegar la verificación de SLA en el modelo Ticket', async () => {
    expect(await crearTareasController(modelos, { tiempoReal: new RealtimeEspia() }).verificarSLA()).toBe(2);
  });

  it('debería emitir a los admins las cifras más técnicos activos', async () => {
    const tiempoReal = new RealtimeEspia();
    await crearTareasController(modelos, { tiempoReal }).publicarEstadisticas();
    expect(tiempoReal.eventos).toEqual([{
      destino: 'admins', evento: 'estadisticas:actualizadas',
      datos: { total: 5, abiertos: 2, enProceso: 1, resueltos: 1, slaVencidos: 0, tecnicosActivos: 1 },
    }]);
  });
});
