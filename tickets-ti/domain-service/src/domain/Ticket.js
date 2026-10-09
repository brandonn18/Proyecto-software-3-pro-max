// Entidad Ticket. Inmutable: cada operación devuelve un Ticket nuevo.
// No conoce persistencia, HTTP ni el reloj del sistema (recibe `ahora`).
const { ESTADOS, ESTADOS_FINALES, PRIORIDADES, TIPOS, CATEGORIAS, TRANSICIONES_VALIDAS } = require('./catalogos');
const { ErrorDominio, CODIGOS, errorValidacion } = require('./errores');
const idTicket = require('./idTicket');
const politicaSLA = require('./politicaSLA');

const CAMPOS_EDITABLES = Object.freeze(['titulo', 'descripcion', 'tipo', 'categoria', 'prioridad']);
const ESTADOS_REASIGNABLES = Object.freeze(['abierto', 'asignado', 'en_proceso', 'en_espera']);

const _exigirTexto = (valor, campo) => {
  if (typeof valor !== 'string' || valor.trim() === '') throw errorValidacion(`${campo} requerido`);
};

const _exigirEn = (valor, permitidos, campo) => {
  if (!permitidos.includes(valor)) throw errorValidacion(`${campo} inválido: ${valor}`);
};

const _validarDatos = ({ titulo, descripcion, tipo, categoria, prioridad }) => {
  _exigirTexto(titulo, 'Título');
  _exigirTexto(descripcion, 'Descripción');
  _exigirEn(tipo, TIPOS, 'Tipo');
  _exigirEn(categoria, CATEGORIAS, 'Categoría');
  _exigirEn(prioridad, PRIORIDADES, 'Prioridad');
};

const _exigirPersona = (persona, rol) => {
  if (!persona || !Number.isInteger(persona.id)) throw errorValidacion(`${rol} inválido`);
  _exigirTexto(persona.nombre, `Nombre del ${rol.toLowerCase()}`);
};

class Ticket {
  constructor(props) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  // creador: { id, nombre } | sla: { ahora, horas }
  static crear({ id, titulo, descripcion, tipo, categoria, prioridad = 'media', creador }, { ahora, horas }) {
    if (!idTicket.esValido(id)) throw errorValidacion(`ID de ticket inválido: ${id}`);
    _validarDatos({ titulo, descripcion, tipo, categoria, prioridad });
    _exigirPersona(creador, 'Usuario');
    return new Ticket({
      id, titulo, descripcion, tipo, categoria, prioridad,
      estado: 'abierto',
      usuarioId: creador.id,
      usuario_nombre: creador.nombre,
      tecnicoId: null,
      tecnico_nombre: null,
      reabierto: false,
      motivo_reapertura: null,
      sla_limite: politicaSLA.calcularLimite(ahora, horas),
      sla_alerta_enviada: false,
    });
  }

  static desdePersistencia(props) {
    return new Ticket({ ...props });
  }

  estaActivo() {
    return !ESTADOS_FINALES.includes(this.estado);
  }

  _con(cambios) {
    return new Ticket({ ...this, ...cambios });
  }

  // tecnico: { id, nombre } — se guarda como snapshot, sin consultar authcore después
  asignarA(tecnico) {
    _exigirPersona(tecnico, 'Técnico');
    if (!ESTADOS_REASIGNABLES.includes(this.estado)) {
      throw new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, `No se puede asignar un ticket ${this.estado}`);
    }
    return this._con({ tecnicoId: tecnico.id, tecnico_nombre: tecnico.nombre, estado: 'asignado' });
  }

  cambiarEstado(nuevoEstado) {
    _exigirEn(nuevoEstado, ESTADOS, 'Estado');
    const permitidos = TRANSICIONES_VALIDAS[this.estado] || [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorDominio(
        CODIGOS.TRANSICION_INVALIDA,
        `Transición inválida: '${this.estado}' → '${nuevoEstado}'. Permitidos: ${permitidos.join(', ') || 'ninguno'}`
      );
    }
    return this._con({ estado: nuevoEstado });
  }

  reabrir(motivo, { ahora, horas }) {
    if (!ESTADOS_FINALES.includes(this.estado)) {
      throw new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, 'Solo se pueden reabrir tickets resueltos o cerrados');
    }
    _exigirTexto(motivo, 'Motivo de reapertura');
    return this._con({
      estado: 'abierto',
      reabierto: true,
      motivo_reapertura: motivo,
      sla_limite: politicaSLA.calcularLimite(ahora, horas),
      sla_alerta_enviada: false,
    });
  }

  // Solo título, descripción, tipo, categoría y prioridad: el estado cambia
  // por cambiarEstado y el técnico por asignarA, nunca por edición directa.
  actualizarDatos(cambios) {
    const permitidos = Object.fromEntries(
      Object.entries(cambios).filter(([campo, valor]) => CAMPOS_EDITABLES.includes(campo) && valor !== undefined)
    );
    const actualizado = { ...this, ...permitidos };
    _validarDatos(actualizado);
    return this._con(permitidos);
  }

  evaluarSLA({ ahora, horas, porcentajeAlerta }) {
    return politicaSLA.evaluar(this, { ahora, horas, porcentajeAlerta });
  }

  marcarAlertaSLAEnviada() {
    return this._con({ sla_alerta_enviada: true });
  }

  aPrimitivos() {
    return { ...this };
  }
}

module.exports = { Ticket, CAMPOS_EDITABLES };
