// MODELO Ticket ("modelo gordo" / Active Record): la fila de la tabla tickets
// y todas sus reglas de negocio en la misma clase. Los controladores llaman a
// estos métodos y le pasan el resultado a una vista; nunca deciden reglas.
const { Model, DataTypes, Op } = require('sequelize');
const {
  ESTADOS, ESTADOS_FINALES, PRIORIDADES, TIPOS, CATEGORIAS, TRANSICIONES_VALIDAS,
} = require('./apoyo/catalogos');
const { ErrorDominio, CODIGOS, errorValidacion, noEncontrado } = require('./apoyo/errores');
const { normalizarPaginacion } = require('./apoyo/paginacion');
const { servicios, enSegundoPlano } = require('./apoyo/servicios');
const idTicket = require('./apoyo/idTicket');
const politicaSLA = require('./apoyo/politicaSLA');
const politicaAsignacion = require('./apoyo/politicaAsignacion');
const politicaAcceso = require('./apoyo/politicaAcceso');
const mensajes = require('./apoyo/mensajes');
const { AuditLog } = require('./AuditLog');
const { Notification } = require('./Notification');
const { SLAConfig } = require('./SLAConfig');
const { Usuario } = require('./Usuario');

const MAX_REINTENTOS_ID = 10;
const CAMPOS_EDITABLES = Object.freeze(['titulo', 'descripcion', 'tipo', 'categoria', 'prioridad']);
const ESTADOS_REASIGNABLES = Object.freeze(['abierto', 'asignado', 'en_proceso', 'en_espera']);
const FILTROS_IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];
const NO_FINALES = { [Op.notIn]: ESTADOS_FINALES };

const _exigirTexto = (valor, campo) => {
  if (typeof valor !== 'string' || valor.trim() === '') throw errorValidacion(`${campo} requerido`);
};

const _exigirEn = (valor, permitidos, campo) => {
  if (!permitidos.includes(valor)) throw errorValidacion(`${campo} inválido: ${valor}`);
};

const _exigirPersona = (persona, rol) => {
  if (!persona || !Number.isInteger(persona.id)) throw errorValidacion(`${rol} inválido`);
  _exigirTexto(persona.nombre, `Nombre del ${rol.toLowerCase()}`);
};

const _transicionInvalida = (mensaje) => new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, mensaje);

// % y _ son comodines de LIKE: se escapan para que la búsqueda sea literal
const _escaparLike = (texto) => String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);

const _whereDeListado = (consulta, actor) => {
  const filtros = { ...consulta, usuarioId: undefined, ...politicaAcceso.filtroDeListado(actor) };
  const valor = (campo) => (filtros[campo] === '' ? undefined : filtros[campo]);
  const where = Object.fromEntries(FILTROS_IGUALDAD.filter((c) => valor(c) !== undefined).map((c) => [c, valor(c)]));
  if (valor('fechaDesde') || valor('fechaHasta')) {
    where.createdAt = {};
    if (valor('fechaDesde')) where.createdAt[Op.gte] = new Date(filtros.fechaDesde);
    if (valor('fechaHasta')) where.createdAt[Op.lte] = new Date(`${filtros.fechaHasta}T23:59:59`);
  }
  if (valor('search')) {
    const patron = `%${_escaparLike(filtros.search)}%`;
    where[Op.or] = [{ titulo: { [Op.iLike]: patron } }, { id: { [Op.iLike]: patron } }];
  }
  return where;
};

class Ticket extends Model {
  // ─── Validación ──────────────────────────────────────────────────────────
  static validarDatos({ titulo, descripcion, tipo, categoria, prioridad }) {
    _exigirTexto(titulo, 'Título');
    _exigirTexto(descripcion, 'Descripción');
    _exigirEn(tipo, TIPOS, 'Tipo');
    _exigirEn(categoria, CATEGORIAS, 'Categoría');
    _exigirEn(prioridad, PRIORIDADES, 'Prioridad');
  }

