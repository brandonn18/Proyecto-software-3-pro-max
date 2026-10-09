// Transformaciones puras: filas del monolito → filas de authcore y domain-service.
// Sin BD: se prueban de forma aislada.

const nombreDe = (mapaNombres, id, avisos) => {
  if (id === null || id === undefined) return null;
  if (mapaNombres.has(id)) return mapaNombres.get(id);
  avisos.push(`Usuario ${id} referenciado pero inexistente en users`);
  return `Usuario ${id}`;
};

const usuariosParaAuthcore = (users) => users.map((u) => ({
  id: u.id, nombre: u.nombre, email: u.email, password: u.password, rol: u.rol, activo: u.activo,
  intentos_login: u.intentos_login, bloqueado_hasta: u.bloqueado_hasta,
  createdAt: u.createdAt, updatedAt: u.updatedAt, deletedAt: null,
}));

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

// Auditoría de tickets → domain-service; de cuentas (login, usuarios) → authcore
const repartirAuditoria = (auditLogs, mapaNombres, avisos) => ({
  authcore: auditLogs.filter((a) => !a.ticketId).map((a) => ({
    id: a.id, usuarioId: a.usuarioId, accion: a.accion, detalle: a.detalle, createdAt: a.createdAt,
  })),
  domain: auditLogs.filter((a) => a.ticketId).map((a) => ({
    id: a.id, ticketId: a.ticketId, usuarioId: a.usuarioId,
    usuario_nombre: nombreDe(mapaNombres, a.usuarioId, avisos),
    accion: a.accion, detalle: a.detalle, createdAt: a.createdAt,
  })),
});

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
  const auditoria = repartirAuditoria(origen.auditLogs, mapaNombres, avisos);
  return {
    authcore: { users: usuariosParaAuthcore(origen.users), audit_logs: auditoria.authcore },
    domain: {
      tickets: ticketsParaDomain(origen.tickets, mapaNombres, avisos),
      audit_logs: auditoria.domain,
      notifications: notificacionesParaDomain(origen.notifications),
      sla_configs: slaParaDomain(origen.slaConfigs),
    },
    avisos: [...new Set(avisos)],
  };
};

module.exports = { transformar, repartirAuditoria, ticketsParaDomain, usuariosParaAuthcore };
