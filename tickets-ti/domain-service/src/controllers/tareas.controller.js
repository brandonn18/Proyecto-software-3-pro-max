// CONTROLADOR de las tareas programadas: el cron (routes/tareas.js) es su
// "ruta". Igual que los de HTTP, llama a los modelos y usa una vista.
const reporteView = require('../views/reporteView');

// modelos: los de models/index.js | tiempoReal: lib/tiempoReal (o un doble)
const crearTareasController = ({ Ticket, Reporte, Usuario }, { tiempoReal }) => ({
  // CP010, cada 15 min. Devuelve cuántas alertas se generaron
  verificarSLA: () => Ticket.verificarSLA(),

  // Cada 5 min: empuja las cifras del dashboard a los admins
  publicarEstadisticas: async () => {
    const [stats, tecnicos] = await Promise.all([Reporte.estadisticasTiempoReal(), Usuario.tecnicosActivos()]);
    const datos = reporteView.estadisticas(stats, tecnicos.length);
    tiempoReal.emitirAAdmins('estadisticas:actualizadas', datos);
    return datos;
  },
});

module.exports = { crearTareasController };