  // ─── Consultas ───────────────────────────────────────────────────────────
  static async buscarOFallar(id) {
    const ticket = await this.findByPk(id);
    if (!ticket) throw noEncontrado('Ticket no encontrado');
    return ticket;
  }

  // El filtro de rol pisa a la query: un usuario no puede pedir tickets ajenos
  static async listarPara(actor, consulta = {}) {
    const paginacion = normalizarPaginacion(consulta);
    const { count, rows } = await this.findAndCountAll({
      where: _whereDeListado(consulta, actor), order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: paginacion.limit, offset: (paginacion.page - 1) * paginacion.limit,
    });
    return { items: rows, total: count, ...paginacion };
  }

  // Tickets no resueltos ni cerrados del técnico (opcionalmente en una categoría)
  static cargaActiva({ tecnicoId, categoria }) {
    const where = { tecnicoId, estado: NO_FINALES };
    if (categoria) where.categoria = categoria;
    return this.count({ where });
  }

  // ─── Alta (CP001) ────────────────────────────────────────────────────────
  // datos: { titulo, descripcion, tipo, categoria, prioridad? } | actor: claims del JWT
  static async abrir(datos, actor) {
    const prioridad = datos.prioridad || 'media';
    this.validarDatos({ ...datos, prioridad });
    _exigirPersona(actor, 'Usuario');
    const { horas } = await SLAConfig.reglaPara(prioridad);
    const ticket = await this._crearConIdUnico({ ...datos, prioridad }, actor, horas);
    await AuditLog.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_CREADO',
      detalle: { titulo: ticket.titulo, categoria: ticket.categoria, prioridad: ticket.prioridad },
    });
    await Notification.enviar({ usuarioId: actor.id, ticketId: ticket.id, tipo: 'creacion', mensaje: mensajes.creacion(ticket), push: false });
    return ticket.asignarAutomaticamente();
  }

  // Reintenta con el siguiente correlativo ante colisión por creación concurrente.
  // paranoid: false para no reutilizar el ID de un ticket eliminado.
  static async _crearConIdUnico({ titulo, descripcion, tipo, categoria, prioridad }, actor, horas) {
    const ahora = servicios.reloj.ahora();
    const anio = ahora.getFullYear();
    for (let intento = 0; intento <= MAX_REINTENTOS_ID; intento++) {
      const correlativo = (await this.count({ where: { id: { [Op.like]: `${idTicket.prefijoDelAnio(anio)}%` } }, paranoid: false })) + 1 + intento;
      try {
        return await this.create({
          id: idTicket.formatear(anio, correlativo), titulo, descripcion, tipo, categoria, prioridad,
          usuarioId: actor.id, usuario_nombre: actor.nombre, sla_limite: politicaSLA.calcularLimite(ahora, horas),
        });
      } catch (err) {
        if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      }
    }
    throw new Error(`No se pudo generar un ID único tras ${MAX_REINTENTOS_ID} reintentos`);
  }

  // Bitácora del ticket en orden cronológico
  historial() { return AuditLog.historialDe(this.id); }

  // ─── Acceso ──────────────────────────────────────────────────────────────
  exigirVer(actor) { politicaAcceso.exigirVer(this, actor); }

  estaActivo() { return !ESTADOS_FINALES.includes(this.estado); }

  // ─── Asignación ──────────────────────────────────────────────────────────
  // tecnico: { id, nombre } — se guarda como snapshot, sin consultar authcore después
  async asignarA(tecnico) {
    _exigirPersona(tecnico, 'Técnico');
    if (!ESTADOS_REASIGNABLES.includes(this.estado)) throw _transicionInvalida(`No se puede asignar un ticket ${this.estado}`);
    return this.update({ tecnicoId: tecnico.id, tecnico_nombre: tecnico.nombre, estado: 'asignado' });
  }

  // CP003: técnico activo con menor carga en la categoría. Sin técnicos o con
  // authcore caído el ticket queda abierto: crear nunca falla por la asignación.
  async asignarAutomaticamente() {
    const tecnicos = await Usuario.tecnicosActivosODegradar();
    const candidatos = await Promise.all(tecnicos.map(async (tecnico) => ({
      tecnico,
      cargaCategoria: await Ticket.cargaActiva({ tecnicoId: tecnico.id, categoria: this.categoria }),
      cargaGlobal: await Ticket.cargaActiva({ tecnicoId: tecnico.id }),
    })));
    const elegido = politicaAsignacion.elegirTecnico(candidatos);
    if (!elegido) return this;
    await this.asignarA(elegido);
    await Notification.enviar({
      usuarioId: elegido.id, ticketId: this.id, tipo: 'asignacion', mensaje: mensajes.asignacionAutomatica(this), push: false, // ya avisa ticket:nuevo
    });
    servicios.tiempoReal.emitirATecnico(elegido.id, 'ticket:nuevo', { ticketId: this.id, titulo: this.titulo });
    return this;
  }

  // Asignación manual por un administrador
  async asignarManual(tecnicoId, actor) {
    const tecnico = await Usuario.buscar(tecnicoId);
    if (!Usuario.esTecnicoActivo(tecnico)) throw noEncontrado('Técnico no encontrado o inactivo');
    await this.asignarA(tecnico);
    await AuditLog.registrar({
      ticketId: this.id, actor, accion: 'TICKET_ASIGNADO', detalle: { tecnicoId: tecnico.id, tecnicoNombre: tecnico.nombre },
    });
    await Notification.enviar({ usuarioId: tecnico.id, ticketId: this.id, tipo: 'asignacion', mensaje: mensajes.asignacion(this), push: true });
    enSegundoPlano('Email asignación', () => servicios.correo.enviarTicketAsignado(tecnico, this));
    return this;
  }

  // ─── Ciclo de vida (CP004, CP005, CP012) ─────────────────────────────────
  async cambiarEstado(nuevoEstado, comentario, actor) {
    politicaAcceso.exigirCambiarEstado(this, actor);
    _exigirEn(nuevoEstado, ESTADOS, 'Estado');
    const anterior = this.estado;
    const permitidos = TRANSICIONES_VALIDAS[anterior] || [];
    if (!permitidos.includes(nuevoEstado)) {
      throw _transicionInvalida(`Transición inválida: '${anterior}' → '${nuevoEstado}'. Permitidos: ${permitidos.join(', ') || 'ninguno'}`);
    }
    await this.update({ estado: nuevoEstado });
    await AuditLog.registrar({ ticketId: this.id, actor, accion: 'CAMBIO_ESTADO', detalle: { de: anterior, a: nuevoEstado, comentario } });
    if (nuevoEstado === 'resuelto') await this._avisarResolucion(anterior);
    return this;
  }

  async _avisarResolucion(estadoAnterior) {
    await Notification.enviar({
      usuarioId: this.usuarioId, ticketId: this.id, tipo: 'resolucion', mensaje: mensajes.resolucion(this), push: false, // ya avisa ticket:estado_cambiado
    });
    servicios.tiempoReal.emitirAUsuario(this.usuarioId, 'ticket:estado_cambiado', { ticketId: this.id, estadoAnterior, nuevoEstado: this.estado });
    enSegundoPlano('Email resolución', async () => {
      const usuario = await Usuario.buscar(this.usuarioId);
      if (usuario) await servicios.correo.enviarTicketResuelto(usuario, this);
    });
  }

  // Reinicia el SLA desde ahora con las horas de la prioridad
  async reabrir(motivo, actor) {
    politicaAcceso.exigirReabrir(this, actor);
    if (this.estaActivo()) throw _transicionInvalida('Solo se pueden reabrir tickets resueltos o cerrados');
    _exigirTexto(motivo, 'Motivo de reapertura');
    const { horas } = await SLAConfig.reglaPara(this.prioridad);
    await this.update({
      estado: 'abierto', reabierto: true, motivo_reapertura: motivo,
      sla_limite: politicaSLA.calcularLimite(servicios.reloj.ahora(), horas), sla_alerta_enviada: false,
    });
    await AuditLog.registrar({ ticketId: this.id, actor, accion: 'TICKET_REABIERTO', detalle: { motivo } });
    return this;
  }

  // Solo título, descripción, tipo, categoría y prioridad: el estado y el técnico
  // cambian por cambiarEstado y asignarA, nunca por edición directa.
  async actualizarDatos(cambios) {
    const permitidos = Object.fromEntries(Object.entries(cambios).filter(([c, v]) => CAMPOS_EDITABLES.includes(c) && v !== undefined));
    Ticket.validarDatos({ ...this.get({ plain: true }), ...permitidos });
    return this.update(permitidos);
  }

  // ─── SLA (CP010) ─────────────────────────────────────────────────────────
  // Lo dispara el cron cada 15 min. Devuelve cuántas alertas se generaron
  static async verificarSLA() {
    const ahora = servicios.reloj.ahora();
    const pendientes = await this.findAll({
      where: { estado: NO_FINALES, sla_alerta_enviada: false, sla_limite: { [Op.ne]: null }, tecnicoId: { [Op.ne]: null } },
    });
    const reglas = new Map();
    let alertas = 0;
    for (const ticket of pendientes) {
      if (!reglas.has(ticket.prioridad)) reglas.set(ticket.prioridad, await SLAConfig.reglaPara(ticket.prioridad));
      const { porcentaje, alertar } = politicaSLA.evaluar(ticket, { ahora, ...reglas.get(ticket.prioridad) });
      if (alertar) {
        await ticket.alertarSLA(porcentaje);
        alertas++;
      }
    }
    return alertas;
  }

  async alertarSLA(porcentaje) {
    const redondeado = Math.round(porcentaje);
    await Notification.enviar({ usuarioId: this.tecnicoId, ticketId: this.id, tipo: 'sla_alerta', mensaje: mensajes.alertaSLA(this, porcentaje), push: true });
    enSegundoPlano('Email SLA', async () => {
      const tecnico = await Usuario.buscar(this.tecnicoId);
      if (tecnico) await servicios.correo.enviarAlertaSLA(tecnico, this, porcentaje);
    });
    servicios.tiempoReal.emitirATecnico(this.tecnicoId, 'ticket:sla_alerta', { ticketId: this.id, porcentaje: redondeado });
    servicios.tiempoReal.emitirAAdmins('ticket:sla_alerta', { ticketId: this.id, porcentaje: redondeado });
    await this.update({ sla_alerta_enviada: true });
  }
}

