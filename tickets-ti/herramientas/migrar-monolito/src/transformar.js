// Transformaciones puras: filas del monolito → filas de authcore (Java) y domain-service.
// Sin BD: se prueban de forma aislada.

const nombreDe = (mapaNombres, id, avisos) => {
  if (id === null || id === undefined) return null;
  if (mapaNombres.has(id)) return mapaNombres.get(id);
  avisos.push(`Usuario ${id} referenciado pero inexistente en users`);
  return `Usuario ${id}`;
};

// authcore (Java) acumula roles: register da USER y assignRole agrega los demás
const ROLES_AUTHCORE = Object.freeze({ administrador: ['ADMIN', 'USER'], tecnico: ['TECNICO', 'USER'], usuario: ['USER'] });

// authcore no tiene cuentas inactivas ni borradas: se omiten para que no recuperen
// el acceso. El email pasa a ser el username (único en el monolito) y el hash
// bcrypt de bcryptjs ($2a$) lo valida BCryptPasswordEncoder de Spring.
const usuariosParaAuthcore = (users, avisos) => {
  const migrables = users.filter((u) => u.activo && !u.deletedAt);
  users.filter((u) => !migrables.includes(u))
    .forEach((u) => avisos.push(`Usuario ${u.id} (${u.email}) inactivo o eliminado: no se migra a authcore`));
  return {
    users: migrables.map((u) => ({ id: u.id, username: u.email, email: u.email, password_hash: u.password })),
    user_roles: migrables.flatMap((u) => ROLES_AUTHCORE[u.rol].map((role) => ({ user_id: u.id, role }))),
  };
};

// categoriaId se descarta: la tabla categories no se migra (nada la leía)
const ticketsParaDomain = (tickets, mapaNombres, avisos) => tickets.map((t) => ({
  id: t.id, titulo: t.titulo, descripcion: t.descripcion, tipo: t.tipo, categoria: t.categoria,
  prioridad: t.prioridad, estado: t.estado,
  usuarioId: t.usuarioId, usuario_nombre: nombreDe(mapaNombres, t.usuarioId, avisos),
  tecnicoId: t.tecnicoId, tecnico_nombre: nombreDe(mapaNombres, t.tecnicoId, avisos),
  reabierto: t.reabierto, motivo_reapertura: t.motivo_reapertura,
  sla_limite: t.sla_limite, sla_alerta_enviada: t.sla_alerta_enviada,
  createdAt: t.createdAt, updatedAt: t.updatedAt, deletedAt: t.deletedAt,
}));

// Solo la auditoría de tickets se migra (→ domain-service). La de cuentas
// (login, usuarios) se descarta: authcore no tiene tabla de auditoría.
const repartirAuditoria = (auditLogs, mapaNombres, avisos) => {
  const deCuentas = auditLogs.filter((a) => !a.ticketId).length;
  if (deCuentas) avisos.push(`${deCuentas} registros de auditoría de cuentas no se migran (authcore no tiene auditoría)`);
  return auditLogs.filter((a) => a.ticketId).map((a) => ({
    id: a.id, ticketId: a.ticketId, usuarioId: a.usuarioId,
    usuario_nombre: nombreDe(mapaNombres, a.usuarioId, avisos),
    accion: a.accion, detalle: a.detalle, createdAt: a.createdAt,
  }));
};

const notificacionesParaDomain = (notifications) => notifications.map((n) => ({
  id: n.id, usuarioId: n.usuarioId, ticketId: n.ticketId, tipo: n.tipo, mensaje: n.mensaje,
  leida: n.leida, createdAt: n.createdAt,
}));

const slaParaDomain = (slaConfigs) => slaConfigs.map((c) => ({
  id: c.id, prioridad: c.prioridad, tiempo_horas: c.tiempo_horas, porcentaje_alerta: c.porcentaje_alerta,
  createdAt: c.createdAt, updatedAt: c.updatedAt,
}));

// origen: { users, tickets, auditLogs, notifications, slaConfigs }
const transformar = (origen) => {
  const avisos = [];
  const mapaNombres = new Map(origen.users.map((u) => [u.id, u.nombre]));
  return {
    authcore: usuariosParaAuthcore(origen.users, avisos),
    domain: {
      tickets: ticketsParaDomain(origen.tickets, mapaNombres, avisos),
      audit_logs: repartirAuditoria(origen.auditLogs, mapaNombres, avisos),
      notifications: notificacionesParaDomain(origen.notifications),
      sla_configs: slaParaDomain(origen.slaConfigs),
    },
    avisos: [...new Set(avisos)],
  };
};

module.exports = { transformar, repartirAuditoria, ticketsParaDomain, usuariosParaAuthcore };
