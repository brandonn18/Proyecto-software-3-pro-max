// Valores válidos del dominio de tickets (fuente única).
const ESTADOS = Object.freeze(['abierto', 'asignado', 'en_proceso', 'en_espera', 'resuelto', 'cerrado']);
const PRIORIDADES = Object.freeze(['baja', 'media', 'alta', 'critica']);
const TIPOS = Object.freeze(['incidente', 'solicitud']);
const CATEGORIAS = Object.freeze(['hardware', 'software', 'red', 'accesos', 'servicios_ti']);
const ROLES = Object.freeze({ USUARIO: 'usuario', TECNICO: 'tecnico', ADMIN: 'administrador' });

module.exports = { ESTADOS, PRIORIDADES, TIPOS, CATEGORIAS, ROLES };
