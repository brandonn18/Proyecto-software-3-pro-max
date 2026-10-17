// Capa de NEGOCIO: reglas del ticket como funciones sobre objetos planos (las
// filas que entrega la capa de datos). Cada operación devuelve los CAMBIOS a
// persistir; el servicio se los pasa al DAO. No conoce HTTP ni SQL.
const {
  ESTADOS, ESTADOS_FINALES, PRIORIDADES, TIPOS, CATEGORIAS, TRANSICIONES_VALIDAS,
} = require('../../comun/catalogos');
const { ErrorDominio, CODIGOS, errorValidacion } = require('../../comun/errores');
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

const validarDatos = ({ titulo, descripcion, tipo, categoria, prioridad }) => {
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

const _transicionInvalida = (mensaje) => new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, mensaje);

const estaActivo = (ticket) => !ESTADOS_FINALES.includes(ticket.estado);

// Fila lista para insertar. creador: { id, nombre } | sla: { ahora, horas }
const nuevoTicket = ({ id, titulo, descripcion, tipo, categoria, prioridad = 'media', creador }, { ahora, horas }) => {
  if (!idTicket.esValido(id)) throw errorValidacion(`ID de ticket inválido: ${id}`);
  validarDatos({ titulo, descripcion, tipo, categoria, prioridad });
  _exigirPersona(creador, 'Usuario');
  return {
    id, titulo, descripcion, tipo, categoria, prioridad,
    estado: 'abierto', usuarioId: creador.id, usuario_nombre: creador.nombre,
    tecnicoId: null, tecnico_nombre: null, reabierto: false, motivo_reapertura: null,
    sla_limite: politicaSLA.calcularLimite(ahora, horas), sla_alerta_enviada: false,
  };
};

// tecnico: { id, nombre } — se guarda como snapshot, sin consultar authcore después
const cambiosDeAsignacion = (ticket, tecnico) => {
  _exigirPersona(tecnico, 'Técnico');
  if (!ESTADOS_REASIGNABLES.includes(ticket.estado)) throw _transicionInvalida(`No se puede asignar un ticket ${ticket.estado}`);
  return { tecnicoId: tecnico.id, tecnico_nombre: tecnico.nombre, estado: 'asignado' };
};

const cambiosDeEstado = (ticket, nuevoEstado) => {
  _exigirEn(nuevoEstado, ESTADOS, 'Estado');
  const permitidos = TRANSICIONES_VALIDAS[ticket.estado] || [];
  if (!permitidos.includes(nuevoEstado)) {
    throw _transicionInvalida(
      `Transición inválida: '${ticket.estado}' → '${nuevoEstado}'. Permitidos: ${permitidos.join(', ') || 'ninguno'}`
    );
  }
  return { estado: nuevoEstado };
};

const cambiosDeReapertura = (ticket, motivo, { ahora, horas }) => {
  if (estaActivo(ticket)) throw _transicionInvalida('Solo se pueden reabrir tickets resueltos o cerrados');
  _exigirTexto(motivo, 'Motivo de reapertura');
  return {
    estado: 'abierto', reabierto: true, motivo_reapertura: motivo,
    sla_limite: politicaSLA.calcularLimite(ahora, horas), sla_alerta_enviada: false,
  };
};

// Solo título, descripción, tipo, categoría y prioridad: el estado cambia por
// cambiosDeEstado y el técnico por cambiosDeAsignacion, nunca por edición directa.
const cambiosEditables = (ticket, cambios) => {
  const permitidos = Object.fromEntries(
    Object.entries(cambios).filter(([campo, valor]) => CAMPOS_EDITABLES.includes(campo) && valor !== undefined)
  );
  validarDatos({ ...ticket, ...permitidos });
  return permitidos;
};

module.exports = {
  CAMPOS_EDITABLES, validarDatos, estaActivo, nuevoTicket, cambiosDeAsignacion, cambiosDeEstado, cambiosDeReapertura, cambiosEditables,
};
