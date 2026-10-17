// VISTA: arma el HTML del hilo de un ticket. Función pura: recibe datos ya
// preparados por el controlador y devuelve un string; no consulta nada.
const { escapar, layout } = require('./layout');

const _fecha = (valor) => (valor instanceof Date ? valor.toISOString() : String(valor ?? ''));

const _comentario = (c) => `<li>
<p><strong>${escapar(c.autor_nombre)}</strong> (${escapar(c.autor_rol)}) · <time>${escapar(_fecha(c.createdAt))}</time></p>
<p>${escapar(c.texto)}</p>
</li>`;

const _lista = (comentarios) => (comentarios.length
  ? `<ol>\n${comentarios.map(_comentario).join('\n')}\n</ol>`
  : '<p>Este ticket todavía no tiene comentarios.</p>');

const _errores = (errores) => (errores.length
  ? `<ul role="alert">${errores.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`
  : '');

// ticket: { id, titulo, estado, prioridad, usuario_nombre, tecnico_nombre }
const hiloView = ({ ticket, comentarios, errores = [], texto = '' }) => layout({
  titulo: `Comentarios de ${ticket.id}`,
  cuerpo: `<h1>${escapar(ticket.id)} · ${escapar(ticket.titulo)}</h1>
<p>Estado: ${escapar(ticket.estado)} · Prioridad: ${escapar(ticket.prioridad)} · Solicitante: ${escapar(ticket.usuario_nombre)} · Técnico: ${escapar(ticket.tecnico_nombre || 'sin asignar')}</p>
<h2>Comentarios (${comentarios.length})</h2>
${_lista(comentarios)}
<h2>Agregar comentario</h2>
${_errores(errores)}
<form method="post">
<textarea name="texto" rows="4" maxlength="2000" required>${escapar(texto)}</textarea>
<button type="submit">Comentar</button>
</form>`,
});

module.exports = { hiloView };