const ATRIBUTOS = {
  id: { type: DataTypes.STRING(20), primaryKey: true },
  titulo: { type: DataTypes.STRING(200), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  tipo: { type: DataTypes.ENUM(...TIPOS), allowNull: false },
  categoria: { type: DataTypes.ENUM(...CATEGORIAS), allowNull: false },
  prioridad: { type: DataTypes.ENUM(...PRIORIDADES), allowNull: false, defaultValue: 'media' },
  estado: { type: DataTypes.ENUM(...ESTADOS), allowNull: false, defaultValue: 'abierto' },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  usuario_nombre: { type: DataTypes.STRING(100), allowNull: false },
  tecnicoId: { type: DataTypes.INTEGER, allowNull: true },
  tecnico_nombre: { type: DataTypes.STRING(100), allowNull: true },
  reabierto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  motivo_reapertura: { type: DataTypes.TEXT, allowNull: true },
  sla_limite: { type: DataTypes.DATE, allowNull: true },
  sla_alerta_enviada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};

const iniciar = (sequelize) => Ticket.init(ATRIBUTOS, { sequelize, modelName: 'Ticket', tableName: 'tickets', timestamps: true, paranoid: true });

module.exports = { Ticket, iniciar, CAMPOS_EDITABLES, MAX_REINTENTOS_ID };
