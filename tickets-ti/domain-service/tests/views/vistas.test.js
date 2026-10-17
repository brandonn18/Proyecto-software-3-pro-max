// VISTAS: funciones puras. Se prueban con objetos sueltos o con algo que
// imita una instancia de Sequelize (get({ plain: true })), sin base de datos.
const respuesta = require('../../src/views/respuesta');
const ticketView = require('../../src/views/ticketView');
const reporteView = require('../../src/views/reporteView');
const comentarioView = require('../../src/views/comentarioView');
const { hiloView } = require('../../src/views/html/hiloView');
const { errorView } = require('../../src/views/html/errorView');
const { escapar } = require('../../src/views/html/layout');

const comoInstancia = (datos) => ({ get: ({ plain }) => (plain ? { ...datos } : undefined) });
const TICKET = { id: 'TKT-2026-0001', titulo: 'Monitor', estado: 'asignado', prioridad: 'alta', usuario_nombre: 'Luis', tecnico_nombre: null };

describe('respuesta', () => {
  it('debería armar el sobre de éxito, paginado y error', () => {
    expect(respuesta.exito({ a: 1 })).toEqual({ success: true, data: { a: 1 }, message: 'OK' });
    expect(respuesta.paginado([1, 2], { total: 7, page: 1, limit: 5 })).toEqual({
      success: true, data: [1, 2], meta: { total: 7, page: 1, limit: 5, totalPages: 2 },
    });
    expect(respuesta.error('x')).toEqual({ success: false, message: 'x', errors: [] });
  });
});

describe('ticketView', () => {
  it('debería quitar deletedAt y armar usuario/tecnico desde el snapshot', () => {
    const vista = ticketView.ticket(comoInstancia({ id: 'T', usuarioId: 10, usuario_nombre: 'Luis', tecnicoId: 20, tecnico_nombre: 'Ana', deletedAt: null }));
    expect(vista).toEqual({
      id: 'T', usuarioId: 10, usuario_nombre: 'Luis', tecnicoId: 20, tecnico_nombre: 'Ana',
      usuario: { id: 10, nombre: 'Luis' }, tecnico: { id: 20, nombre: 'Ana' },
    });
    expect(ticketView.ticket({ id: 'T', usuarioId: 10, usuario_nombre: 'Luis', tecnicoId: null }).tecnico).toBeNull();
  });

  it('debería armar el detalle con el historial y el actor de cada registro', () => {
    const historial = [comoInstancia({ id: 1, accion: 'TICKET_CREADO', detalle: {}, createdAt: 'f', usuarioId: 10, usuario_nombre: 'Luis', ticketId: 'T' })];
    const vista = ticketView.detalle({ id: 'T', usuarioId: 10, usuario_nombre: 'Luis' }, historial);
    expect(vista.auditorias).toEqual([{ id: 1, accion: 'TICKET_CREADO', detalle: {}, createdAt: 'f', usuario: { id: 10, nombre: 'Luis' } }]);
    expect(ticketView.registroDeAuditoria({ id: 2, accion: 'SISTEMA', usuarioId: null }).usuario).toBeNull();
  });
});

describe('reporteView', () => {
  it('debería armar el resumen admin con ceros para los estados que no aparecen', () => {
    const vista = reporteView.resumenAdmin({
      totalTickets: 3, porEstado: [{ estado: 'abierto', total: '2' }, { estado: 'resuelto', total: '1' }],
      porPrioridad: [], porCategoria: [], slaVencidos: 1, slaCumplidos: 0, promedioResolucionHoras: '0.0',
    }, 2);
    expect(vista).toMatchObject({ totalTickets: 3, abiertos: 2, resueltos: 1, enProceso: 0, tecnicosActivos: 2, slaVencidos: 1 });
  });

  it('debería armar rendimiento, por técnico y estadísticas', () => {
    expect(reporteView.rendimientoTecnico({ id: 20, nombre: 'Ana', email: 'a@t' }, { asignados: 2, resueltos: 1, slaVencidos: 0, promedioResolucionHoras: '1.5' }))
      .toEqual({ tecnicoId: 20, nombre: 'Ana', email: 'a@t', ticketsAsignados: 2, ticketsResueltos: 1, promedioResolucionHoras: '1.5', slasCumplidos: 1, slasVencidos: 0 });
    expect(reporteView.porTecnico([{ tecnicoId: 20, tecnico_nombre: 'Ana', total: 2 }, { tecnicoId: null, tecnico_nombre: null, total: '1' }]))
      .toEqual([{ tecnicoId: 20, total: '2', tecnico: { nombre: 'Ana' } }, { tecnicoId: null, total: '1', tecnico: null }]);
    expect(reporteView.estadisticas({ total: 5 }, 1)).toEqual({ total: 5, tecnicosActivos: 1 });
  });
});

describe('comentarioView', () => {
  it('debería armar el autor desde el snapshot', () => {
    expect(comentarioView.comentario({ id: 1, ticketId: 'T', texto: 'x', createdAt: 'f', autorId: 10, autor_nombre: 'Luis', autor_rol: 'usuario' }))
      .toEqual({ id: 1, ticketId: 'T', texto: 'x', createdAt: 'f', autor: { id: 10, nombre: 'Luis', rol: 'usuario' } });
  });
});

describe('vistas HTML', () => {
  it('escapar debería neutralizar los caracteres de HTML', () => {
    expect(escapar(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapar(undefined)).toBe('');
  });

  it('hiloView debería escapar los datos y avisar si no hay comentarios', () => {
    const vacio = hiloView({ ticket: { ...TICKET, titulo: '<script>x()</script>' }, comentarios: [] });
    expect(vacio).toContain('Este ticket todavía no tiene comentarios.');
    expect(vacio).toContain('&lt;script&gt;');
    expect(vacio).not.toContain('<script>');
    expect(vacio).toContain('Técnico: sin asignar');
  });

  it('hiloView debería listar comentarios, errores y conservar el texto escrito', () => {
    const html = hiloView({
      ticket: TICKET,
      comentarios: [{ autor_nombre: 'Ana', autor_rol: 'tecnico', createdAt: new Date('2026-10-15T12:00:00.000Z'), texto: '<i>ok</i>' }],
      errores: ['Escribe un comentario'],
      texto: 'borrador',
    });
    expect(html).toContain('Comentarios (1)');
    expect(html).toContain('<time>2026-10-15T12:00:00.000Z</time>');
    expect(html).toContain('&lt;i&gt;ok&lt;/i&gt;');
    expect(html).toContain('<ul role="alert"><li>Escribe un comentario</li></ul>');
    expect(html).toContain('>borrador</textarea>');
  });

  it('errorView debería escapar el mensaje', () => {
    expect(errorView({ mensaje: '<b>x</b>' })).toContain('<p role="alert">&lt;b&gt;x&lt;/b&gt;</p>');
  });
});
