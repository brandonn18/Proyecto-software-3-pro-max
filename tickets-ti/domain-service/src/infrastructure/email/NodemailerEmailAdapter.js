const nodemailer = require('nodemailer');
const { EmailPort } = require('../../application/ports');
const plantillas = require('./plantillas');

// El transporter se inyecta (DIP): en tests se pasa uno falso y nunca se
// envía un email real; en producción se crea con crearTransporterSMTP.
class NodemailerEmailAdapter extends EmailPort {
  constructor({ transporter, remitente }) {
    super();
    if (typeof transporter?.sendMail !== 'function') throw new Error('NodemailerEmailAdapter requiere transporter.sendMail');
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

module.exports = { NodemailerEmailAdapter, crearTransporterSMTP, transporterNulo };
