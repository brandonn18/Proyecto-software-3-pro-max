// Valores válidos del dominio de tickets (fuente única).
const ESTADOS = Object.freeze(['abierto', 'asignado', 'en_proceso', 'en_espera', 'resuelto', 'cerrado']);
const ESTADOS_FINALES = Object.freeze(['resuelto', 'cerrado']);
const PRIORIDADES = Object.freeze(['baja', 'media', 'alta', 'critica']);
const TIPOS = Object.freeze(['incidente', 'solicitud']);
const CATEGORIAS = Object.freeze(['hardware', 'software', 'red', 'accesos', 'servicios_ti']);
const ROLES = Object.freeze({ USUARIO: 'usuario', TECNICO: 'tecnico', ADMIN: 'administrador' });

// Ciclo de vida: cualquier transición fuera de este mapa es inválida
const TRANSICIONES_VALIDAS = Object.freeze({
  abierto: ['asignado'],
  asignado: ['en_proceso'],
  en_proceso: ['en_espera', 'resuelto'],
  en_espera: ['en_proceso'],
  resuelto: ['cerrado', 'abierto'],
  cerrado: ['abierto'],
});

module.exports = { ESTADOS, ESTADOS_FINALES, PRIORIDADES, TIPOS, CATEGORIAS, ROLES, TRANSICIONES_VALIDAS };
