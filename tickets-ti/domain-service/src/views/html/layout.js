// VISTA: utilidades comunes. Toda palabra que viene de datos pasa por
// escapar() antes de entrar al HTML (evita XSS aunque el texto ya venga limpio).
const ENTIDADES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

// cuerpo: HTML ya escapado por la vista que llama
const layout = ({ titulo, cuerpo }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
</head>
<body>
<main>
${cuerpo}
</main>
</body>
</html>`;

module.exports = { escapar, layout };
