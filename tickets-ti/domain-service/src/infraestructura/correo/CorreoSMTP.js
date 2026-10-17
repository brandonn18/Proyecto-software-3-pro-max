// Implementación concreta de ServicioDeCorreo con nodemailer. El transporter
// se inyecta: en tests se pasa uno falso y nunca se envía un email real.
const nodemailer = require('nodemailer');
const { ServicioDeCorreo } = require('../../interfaces');
const plantillas = require('./plantillas');

class CorreoSMTP extends ServicioDeCorreo {
  #transporter;
  #remitente;

  constructor({ transporter, remitente }) {
    super();
    if (typeof transporter?.sendMail !== 'function') throw new Error('CorreoSMTP requiere transporter.sendMail');
    this.#transporter = transporter;
    this.#remitente = remitente;
  }

  // Para NODE_ENV=test o entornos sin SMTP: descarta los emails sin red
  static get transporterNulo() {
    return { sendMail: async () => ({ messageId: 'descartado' }) };
  }

  static transporterSMTP({ host, port, user, pass }) {
    return nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
  }

  #enviar(destinatario, { subject, html }) {
    if (!destinatario?.email) throw new Error('El destinatario no tiene email');
    return this.#transporter.sendMail({ from: this.#remitente, to: destinatario.email, subject, html });
  }

  // ticket: entidad Ticket; las plantillas trabajan con su instantánea
  async enviarTicketAsignado(tecnico, ticket) {
    await this.#enviar(tecnico, plantillas.ticketAsignado(tecnico, ticket.aInstantanea()));
  }

  async enviarTicketResuelto(usuario, ticket) {
    await this.#enviar(usuario, plantillas.ticketResuelto(usuario, ticket.aInstantanea()));
  }

  async enviarAlertaSLA(tecnico, ticket, porcentaje) {
    await this.#enviar(tecnico, plantillas.alertaSLA(tecnico, ticket.aInstantanea(), porcentaje));
  }
}

module.exports = CorreoSMTP;
