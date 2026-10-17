// Capa de DATOS: integraciones externas (authcore, SMTP, Socket.io, JWT) y configuración.
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: clienteIo } = require('socket.io-client');
const {
  DirectorioAuthcore, CorreoSMTP, transporterNulo, TiempoRealSocketIo, actorDesdeToken,
} = require('../../src/datos');
const { escapar } = require('../../src/datos/integraciones/plantillas');
const { requerirEnv, configAuthcore, modulosHabilitados } = require('../../src/comun/env');
const { ErrorDirectorioNoDisponible } = require('../../src/comun/errores');
const { firmarComoAuthcore } = require('../helpers/jwtAuthcore');

const CLAVE = 'clave-interna-de-prueba';

// Servidor HTTP que imita /internal/* de authcore
const levantarAuthcoreFalso = (manejador) => new Promise((resolve) => {
  const server = http.createServer(manejador);
  server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});

const responder = (res, status, cuerpo) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
};

describe('DirectorioAuthcore', () => {
  let falso;
  let ultimaPeticion;

  beforeAll(async () => {
    falso = await levantarAuthcoreFalso((req, res) => {
      ultimaPeticion = { url: req.url, clave: req.headers['x-internal-key'] };
      if (req.headers['x-internal-key'] !== CLAVE) return responder(res, 401, { success: false });
      if (req.url === '/internal/users/10') return responder(res, 200, { id: 10, username: 'luis', email: 'l@t', roles: ['USER'] });
      if (req.url === '/internal/users/500') return responder(res, 500, { success: false });
      if (req.url === '/internal/users/777') return setTimeout(() => responder(res, 200, { data: {} }), 500);
      if (req.url === '/internal/tecnicos') return responder(res, 200, [{ id: 20, username: 'ana', email: null, roles: ['USER', 'TECNICO'] }]);
      return responder(res, 404, { success: false });
    });
  });

  afterAll(() => new Promise((r) => falso.server.close(r)));

  const directorio = (overrides = {}) => new DirectorioAuthcore({ baseUrl: `${falso.url}/`, internalKey: CLAVE, timeoutMs: 200, ...overrides });

  it('debería obtener un usuario enviando X-Internal-Key y traducirlo', async () => {
    expect(await directorio().obtenerUsuario(10)).toEqual({ id: 10, nombre: 'luis', email: 'l@t', rol: 'usuario', activo: true });
    expect(ultimaPeticion).toEqual({ url: '/internal/users/10', clave: CLAVE });
  });

  it('debería devolver null con 404 o id no numérico (sin llamar)', async () => {
    expect(await directorio().obtenerUsuario(404)).toBeNull();
    ultimaPeticion = null;
    expect(await directorio().obtenerUsuario('../admin')).toBeNull();
    expect(ultimaPeticion).toBeNull();
  });

  it('debería listar técnicos (authcore no tiene inactivos: ambas listas coinciden)', async () => {
    expect(await directorio().listarTecnicosActivos()).toEqual([{ id: 20, nombre: 'ana', email: null }]);
    expect(await directorio().listarTecnicos({ incluirInactivos: true }))
      .toEqual([{ id: 20, nombre: 'ana', email: null, rol: 'tecnico', activo: true }]);
    expect(ultimaPeticion.url).toBe('/internal/tecnicos');
  });

  it('debería lanzar ErrorDirectorioNoDisponible con 5xx, timeout o red caída', async () => {
    await expect(directorio().obtenerUsuario(500)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
    await expect(directorio().obtenerUsuario(777)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
    await expect(directorio({ baseUrl: 'http://127.0.0.1:1' }).obtenerUsuario(10)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
  });

  it('debería fallar fuerte (no degradar) si authcore rechaza la clave', async () => {
    const error = await directorio({ internalKey: 'otra' }).obtenerUsuario(10).catch((e) => e);
    expect(error).not.toBeInstanceOf(ErrorDirectorioNoDisponible);
    expect(error.message).toMatch(/AUTHCORE_INTERNAL_KEY/);
  });

  it('debería exigir baseUrl e internalKey', () => {
    expect(() => new DirectorioAuthcore({ baseUrl: 'http://x' })).toThrow(/internalKey/);
  });
});

describe('CorreoSMTP', () => {
  const ticket = {
    id: 'TKT-2026-0001', titulo: '<script>alert(1)</script>', descripcion: 'd', tipo: 'incidente', categoria: 'red',
    prioridad: 'alta', sla_limite: new Date(), tecnico_nombre: 'Ana Técnica',
  };
  const crear = () => {
    const transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    return { transporter, correo: new CorreoSMTP({ transporter, remitente: 'tickets@test' }) };
  };

  it('debería enviar la asignación al técnico escapando el HTML del título', async () => {
    const { transporter, correo } = crear();
    await correo.enviarTicketAsignado({ nombre: 'Ana', email: 'ana@test' }, ticket);
    const enviado = transporter.sendMail.mock.calls[0][0];
    expect(enviado).toMatchObject({ from: 'tickets@test', to: 'ana@test', subject: expect.stringContaining('[TKT-2026-0001] Ticket asignado') });
    expect(enviado.html).toContain('&lt;script&gt;');
    expect(enviado.html).not.toContain('<script>alert');
  });

  it('debería incluir el técnico (snapshot) en el email de resolución', async () => {
    const { transporter, correo } = crear();
    await correo.enviarTicketResuelto({ nombre: 'Luis', email: 'luis@test' }, ticket);
    expect(transporter.sendMail.mock.calls[0][0].html).toContain('Ana Técnica');
  });

  it('debería redondear el porcentaje en la alerta SLA', async () => {
    const { transporter, correo } = crear();
    await correo.enviarAlertaSLA({ nombre: 'Ana', email: 'ana@test' }, ticket, 81.25);
    expect(transporter.sendMail.mock.calls[0][0].subject).toBe('⚠️ Alerta SLA — TKT-2026-0001 al 81%');
  });

  it('debería fallar si el destinatario no tiene email o falta el transporter', async () => {
    await expect(crear().correo.enviarTicketAsignado({ nombre: 'X' }, ticket)).rejects.toThrow(/email/);
    expect(() => new CorreoSMTP({})).toThrow(/sendMail/);
  });

  it('transporterNulo debería descartar sin red', async () => {
    await expect(transporterNulo.sendMail({})).resolves.toEqual({ messageId: 'descartado' });
  });

  it('escapar debería neutralizar caracteres HTML', () => {
    expect(escapar(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapar(null)).toBe('');
  });
});

describe('TiempoRealSocketIo', () => {
  const SECRETO = process.env.JWT_SECRET;
  let server;
  let tiempoReal;
  let url;
  const clientes = [];

  beforeAll(async () => {
    server = http.createServer();
    tiempoReal = new TiempoRealSocketIo({ jwtSecret: SECRETO, origenPermitido: '*' });
    tiempoReal.adjuntar(server);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    clientes.forEach((c) => c.close());
    await tiempoReal.cerrar();
  });

  const conectar = (token) => new Promise((resolve, reject) => {
    const c = clienteIo(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    clientes.push(c);
    c.on('connect', () => resolve(c));
    c.on('connect_error', reject);
  });

  const recibir = (cliente, evento) => new Promise((resolve) => cliente.once(evento, resolve));

  it('debería rechazar conexiones sin token o con token inválido', async () => {
    await expect(conectar()).rejects.toThrow('Token requerido');
    await expect(conectar(jwt.sign({ id: 1 }, 'otro-secreto'))).rejects.toThrow('Token inválido');
    await expect(conectar(jwt.sign({ id: 1, rol: 'administrador' }, SECRETO))).rejects.toThrow('Token inválido');
  });

  it('debería entregar cada evento solo a su sala (user-, tecnico-, admin-room)', async () => {
    const usuario = await conectar(firmarComoAuthcore({ id: 10, nombre: 'luis', rol: 'usuario' }));
    const tecnico = await conectar(firmarComoAuthcore({ id: 20, nombre: 'ana', rol: 'tecnico' }));
    const admin = await conectar(firmarComoAuthcore({ id: 1, nombre: 'admin', rol: 'administrador' }));
    const intruso = jest.fn();
    usuario.on('ticket:nuevo', intruso);

    const [aUsuario, aTecnico, aAdmin] = [recibir(usuario, 'ticket:estado_cambiado'), recibir(tecnico, 'ticket:nuevo'), recibir(admin, 'estadisticas:actualizadas')];
    tiempoReal.emitirAUsuario(10, 'ticket:estado_cambiado', { ticketId: 'T1' });
    tiempoReal.emitirATecnico(20, 'ticket:nuevo', { ticketId: 'T2' });
    tiempoReal.emitirAAdmins('estadisticas:actualizadas', { total: 1 });

    expect(await aUsuario).toEqual({ ticketId: 'T1' });
    expect(await aTecnico).toEqual({ ticketId: 'T2' });
    expect(await aAdmin).toEqual({ total: 1 });
    expect(intruso).not.toHaveBeenCalled();
  });

  it('no debería fallar al emitir antes de adjuntarse a un servidor', () => {
    const suelto = new TiempoRealSocketIo({ jwtSecret: 'x' });
    expect(() => suelto.emitirAAdmins('e', {})).not.toThrow();
    expect(() => new TiempoRealSocketIo({})).toThrow(/jwtSecret/);
    return expect(suelto.cerrar()).resolves.toBeUndefined();
  });
});

describe('actorDesdeToken', () => {
  it('debería traducir un token de authcore y devolver null si no es válido', () => {
    const token = firmarComoAuthcore({ id: 10, nombre: 'luis', rol: 'usuario' });
    expect(actorDesdeToken(token, process.env.JWT_SECRET)).toEqual({ id: 10, rol: 'usuario', nombre: 'luis', email: null });
    expect(actorDesdeToken(token, 'otro-secreto')).toBeNull();
    expect(actorDesdeToken('no.es.jwt', process.env.JWT_SECRET)).toBeNull();
  });
});

describe('Configuración', () => {
  it('requerirEnv debería fallar si falta la variable', () => {
    expect(() => requerirEnv('NO_EXISTE_EN_TEST')).toThrow(/NO_EXISTE_EN_TEST/);
  });

  it('configAuthcore debería exigir AUTHCORE_URL', () => {
    delete process.env.AUTHCORE_URL;
    expect(() => configAuthcore()).toThrow(/AUTHCORE_URL/);
    process.env.AUTHCORE_URL = 'http://authcore:8081';
    expect(configAuthcore()).toEqual({ baseUrl: 'http://authcore:8081', internalKey: process.env.AUTHCORE_INTERNAL_KEY, timeoutMs: 3000 });
    delete process.env.AUTHCORE_URL;
  });

  it('modulosHabilitados debería encender comentarios solo con el valor exacto "true"', () => {
    delete process.env.MODULO_COMENTARIOS;
    expect(modulosHabilitados()).toEqual({ comentarios: false });
    process.env.MODULO_COMENTARIOS = '1';
    expect(modulosHabilitados().comentarios).toBe(false);
    process.env.MODULO_COMENTARIOS = 'true';
    expect(modulosHabilitados().comentarios).toBe(true);
    delete process.env.MODULO_COMENTARIOS;
  });
});
