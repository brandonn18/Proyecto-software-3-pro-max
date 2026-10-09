const http = require('http');
const jwt = require('jsonwebtoken');
const { io: clienteIo } = require('socket.io-client');
const {
  AuthcoreUserAdapter, NodemailerEmailAdapter, transporterNulo, SocketIoRealtimeAdapter, NotificacionInAppAdapter, SystemClock,
  requerirEnv, configAuthcore,
} = require('../../src/infrastructure');
const { escapar } = require('../../src/infrastructure/email/plantillas');
const { ErrorDirectorioNoDisponible } = require('../../src/application/errores');
const { RealtimeEspia } = require('../application/fakes');

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

describe('AuthcoreUserAdapter', () => {
  let falso;
  let ultimaPeticion;

  beforeAll(async () => {
    falso = await levantarAuthcoreFalso((req, res) => {
      ultimaPeticion = { url: req.url, clave: req.headers['x-internal-key'] };
      if (req.headers['x-internal-key'] !== CLAVE) return responder(res, 401, { success: false });
      if (req.url === '/internal/users/10') return responder(res, 200, { success: true, data: { id: 10, nombre: 'Luis', email: 'l@t', rol: 'usuario', activo: true } });
      if (req.url === '/internal/users/500') return responder(res, 500, { success: false });
      if (req.url === '/internal/users/777') return setTimeout(() => responder(res, 200, { data: {} }), 500);
      if (req.url.startsWith('/internal/tecnicos')) return responder(res, 200, { success: true, data: [{ id: 20, nombre: 'Ana', email: 'a@t' }] });
      return responder(res, 404, { success: false });
    });
  });

  afterAll(() => new Promise((r) => falso.server.close(r)));

  const adaptador = (overrides = {}) => new AuthcoreUserAdapter({ baseUrl: `${falso.url}/`, internalKey: CLAVE, timeoutMs: 200, ...overrides });

  it('debería obtener un usuario enviando x-internal-key', async () => {
    expect(await adaptador().obtenerUsuario(10)).toEqual({ id: 10, nombre: 'Luis', email: 'l@t', rol: 'usuario', activo: true });
    expect(ultimaPeticion).toEqual({ url: '/internal/users/10', clave: CLAVE });
  });

  it('debería devolver null con 404 o id no numérico (sin llamar)', async () => {
    expect(await adaptador().obtenerUsuario(404)).toBeNull();
    ultimaPeticion = null;
    expect(await adaptador().obtenerUsuario('../admin')).toBeNull();
    expect(ultimaPeticion).toBeNull();
  });

  it('debería listar técnicos activos y con inactivos', async () => {
    expect(await adaptador().listarTecnicosActivos()).toEqual([{ id: 20, nombre: 'Ana', email: 'a@t' }]);
    await adaptador().listarTecnicos({ incluirInactivos: true });
    expect(ultimaPeticion.url).toBe('/internal/tecnicos?incluirInactivos=true');
  });

  it('debería lanzar ErrorDirectorioNoDisponible con 5xx, timeout o red caída', async () => {
    await expect(adaptador().obtenerUsuario(500)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
    await expect(adaptador().obtenerUsuario(777)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
    await expect(adaptador({ baseUrl: 'http://127.0.0.1:1' }).obtenerUsuario(10)).rejects.toBeInstanceOf(ErrorDirectorioNoDisponible);
  });

  it('debería fallar fuerte (no degradar) si authcore rechaza la clave', async () => {
    const error = await adaptador({ internalKey: 'otra' }).obtenerUsuario(10).catch((e) => e);
    expect(error).not.toBeInstanceOf(ErrorDirectorioNoDisponible);
    expect(error.message).toMatch(/AUTHCORE_INTERNAL_KEY/);
  });

  it('debería exigir baseUrl e internalKey', () => {
    expect(() => new AuthcoreUserAdapter({ baseUrl: 'http://x' })).toThrow(/internalKey/);
  });
});

describe('NodemailerEmailAdapter', () => {
  const ticket = {
    id: 'TKT-2026-0001', titulo: '<script>alert(1)</script>', descripcion: 'd', tipo: 'incidente', categoria: 'red',
    prioridad: 'alta', sla_limite: new Date(), tecnico_nombre: 'Ana Técnica',
  };
  const crear = () => {
    const transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    return { transporter, adaptador: new NodemailerEmailAdapter({ transporter, remitente: 'tickets@test' }) };
  };

  it('debería enviar la asignación al técnico escapando el HTML del título', async () => {
    const { transporter, adaptador } = crear();
    await adaptador.enviarTicketAsignado({ nombre: 'Ana', email: 'ana@test' }, ticket);
    const correo = transporter.sendMail.mock.calls[0][0];
    expect(correo).toMatchObject({ from: 'tickets@test', to: 'ana@test', subject: expect.stringContaining('[TKT-2026-0001] Ticket asignado') });
    expect(correo.html).toContain('&lt;script&gt;');
    expect(correo.html).not.toContain('<script>alert');
  });

  it('debería incluir el técnico (snapshot) en el email de resolución', async () => {
    const { transporter, adaptador } = crear();
    await adaptador.enviarTicketResuelto({ nombre: 'Luis', email: 'luis@test' }, ticket);
    expect(transporter.sendMail.mock.calls[0][0].html).toContain('Ana Técnica');
  });

  it('debería redondear el porcentaje en la alerta SLA', async () => {
    const { transporter, adaptador } = crear();
    await adaptador.enviarAlertaSLA({ nombre: 'Ana', email: 'ana@test' }, ticket, 81.25);
    expect(transporter.sendMail.mock.calls[0][0].subject).toBe('⚠️ Alerta SLA — TKT-2026-0001 al 81%');
  });

  it('debería fallar si el destinatario no tiene email o falta el transporter', async () => {
    await expect(crear().adaptador.enviarTicketAsignado({ nombre: 'X' }, ticket)).rejects.toThrow(/email/);
    expect(() => new NodemailerEmailAdapter({})).toThrow(/sendMail/);
  });

  it('transporterNulo debería descartar sin red', async () => {
    await expect(transporterNulo.sendMail({})).resolves.toEqual({ messageId: 'descartado' });
  });

  it('escapar debería neutralizar caracteres HTML', () => {
    expect(escapar(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapar(null)).toBe('');
  });
});

describe('SocketIoRealtimeAdapter', () => {
  const SECRETO = process.env.JWT_SECRET;
  let server;
  let adaptador;
  let url;
  const clientes = [];

  beforeAll(async () => {
    server = http.createServer();
    adaptador = new SocketIoRealtimeAdapter({ jwtSecret: SECRETO, origenPermitido: '*' });
    adaptador.adjuntar(server);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    clientes.forEach((c) => c.close());
    await adaptador.cerrar();
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
  });

  it('debería entregar cada evento solo a su sala (user-, tecnico-, admin-room)', async () => {
    const usuario = await conectar(jwt.sign({ id: 10, rol: 'usuario' }, SECRETO));
    const tecnico = await conectar(jwt.sign({ id: 20, rol: 'tecnico' }, SECRETO));
    const admin = await conectar(jwt.sign({ id: 1, rol: 'administrador' }, SECRETO));
    const intruso = jest.fn();
    usuario.on('ticket:nuevo', intruso);

    const [aUsuario, aTecnico, aAdmin] = [recibir(usuario, 'ticket:estado_cambiado'), recibir(tecnico, 'ticket:nuevo'), recibir(admin, 'estadisticas:actualizadas')];
    adaptador.emitirAUsuario(10, 'ticket:estado_cambiado', { ticketId: 'T1' });
    adaptador.emitirATecnico(20, 'ticket:nuevo', { ticketId: 'T2' });
    adaptador.emitirAAdmins('estadisticas:actualizadas', { total: 1 });

    expect(await aUsuario).toEqual({ ticketId: 'T1' });
    expect(await aTecnico).toEqual({ ticketId: 'T2' });
    expect(await aAdmin).toEqual({ total: 1 });
    expect(intruso).not.toHaveBeenCalled();
  });

  it('no debería fallar al emitir antes de adjuntarse a un servidor', () => {
    const suelto = new SocketIoRealtimeAdapter({ jwtSecret: 'x' });
    expect(() => suelto.emitirAAdmins('e', {})).not.toThrow();
    expect(() => new SocketIoRealtimeAdapter({})).toThrow(/jwtSecret/);
    return expect(suelto.cerrar()).resolves.toBeUndefined();
  });
});

describe('NotificacionInAppAdapter', () => {
  const crear = () => {
    const repositorio = { crear: jest.fn(async (n) => ({ id: 1, leida: false, ...n })) };
    const realtime = new RealtimeEspia();
    return { repositorio, realtime, adaptador: new NotificacionInAppAdapter({ repositorio, realtime }) };
  };

  it('debería guardar y empujar notificacion:nueva con push', async () => {
    const { repositorio, realtime, adaptador } = crear();
    await adaptador.notificar({ usuarioId: 10, ticketId: 'T', tipo: 'sla_alerta', mensaje: 'm', push: true });
    expect(repositorio.crear).toHaveBeenCalledWith({ usuarioId: 10, ticketId: 'T', tipo: 'sla_alerta', mensaje: 'm' });
    expect(realtime.eventos).toEqual([{ destino: 'usuario:10', evento: 'notificacion:nueva', datos: expect.objectContaining({ id: 1, mensaje: 'm' }) }]);
  });

  it('debería solo guardar sin push', async () => {
    const { realtime, adaptador } = crear();
    await adaptador.notificar({ usuarioId: 10, tipo: 'creacion', mensaje: 'm', push: false });
    expect(realtime.eventos).toEqual([]);
  });

  it('debería validar sus dependencias', () => {
    expect(() => new NotificacionInAppAdapter({ realtime: new RealtimeEspia() })).toThrow(/repositorio/);
    expect(() => new NotificacionInAppAdapter({ repositorio: { crear() {} }, realtime: {} })).toThrow(/RealtimePort/);
  });
});

describe('SystemClock y configuración', () => {
  it('SystemClock debería devolver la hora actual', () => {
    const antes = Date.now();
    const ahora = new SystemClock().ahora().getTime();
    expect(ahora).toBeGreaterThanOrEqual(antes);
  });

  it('requerirEnv debería fallar si falta la variable', () => {
    expect(() => requerirEnv('NO_EXISTE_EN_TEST')).toThrow(/NO_EXISTE_EN_TEST/);
  });

  it('configAuthcore debería exigir AUTHCORE_URL', () => {
    delete process.env.AUTHCORE_URL;
    expect(() => configAuthcore()).toThrow(/AUTHCORE_URL/);
    process.env.AUTHCORE_URL = 'http://authcore:3002';
    expect(configAuthcore()).toEqual({ baseUrl: 'http://authcore:3002', internalKey: process.env.AUTHCORE_INTERNAL_KEY, timeoutMs: 3000 });
    delete process.env.AUTHCORE_URL;
  });
});
