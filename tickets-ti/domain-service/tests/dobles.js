// Dobles de las integraciones externas de la capa de datos (authcore, SMTP,
// Socket.io) y del reloj. Imitan la API concreta de cada clase: en capas no
// hay interfaces que implementar.
const { ErrorDirectorioNoDisponible } = require('../src/comun/errores');

class RelojFijo {
  constructor(fecha = new Date('2026-10-08T12:00:00.000Z')) { this.fecha = fecha; }

  ahora() { return new Date(this.fecha); }

  avanzarHoras(horas) { this.fecha = new Date(this.fecha.getTime() + horas * 60 * 60 * 1000); }
}

class RealtimeEspia {
  constructor() { this.eventos = []; }

  emitirAUsuario(id, evento, datos) { this.eventos.push({ destino: `usuario:${id}`, evento, datos }); }

  emitirATecnico(id, evento, datos) { this.eventos.push({ destino: `tecnico:${id}`, evento, datos }); }

  emitirAAdmins(evento, datos) { this.eventos.push({ destino: 'admins', evento, datos }); }
}

class EmailEspia {
  constructor() {
    this.enviarTicketAsignado = jest.fn().mockResolvedValue();
    this.enviarTicketResuelto = jest.fn().mockResolvedValue();
    this.enviarAlertaSLA = jest.fn().mockResolvedValue();
  }
}

class DirectorioEnMemoria {
  constructor(usuarios = []) { this.usuarios = usuarios; this.caido = false; }

  _verificar() { if (this.caido) throw new ErrorDirectorioNoDisponible(new Error('ECONNREFUSED')); }

  async obtenerUsuario(id) { this._verificar(); return this.usuarios.find((u) => u.id === Number(id)) || null; }

  async listarTecnicosActivos() {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && u.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(({ id, nombre, email }) => ({ id, nombre, email }));
  }

  async listarTecnicos({ incluirInactivos = false } = {}) {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && (incluirInactivos || u.activo));
  }
}

// Deja que corran las tareas en segundo plano (emails)
const esperarSegundoPlano = () => new Promise((r) => setImmediate(r));

module.exports = { RelojFijo, RealtimeEspia, EmailEspia, DirectorioEnMemoria, esperarSegundoPlano };
