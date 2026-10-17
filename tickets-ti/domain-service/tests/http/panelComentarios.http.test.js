// Panel HTML de comentarios: ciclo completo modelo → controlador → vista por
// HTTP contra PostgreSQL de pruebas (MODULO_MVC).
const request = require('supertest');
const { abrirServidorDePrueba, USUARIOS } = require('./servidorDePrueba');

const { admin, luis, ana } = USUARIOS;
const ruta = (id) => `/api/v1/mvc/tickets/${id}/comentarios`;
let s;

const crearTicket = async () => (await s.como(luis).post('/api/tickets').send({
  titulo: 'Monitor', descripcion: 'No enciende', tipo: 'incidente', categoria: 'hardware', prioridad: 'alta',
})).body.data;
const enviarFormulario = (id, texto) => s.como(admin).post(ruta(id)).type('form').send({ texto });

beforeAll(async () => { s = await abrirServidorDePrueba(); });
beforeEach(async () => { await s.reiniciar({ modulos: { mvc: true } }); });
afterAll(async () => { await s.cerrar(); });

describe('Panel HTML de comentarios (/api/v1/mvc/tickets/:id/comentarios)', () => {
  it('debería mostrar el panel en HTML al administrador', async () => {
    const t = await crearTicket();
    const res = await s.como(admin).get(ruta(t.id));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`<h1>${t.id} · Monitor</h1>`);
    expect(res.text).toContain('<form method="post">');
  });

  it('debería guardar el formulario y redirigir (Post/Redirect/Get)', async () => {
    const t = await crearTicket();
    const res = await enviarFormulario(t.id, 'Revisado <b>en sitio</b>');
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(ruta(t.id));
    const panel = await s.como(admin).get(ruta(t.id));
    expect(panel.text).toContain('Comentarios (1)');
    expect(panel.text).toContain('<p>Revisado en sitio</p>');
  });

  it('debería repintar el formulario con 400 si el texto es inválido o el ticket está cerrado', async () => {
    const t = await crearTicket();
    const vacio = await enviarFormulario(t.id, '   ');
    expect(vacio.status).toBe(400);
    expect(vacio.text).toContain('El comentario debe tener entre 1 y 2000 caracteres');
    const soloHtml = await enviarFormulario(t.id, '<img src=x>');
    expect(soloHtml.status).toBe(400);
    expect(soloHtml.text).toContain('El comentario no puede estar vacío');
    for (const estado of ['en_proceso', 'resuelto', 'cerrado']) {
      // eslint-disable-next-line no-await-in-loop
      await s.como(admin).patch(`/api/tickets/${t.id}/status`).send({ estado });
    }
    const cerrado = await enviarFormulario(t.id, 'hola');
    expect(cerrado.status).toBe(400);
    expect(cerrado.text).toContain('No se puede comentar un ticket cerrado');
  });

  it('debería mostrar una página de error para id inválido o ticket inexistente', async () => {
    const invalido = await s.como(admin).get(ruta('abc'));
    expect([invalido.status, invalido.text.includes('id de ticket inválido')]).toEqual([400, true]);
    expect((await enviarFormulario('abc', 'hola')).status).toBe(400);
    const inexistente = await s.como(admin).get(ruta('TKT-2026-9999'));
    expect([inexistente.status, inexistente.text.includes('Ticket no encontrado')]).toEqual([404, true]);
    expect((await enviarFormulario('TKT-2026-9999', 'hola')).status).toBe(404);
  });

  it('debería ser solo para administradores, exigir token y no existir con MODULO_MVC apagado', async () => {
    const t = await crearTicket();
    expect((await s.como(ana).get(ruta(t.id))).status).toBe(403);
    expect((await s.como(luis).get(ruta(t.id))).status).toBe(403);
    expect((await request(s.app).get(ruta(t.id))).status).toBe(401);
    await s.reiniciar();
    expect((await s.como(admin).get(ruta(t.id))).status).toBe(404);
  });

  it('debería pasar al errorHandler central los errores que no son de dominio', async () => {
    const t = await crearTicket();
    await s.bd.sequelize.query('ALTER TABLE ticket_comentarios RENAME TO ticket_comentarios_tmp');
    try {
      expect((await s.como(admin).get(ruta(t.id))).status).toBe(500);
      expect((await enviarFormulario(t.id, 'hola')).status).toBe(500);
    } finally {
      await s.bd.sequelize.query('ALTER TABLE ticket_comentarios_tmp RENAME TO ticket_comentarios');
    }
  });
});
