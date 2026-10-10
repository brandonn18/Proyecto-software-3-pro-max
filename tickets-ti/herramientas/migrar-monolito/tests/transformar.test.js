const { transformar } = require('../src/transformar');

const fecha = new Date('2026-01-01T00:00:00Z');
const origen = () => ({
  users: [
    { id: 1, nombre: 'Admin', email: 'a@t', password: '$2a$12$hash', rol: 'administrador', activo: true, intentos_login: 0, bloqueado_hasta: null, createdAt: fecha, updatedAt: fecha },
    { id: 2, nombre: 'Carlos Técnico', email: 'c@t', password: '$2a$12$hash2', rol: 'tecnico', activo: false, intentos_login: 3, bloqueado_hasta: fecha, createdAt: fecha, updatedAt: fecha },
    { id: 4, nombre: 'Pedro Usuario', email: 'p@t', password: '$2a$12$hash3', rol: 'usuario', activo: true, intentos_login: 0, bloqueado_hasta: null, createdAt: fecha, updatedAt: fecha },
  ],
  tickets: [
    { id: 'TKT-2026-0001', titulo: 'T', descripcion: 'd', tipo: 'incidente', categoria: 'red', prioridad: 'alta', estado: 'asignado', usuarioId: 4, tecnicoId: 2, categoriaId: 7, reabierto: false, motivo_reapertura: null, sla_limite: fecha, sla_alerta_enviada: false, createdAt: fecha, updatedAt: fecha, deletedAt: null },
    { id: 'TKT-2026-0002', titulo: 'T2', descripcion: 'd', tipo: 'solicitud', categoria: 'software', prioridad: 'baja', estado: 'abierto', usuarioId: 99, tecnicoId: null, categoriaId: null, reabierto: false, motivo_reapertura: null, sla_limite: fecha, sla_alerta_enviada: false, createdAt: fecha, updatedAt: fecha, deletedAt: fecha },
  ],
  auditLogs: [
    { id: 1, usuarioId: 4, ticketId: null, accion: 'LOGIN_EXITOSO', detalle: { email: 'p@t' }, createdAt: fecha },
    { id: 2, usuarioId: 4, ticketId: 'TKT-2026-0001', accion: 'TICKET_CREADO', detalle: {}, createdAt: fecha },
    { id: 3, usuarioId: null, ticketId: 'TKT-2026-0001', accion: 'SISTEMA', detalle: null, createdAt: fecha },
  ],
  notifications: [{ id: 5, usuarioId: 2, ticketId: 'TKT-2026-0001', tipo: 'asignacion', mensaje: 'm', leida: true, createdAt: fecha }],
  slaConfigs: [{ id: 1, prioridad: 'alta', tiempo_horas: 6, porcentaje_alerta: 75, createdAt: fecha, updatedAt: fecha }],
});

describe('transformar', () => {
  it('debería conservar ids y hashes, con el email como username', () => {
    const { authcore } = transformar(origen());
    expect(authcore.users).toEqual([
      { id: 1, username: 'a@t', email: 'a@t', password_hash: '$2a$12$hash' },
      { id: 4, username: 'p@t', email: 'p@t', password_hash: '$2a$12$hash3' },
    ]);
  });

  it('debería traducir el rol a los roles acumulados de authcore', () => {
    expect(transformar(origen()).authcore.user_roles).toEqual([
      { user_id: 1, role: 'ADMIN' }, { user_id: 1, role: 'USER' }, { user_id: 4, role: 'USER' },
    ]);
  });

  it('debería omitir y avisar los usuarios inactivos (authcore no tiene inactivos)', () => {
    expect(transformar(origen()).avisos).toContain('Usuario 2 (c@t) inactivo o eliminado: no se migra a authcore');
  });

  it('debería agregar los snapshots de nombre y descartar categoriaId', () => {
    const [t1] = transformar(origen()).domain.tickets;
    expect(t1).toMatchObject({ usuario_nombre: 'Pedro Usuario', tecnico_nombre: 'Carlos Técnico' });
    expect(t1).not.toHaveProperty('categoriaId');
  });

  it('debería conservar los tickets eliminados (deletedAt) para no reutilizar sus IDs', () => {
    expect(transformar(origen()).domain.tickets[1].deletedAt).toEqual(fecha);
  });

  it('debería avisar y usar un nombre de reemplazo si el usuario no existe', () => {
    const plan = transformar(origen());
    expect(plan.domain.tickets[1]).toMatchObject({ usuario_nombre: 'Usuario 99', tecnico_nombre: null });
    expect(plan.avisos).toContain('Usuario 99 referenciado pero inexistente en users');
  });

  it('debería migrar solo la auditoría de tickets, con nombre del actor, y avisar la de cuentas', () => {
    const plan = transformar(origen());
    expect(plan.domain.audit_logs.map((a) => [a.id, a.usuario_nombre])).toEqual([[2, 'Pedro Usuario'], [3, null]]);
    expect(plan.avisos).toContain('1 registros de auditoría de cuentas no se migran (authcore no tiene auditoría)');
  });

  it('debería copiar notificaciones y configuración SLA tal cual', () => {
    const { domain } = transformar(origen());
    expect(domain.notifications[0]).toMatchObject({ id: 5, leida: true });
    expect(domain.sla_configs[0]).toMatchObject({ prioridad: 'alta', tiempo_horas: 6, porcentaje_alerta: 75 });
  });

  it('no debería avisar dos veces por el mismo usuario inexistente', () => {
    const o = origen();
    o.tickets.push({ ...o.tickets[1], id: 'TKT-2026-0003' });
    expect(transformar(o).avisos.filter((a) => a.includes('Usuario 99'))).toHaveLength(1);
  });
});
