const { ReportesQueryPort, UserDirectoryPort, RealtimePort, Clock } = require('../ports');
const { requerirDependencias } = require('../dependencias');

// Lo dispara el cron cada 5 min: empuja las cifras del dashboard a los admins.
class PublicarEstadisticas {
  constructor(deps) {
    requerirDependencias(deps, {
      reportes: ReportesQueryPort, userDirectory: UserDirectoryPort, realtime: RealtimePort, clock: Clock,
    });
    this.deps = deps;
  }

  async ejecutar() {
    const [stats, tecnicos] = await Promise.all([
      this.deps.reportes.estadisticasTiempoReal(this.deps.clock.ahora()),
      this.deps.userDirectory.listarTecnicosActivos(),
    ]);
    const datos = { ...stats, tecnicosActivos: tecnicos.length };
    this.deps.realtime.emitirAAdmins('estadisticas:actualizadas', datos);
    return datos;
  }
}

module.exports = PublicarEstadisticas;
