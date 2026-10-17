// Plantillas HTML de emails de tickets (mismo diseño que el monolito).
// Todo valor dinámico pasa por escapar(): títulos y nombres vienen de usuarios.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const ESTILOS = `
  body{margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#1d4ed8;padding:28px 32px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:.5px}
  .body{padding:32px}
  .body p{color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
  .badge-blue{background:#dbeafe;color:#1d4ed8}
  .badge-orange{background:#fef3c7;color:#b45309}
  .badge-red{background:#fee2e2;color:#b91c1c}
  .badge-green{background:#d1fae5;color:#065f46}
  .info-box{background:#f8fafc;border-left:4px solid #1d4ed8;padding:16px;border-radius:0 6px 6px 0;margin:20px 0}
  .info-box p{margin:4px 0;color:#374151;font-size:14px}
  .info-box strong{color:#111827}
  .footer{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}`;

const layout = (titulo, cuerpo) => `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${ESTILOS}</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>🎫 Tickets TI — ${titulo}</h1></div>
  <div class="body">${cuerpo}</div>
  <div class="footer">Sistema de Gestión de Tickets · Universidad de Pamplona<br>Este es un mensaje automático, no respondas a este correo.</div>
</div>
</body></html>`;

const BADGE_PRIORIDAD = { critica: 'badge-red', alta: 'badge-orange', media: 'badge-blue', baja: 'badge-green' };
const badgePrioridad = (p) => `<span class="badge ${BADGE_PRIORIDAD[p] || 'badge-blue'}">${escapar(String(p || '').toUpperCase())}</span>`;
const fechaCO = (fecha) => new Date(fecha).toLocaleString('es-CO');

const ticketAsignado = (tecnico, t) => ({
  subject: `[${t.id}] Ticket asignado — ${t.titulo}`,
  html: layout('Ticket asignado', `
      <p>Hola <strong>${escapar(tecnico.nombre)}</strong>,</p>
      <p>Se te ha asignado un nuevo ticket de soporte que requiere tu atención.</p>
      <div class="info-box">
        <p><strong>ID:</strong> ${escapar(t.id)}</p>
        <p><strong>Título:</strong> ${escapar(t.titulo)}</p>
        <p><strong>Tipo:</strong> ${escapar(t.tipo)} &nbsp;|&nbsp; <strong>Categoría:</strong> ${escapar(t.categoria)}</p>
        <p><strong>Prioridad:</strong> ${badgePrioridad(t.prioridad)}</p>
        <p><strong>SLA límite:</strong> ${fechaCO(t.sla_limite)}</p>
      </div>
      <p><strong>Descripción:</strong><br>${escapar(t.descripcion)}</p>
      <p>Ingresa al sistema para gestionar este ticket.</p>`),
});

const ticketResuelto = (usuario, t) => ({
  subject: `[${t.id}] Tu ticket ha sido resuelto`,
  html: layout('Ticket resuelto', `
      <p>Hola <strong>${escapar(usuario.nombre)}</strong>,</p>
      <p>Nos complace informarte que tu solicitud de soporte ha sido atendida.</p>
      <div class="info-box">
        <p><strong>ID:</strong> ${escapar(t.id)}</p>
        <p><strong>Título:</strong> ${escapar(t.titulo)}</p>
        <p><strong>Estado:</strong> <span class="badge badge-green">RESUELTO</span></p>
        <p><strong>Técnico:</strong> ${escapar(t.tecnico_nombre || 'Sin asignar')}</p>
      </div>
      <p>Si el problema persiste, puedes reabrir el ticket desde el sistema indicando el motivo.</p>`),
});

const alertaSLA = (tecnico, t, porcentaje) => ({
  subject: `⚠️ Alerta SLA — ${t.id} al ${Math.round(porcentaje)}%`,
  html: layout('Alerta de SLA', `
      <p>Hola <strong>${escapar(tecnico.nombre)}</strong>,</p>
      <p>⚠️ El siguiente ticket está próximo a vencer su SLA:</p>
      <div class="info-box">
        <p><strong>ID:</strong> ${escapar(t.id)}</p>
        <p><strong>Título:</strong> ${escapar(t.titulo)}</p>
        <p><strong>Prioridad:</strong> ${badgePrioridad(t.prioridad)}</p>
        <p><strong>SLA límite:</strong> ${fechaCO(t.sla_limite)}</p>
        <p><strong>Tiempo consumido:</strong> <span class="badge badge-red">${Math.round(porcentaje)}%</span></p>
      </div>
      <p>Por favor atiende este ticket a la brevedad para evitar el vencimiento del SLA.</p>`),
});

module.exports = { escapar, ticketAsignado, ticketResuelto, alertaSLA };
