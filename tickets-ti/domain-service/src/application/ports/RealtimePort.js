const { definirPuerto } = require('./definirPuerto');

/**
 * Eventos en tiempo real hacia el frontend (Socket.io en infraestructura).
 *
 * emitirAUsuario(usuarioId, evento, datos) → void
 * emitirATecnico(tecnicoId, evento, datos) → void
 * emitirAAdmins(evento, datos)             → void
 */
module.exports = definirPuerto('RealtimePort', ['emitirAUsuario', 'emitirATecnico', 'emitirAAdmins']);
