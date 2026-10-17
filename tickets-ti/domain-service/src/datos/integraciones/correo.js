// Capa de DATOS (servicio externo): envío de emails por SMTP. El transporter
// se recibe para que los tests pasen uno falso y nunca se envíe un email real.
const nodemailer = require('nodemailer');
const plantillas = require('./plantillas');

class CorreoSMTP {
  constructor({ transporter, remitente }) {
    if (typeof transporter?.sendMail !== 'function') throw new Error('CorreoSMTP requiere transporter.sendMail');
    this.transporter = transporter;
    this.remitente = remitente;
  }

  _enviar(destinatario, { subject, html }) {
    if (!destinatario?.email) throw new Error('El destinatario no tiene email');
    return this.transporter.sendMail({ from: this.remitente, to: destinatario.email, subject, html });
  }

  async enviarTicketAsignado(tecnico, ticket) {
    await this._enviar(tecnico, plantillas.ticketAsignado(tecnico, ticket));
  }

  async enviarTicketResuelto(usuario, ticket) {
    await this._enviar(usuario, plantillas.ticketResuelto(usuario, ticket));
  }

  async enviarAlertaSLA(tecnico, ticket, porcentaje) {
    await this._enviar(tecnico, plantillas.alertaSLA(tecnico, ticket, porcentaje));
  }
}

const crearTransporterSMTP = ({ host, port, user, pass }) =>
  nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });

// Para NODE_ENV=test o entornos sin SMTP: descarta los emails sin red
const transporterNulo = { sendMail: async () => ({ messageId: 'descartado' }) };

module.exports = { CorreoSMTP, crearTransporterSMTP, transporterNulo };
