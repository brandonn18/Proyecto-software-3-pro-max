const { sendEmail } = require('../config/email');

const _layout = (title, body) => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#1d4ed8;padding:28px 32px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:.5px}
  .body{padding:32px}
  .body p{color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px}
  .info-box{background:#f8fafc;border-left:4px solid #1d4ed8;padding:16px;border-radius:0 6px 6px 0;margin:20px 0}
  .info-box p{margin:4px 0;color:#374151;font-size:14px}
  .info-box strong{color:#111827}
  .footer{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>🎫 Tickets TI — ${title}</h1></div>
  <div class="body">${body}</div>
  <div class="footer">Sistema de Gestión de Tickets · Universidad de Pamplona<br>Este es un mensaje automático, no respondas a este correo.</div>
</div>
</body></html>`;

const _codigo = (texto) =>
  `<code style="background:#e5e7eb;padding:2px 6px;border-radius:4px">${texto}</code>`;

const sendWelcomeEmail = (user, tempPassword) =>
  sendEmail({
    to: user.email,
    subject: '¡Bienvenido al Sistema de Tickets TI!',
    html: _layout('Bienvenido', `
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Tu cuenta ha sido creada exitosamente en el Sistema de Gestión de Tickets TI.</p>
      <div class="info-box">
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Contraseña temporal:</strong> ${_codigo(tempPassword)}</p>
        <p><strong>Rol asignado:</strong> ${user.rol}</p>
      </div>
      <p>⚠️ <strong>Por seguridad</strong>, cambia tu contraseña al ingresar por primera vez desde tu perfil.</p>
    `),
  });

const sendPasswordResetEmail = (user, tempPassword) =>
  sendEmail({
    to: user.email,
    subject: 'Restablecimiento de contraseña — Tickets TI',
    html: _layout('Restablecimiento de contraseña', `
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Un administrador ha restablecido tu contraseña.</p>
      <div class="info-box">
        <p><strong>Contraseña temporal:</strong> ${_codigo(tempPassword)}</p>
      </div>
      <p>⚠️ Esta contraseña es temporal. Ingresar y cambiarla de inmediato desde <strong>Mi Perfil</strong>.</p>
      <p>Si no solicitaste este cambio, contacta al administrador inmediatamente.</p>
    `),
  });

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
