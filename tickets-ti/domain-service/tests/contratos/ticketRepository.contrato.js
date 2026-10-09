// Contrato de TicketRepository: toda implementación (en memoria, Sequelize)
// debe pasar exactamente estas pruebas. Así los tests de casos de uso con el
// doble en memoria también valen para el adaptador real (LSP).
const { Ticket } = require('../../src/domain');
const { ErrorIdDuplicado } = require('../../src/application/errores');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 3600000;

const nuevo = (n, overrides = {}) => Ticket.crear({
  id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `Ticket ${n}`, descripcion: 'desc', tipo: 'incidente',
  categoria: 'hardware', prioridad: 'alta', creador: { id: 10, nombre: 'Luis Usuario' }, ...overrides,
}, { ahora: AHORA, horas: 8 });

// fabrica: async () => ({ repo, limpiar: async () => {}, cerrar: async () => {} })
const probarContratoTicketRepository = (nombre, fabrica) => {
  describe(`Contrato TicketRepository — ${nombre}`, () => {
    let ctx;
    beforeAll(async () => { ctx = await fabrica(); });
    beforeEach(async () => { await ctx.limpiar(); });
    afterAll(async () => { await ctx.cerrar(); });

    it('debería guardar y recuperar una entidad Ticket con sus snapshots', async () => {
      await ctx.repo.guardarNuevo(nuevo(1).asignarA({ id: 20, nombre: 'Ana Técnica' }));
      const t = await ctx.repo.buscarPorId('TKT-2026-0001');
      expect(t).toBeInstanceOf(Ticket);
      expect(t).toMatchObject({ estado: 'asignado', usuario_nombre: 'Luis Usuario', tecnicoId: 20, tecnico_nombre: 'Ana Técnica' });
      expect(new Date(t.sla_limite)).toEqual(new Date(AHORA.getTime() + 8 * HORA));
      expect(t.createdAt).toBeInstanceOf(Date);
    });

    it('debería devolver null si no existe', async () => {
      expect(await ctx.repo.buscarPorId('TKT-2026-9999')).toBeNull();
    });

    it('debería lanzar ErrorIdDuplicado con un id repetido', async () => {
      await ctx.repo.guardarNuevo(nuevo(1));
      await expect(ctx.repo.guardarNuevo(nuevo(1))).rejects.toBeInstanceOf(ErrorIdDuplicado);
    });

    it('debería contar por año incluyendo eliminados', async () => {
      await ctx.repo.guardarNuevo(nuevo(1));
      await ctx.repo.guardarNuevo(nuevo(2));
      await ctx.repo.eliminar('TKT-2026-0002');
      expect(await ctx.repo.contarDelAnio(2026)).toBe(2);
      expect(await ctx.repo.contarDelAnio(2025)).toBe(0);
    });

    it('debería persistir los cambios de actualizar y ocultar los eliminados', async () => {
      const t = await ctx.repo.guardarNuevo(nuevo(1));
      await ctx.repo.actualizar(t.asignarA({ id: 20, nombre: 'Ana' }).cambiarEstado('en_proceso'));
      expect((await ctx.repo.buscarPorId(t.id)).estado).toBe('en_proceso');
      await ctx.repo.eliminar(t.id);
      expect(await ctx.repo.buscarPorId(t.id)).toBeNull();
      expect((await ctx.repo.listar({ filtros: {}, page: 1, limit: 20 })).total).toBe(0);
    });

    it('debería listar del más nuevo al más antiguo, paginar y filtrar', async () => {
      await ctx.repo.guardarNuevo(nuevo(1, { categoria: 'red' }));
      await ctx.repo.guardarNuevo(nuevo(2, { titulo: 'Impresora rota' }));
      await ctx.repo.guardarNuevo(nuevo(3, { creador: { id: 11, nombre: 'María' } }));
      const pagina = await ctx.repo.listar({ filtros: {}, page: 1, limit: 2 });
      expect(pagina.total).toBe(3);
      expect(pagina.items.map((t) => t.id)).toEqual(['TKT-2026-0003', 'TKT-2026-0002']);
      expect((await ctx.repo.listar({ filtros: { categoria: 'red' }, page: 1, limit: 20 })).items.map((t) => t.id)).toEqual(['TKT-2026-0001']);
      expect((await ctx.repo.listar({ filtros: { usuarioId: 11 }, page: 1, limit: 20 })).total).toBe(1);
      expect((await ctx.repo.listar({ filtros: { search: 'IMPRESORA' }, page: 1, limit: 20 })).total).toBe(1);
      expect((await ctx.repo.listar({ filtros: { search: '0003' }, page: 1, limit: 20 })).total).toBe(1);
    });

    it('debería tratar % y _ de la búsqueda como texto literal', async () => {
      await ctx.repo.guardarNuevo(nuevo(1, { titulo: 'Sin red' }));
      expect((await ctx.repo.listar({ filtros: { search: '%' }, page: 1, limit: 20 })).total).toBe(0);
      expect((await ctx.repo.listar({ filtros: { search: '_' }, page: 1, limit: 20 })).total).toBe(0);
    });

    it('debería contar la carga activa por técnico y categoría', async () => {
      const ana = { id: 20, nombre: 'Ana' };
      await ctx.repo.guardarNuevo(nuevo(1).asignarA(ana));
      await ctx.repo.guardarNuevo(nuevo(2, { categoria: 'red' }).asignarA(ana));
      const resuelto = await ctx.repo.guardarNuevo(nuevo(3).asignarA(ana));
      await ctx.repo.actualizar(resuelto.cambiarEstado('en_proceso').cambiarEstado('resuelto'));
      expect(await ctx.repo.contarCargaActiva({ tecnicoId: 20 })).toBe(2);
      expect(await ctx.repo.contarCargaActiva({ tecnicoId: 20, categoria: 'hardware' })).toBe(1);
      expect(await ctx.repo.contarCargaActiva({ tecnicoId: 21 })).toBe(0);
    });

    it('debería listar como pendientes de alerta SLA solo activos con técnico y sin alerta', async () => {
      const ana = { id: 20, nombre: 'Ana' };
      await ctx.repo.guardarNuevo(nuevo(1).asignarA(ana));
      await ctx.repo.guardarNuevo(nuevo(2));
      await ctx.repo.guardarNuevo(nuevo(3).asignarA(ana).marcarAlertaSLAEnviada());
      const cerrado = await ctx.repo.guardarNuevo(nuevo(4).asignarA(ana));
      await ctx.repo.actualizar(cerrado.cambiarEstado('en_proceso').cambiarEstado('resuelto').cambiarEstado('cerrado'));
      expect((await ctx.repo.listarPendientesDeAlertaSLA()).map((t) => t.id)).toEqual(['TKT-2026-0001']);
    });
  });
};

module.exports = { probarContratoTicketRepository };
