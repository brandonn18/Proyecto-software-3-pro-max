// Capa de DATOS: ticketsDAO contra PostgreSQL. Las filas se arman con
// reglasTicket (negocio) solo para no repetir el detalle de las columnas.
const { TicketsDAO } = require('../../src/datos/dao/ticketsDAO');
const { nuevoTicket, cambiosDeAsignacion } = require('../../src/negocio/reglas/reglasTicket');
const { ErrorIdDuplicado } = require('../../src/comun/errores');
const { abrirBdDePrueba } = require('./bdDePrueba');

const AHORA = new Date('2026-10-08T12:00:00.000Z');
const HORA = 3600000;
const ANA = { id: 20, nombre: 'Ana Técnica' };

const fila = (n, overrides = {}) => nuevoTicket({
  id: `TKT-2026-${String(n).padStart(4, '0')}`, titulo: `Ticket ${n}`, descripcion: 'desc', tipo: 'incidente',
  categoria: 'hardware', prioridad: 'alta', creador: { id: 10, nombre: 'Luis Usuario' }, ...overrides,
}, { ahora: AHORA, horas: 8 });
const asignada = (f) => ({ ...f, ...cambiosDeAsignacion(f, ANA) });

let bd;
let dao;

beforeAll(async () => { bd = await abrirBdDePrueba(); dao = new TicketsDAO(bd.modelos); });
beforeEach(async () => { await bd.limpiar(); });
afterAll(async () => { await bd.cerrar(); });

describe('ticketsDAO', () => {
  it('debería insertar y leer un objeto plano con sus snapshots', async () => {
    await dao.insertar(asignada(fila(1)));
    const t = await dao.buscarPorId('TKT-2026-0001');
    expect(t).toMatchObject({ estado: 'asignado', usuario_nombre: 'Luis Usuario', tecnicoId: 20, tecnico_nombre: 'Ana Técnica' });
    expect(new Date(t.sla_limite)).toEqual(new Date(AHORA.getTime() + 8 * HORA));
    expect(t.createdAt).toBeInstanceOf(Date);
    expect(Object.getPrototypeOf(t)).toBe(Object.prototype);
  });

  it('debería devolver null si no existe y lanzar ErrorIdDuplicado con un id repetido', async () => {
    expect(await dao.buscarPorId('TKT-2026-9999')).toBeNull();
    await dao.insertar(fila(1));
    await expect(dao.insertar(fila(1))).rejects.toBeInstanceOf(ErrorIdDuplicado);
  });

  it('debería contar por año incluyendo eliminados', async () => {
    await dao.insertar(fila(1));
    await dao.insertar(fila(2));
    await dao.eliminar('TKT-2026-0002');
    expect(await dao.contarDelAnio(2026)).toBe(2);
    expect(await dao.contarDelAnio(2025)).toBe(0);
  });

  it('debería actualizar solo columnas mutables y ocultar los eliminados', async () => {
    await dao.insertar(fila(1));
    const t = await dao.actualizar('TKT-2026-0001', { estado: 'en_proceso', usuarioId: 999, id: 'otro' });
    expect(t).toMatchObject({ id: 'TKT-2026-0001', estado: 'en_proceso', usuarioId: 10 });
    await dao.eliminar(t.id);
    expect(await dao.buscarPorId(t.id)).toBeNull();
    expect((await dao.listar({ filtros: {}, page: 1, limit: 20 })).total).toBe(0);
  });

  it('debería listar del más nuevo al más antiguo, paginar y filtrar', async () => {
    await dao.insertar(fila(1, { categoria: 'red' }));
    await dao.insertar(fila(2, { titulo: 'Impresora rota' }));
    await dao.insertar(fila(3, { creador: { id: 11, nombre: 'María' } }));
    const pagina = await dao.listar({ filtros: {}, page: 1, limit: 2 });
    expect(pagina.total).toBe(3);
    expect(pagina.items.map((t) => t.id)).toEqual(['TKT-2026-0003', 'TKT-2026-0002']);
    expect((await dao.listar({ filtros: { categoria: 'red' }, page: 1, limit: 20 })).items.map((t) => t.id)).toEqual(['TKT-2026-0001']);
    expect((await dao.listar({ filtros: { usuarioId: 11 }, page: 1, limit: 20 })).total).toBe(1);
    expect((await dao.listar({ filtros: { search: 'IMPRESORA' }, page: 1, limit: 20 })).total).toBe(1);
    expect((await dao.listar({ filtros: { search: '0003' }, page: 1, limit: 20 })).total).toBe(1);
    expect((await dao.listar({ filtros: { fechaDesde: '2000-01-01', fechaHasta: '2999-12-31' }, page: 1, limit: 20 })).total).toBe(3);
  });

  it('debería tratar % y _ de la búsqueda como texto literal', async () => {
    await dao.insertar(fila(1, { titulo: 'Sin red' }));
    expect((await dao.listar({ filtros: { search: '%' }, page: 1, limit: 20 })).total).toBe(0);
    expect((await dao.listar({ filtros: { search: '_' }, page: 1, limit: 20 })).total).toBe(0);
  });

  it('debería contar la carga activa por técnico y categoría', async () => {
    await dao.insertar(asignada(fila(1)));
    await dao.insertar(asignada(fila(2, { categoria: 'red' })));
    await dao.insertar({ ...asignada(fila(3)), estado: 'resuelto' });
    expect(await dao.contarCargaActiva({ tecnicoId: 20 })).toBe(2);
    expect(await dao.contarCargaActiva({ tecnicoId: 20, categoria: 'hardware' })).toBe(1);
    expect(await dao.contarCargaActiva({ tecnicoId: 21 })).toBe(0);
  });

  it('debería listar como pendientes de alerta SLA solo activos con técnico y sin alerta', async () => {
    await dao.insertar(asignada(fila(1)));
    await dao.insertar(fila(2));
    await dao.insertar({ ...asignada(fila(3)), sla_alerta_enviada: true });
    await dao.insertar({ ...asignada(fila(4)), estado: 'cerrado' });
    expect((await dao.listarPendientesDeAlertaSLA()).map((t) => t.id)).toEqual(['TKT-2026-0001']);
  });

  it('debería exigir el modelo Ticket', () => {
    expect(() => new TicketsDAO({})).toThrow(/Ticket/);
  });
});
