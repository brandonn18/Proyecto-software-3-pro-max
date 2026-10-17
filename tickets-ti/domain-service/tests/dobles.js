// Dobles de las interfaces externas: cada uno EXTIENDE la clase abstracta que
// reemplaza, así los servicios los aceptan (instanceof) y funcionan igual que
// con la implementación real (polimorfismo / LSP).
const { DirectorioDeUsuarios, ServicioDeCorreo, CanalEnTiempoReal, Reloj } = require('../src/interfaces');
const { ErrorDirectorioNoDisponible } = require('../src/errores');
const PersonaDelDirectorio = require('../src/entidades/PersonaDelDirectorio');

class RelojFijo extends Reloj {
  constructor(fecha = new Date('2026-10-08T12:00:00.000Z')) { super(); this.fecha = fecha; }

  ahora() { return new Date(this.fecha); }

  avanzarHoras(horas) { this.fecha = new Date(this.fecha.getTime() + horas * 60 * 60 * 1000); }
}

class RealtimeEspia extends CanalEnTiempoReal {
  constructor() { super(); this.eventos = []; }

  emitirAUsuario(id, evento, datos) { this.eventos.push({ destino: `usuario:${id}`, evento, datos }); }

  emitirATecnico(id, evento, datos) { this.eventos.push({ destino: `tecnico:${id}`, evento, datos }); }

  emitirAAdmins(evento, datos) { this.eventos.push({ destino: 'admins', evento, datos }); }
}

class EmailEspia extends ServicioDeCorreo {
  constructor() {
    super();
    this.enviarTicketAsignado = jest.fn().mockResolvedValue();
    this.enviarTicketResuelto = jest.fn().mockResolvedValue();
    this.enviarAlertaSLA = jest.fn().mockResolvedValue();
  }
}

// usuarios: [{ id, nombre, email, rol, activo }]
class DirectorioEnMemoria extends DirectorioDeUsuarios {
  constructor(usuarios = []) { super(); this.usuarios = usuarios; this.caido = false; }

  _verificar() { if (this.caido) throw new ErrorDirectorioNoDisponible(new Error('ECONNREFUSED')); }

  async obtenerUsuario(id) {
    this._verificar();
    const u = this.usuarios.find((x) => x.id === Number(id));
    return u ? new PersonaDelDirectorio(u) : null;
  }

  async listarTecnicosActivos() {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && u.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((u) => new PersonaDelDirectorio(u));
  }

  async listarTecnicos({ incluirInactivos = false } = {}) {
    this._verificar();
    return this.usuarios.filter((u) => u.rol === 'tecnico' && (incluirInactivos || u.activo)).map((u) => new PersonaDelDirectorio(u));
  }
}

// Deja que corran las tareas en segundo plano (emails)
const esperarSegundoPlano = () => new Promise((r) => setImmediate(r));

module.exports = { RelojFijo, RealtimeEspia, EmailEspia, DirectorioEnMemoria, esperarSegundoPlano };
