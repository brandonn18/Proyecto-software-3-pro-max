const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { RealtimePort } = require('../../application/ports');

// Salas idénticas a las del monolito para no tocar el frontend.
const SALA = {
  usuario: (id) => `user-${id}`,
  tecnico: (id) => `tecnico-${id}`,
  admins: 'admin-room',
};

class SocketIoRealtimeAdapter extends RealtimePort {
  constructor({ jwtSecret, origenPermitido }) {
    super();
    if (!jwtSecret) throw new Error('SocketIoRealtimeAdapter requiere jwtSecret');
    this.jwtSecret = jwtSecret;
    this.origenPermitido = origenPermitido;
    this.io = null;
  }

  // Valida el mismo JWT que emite authcore; sin token no hay conexión
  _autenticar(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      socket.user = jwt.verify(token, this.jwtSecret);
      return next();
    } catch {
      return next(new Error('Token inválido'));
    }
  }

  _unirASalas(socket) {
    const { id, rol } = socket.user;
    socket.join(SALA.usuario(id));
    if (rol === 'administrador') socket.join(SALA.admins);
    if (rol === 'tecnico') socket.join(SALA.tecnico(id));
  }

  adjuntar(httpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: this.origenPermitido, methods: ['GET', 'POST'], credentials: true },
    });
    this.io.use((socket, next) => this._autenticar(socket, next));
    this.io.on('connection', (socket) => this._unirASalas(socket));
    return this.io;
  }

  // Antes de adjuntar (tests, crons sin servidor) los eventos se descartan
  _emitir(sala, evento, datos) {
    if (this.io) this.io.to(sala).emit(evento, datos);
  }

  emitirAUsuario(id, evento, datos) { this._emitir(SALA.usuario(id), evento, datos); }

  emitirATecnico(id, evento, datos) { this._emitir(SALA.tecnico(id), evento, datos); }

  emitirAAdmins(evento, datos) { this._emitir(SALA.admins, evento, datos); }

  cerrar() {
    return new Promise((resolve) => (this.io ? this.io.close(() => resolve()) : resolve()));
  }
}

module.exports = { SocketIoRealtimeAdapter, SALA };
