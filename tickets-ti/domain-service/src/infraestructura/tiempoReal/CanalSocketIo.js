// Implementación concreta de CanalEnTiempoReal con Socket.io.
const { Server } = require('socket.io');
const { CanalEnTiempoReal } = require('../../interfaces');
const VerificadorDeTokens = require('../authcore/VerificadorDeTokens');

// Salas idénticas a las del monolito para no tocar el frontend.
const SALA = Object.freeze({
  usuario: (id) => `user-${id}`,
  tecnico: (id) => `tecnico-${id}`,
  admins: 'admin-room',
});

class CanalSocketIo extends CanalEnTiempoReal {
  #verificador;
  #origenPermitido;
  #io = null;

  constructor({ jwtSecret, origenPermitido }) {
    super();
    if (!jwtSecret) throw new Error('CanalSocketIo requiere jwtSecret');
    this.#verificador = new VerificadorDeTokens(jwtSecret);
    this.#origenPermitido = origenPermitido;
  }

  // Valida el mismo JWT que emite authcore; sin token no hay conexión
  #autenticar(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requerido'));
    socket.actor = this.#verificador.actorDesde(token);
    return socket.actor ? next() : next(new Error('Token inválido'));
  }

  // Cada actor entra a su sala personal y, según su rol, a la de técnicos o admins
  static #salasDe(actor) {
    const salas = [SALA.usuario(actor.id)];
    if (actor.rol === 'administrador') salas.push(SALA.admins);
    if (actor.rol === 'tecnico') salas.push(SALA.tecnico(actor.id));
    return salas;
  }

  adjuntar(httpServer) {
    this.#io = new Server(httpServer, { cors: { origin: this.#origenPermitido, methods: ['GET', 'POST'], credentials: true } });
    this.#io.use((socket, next) => this.#autenticar(socket, next));
    this.#io.on('connection', (socket) => CanalSocketIo.#salasDe(socket.actor).forEach((sala) => socket.join(sala)));
    return this.#io;
  }

  // Antes de adjuntar (tests, crons sin servidor) los eventos se descartan
  #emitir(sala, evento, datos) {
    if (this.#io) this.#io.to(sala).emit(evento, datos);
  }

  emitirAUsuario(id, evento, datos) { this.#emitir(SALA.usuario(id), evento, datos); }

  emitirATecnico(id, evento, datos) { this.#emitir(SALA.tecnico(id), evento, datos); }

  emitirAAdmins(evento, datos) { this.#emitir(SALA.admins, evento, datos); }

  cerrar() {
    return new Promise((resolve) => (this.#io ? this.#io.close(() => resolve()) : resolve()));
  }
}

module.exports = CanalSocketIo;
