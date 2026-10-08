const { Ticket, CAMPOS_EDITABLES } = require('./Ticket');
const catalogos = require('./catalogos');
const errores = require('./errores');
const idTicket = require('./idTicket');
const politicaSLA = require('./politicaSLA');
const politicaAsignacion = require('./politicaAsignacion');
const politicaAcceso = require('./politicaAcceso');

module.exports = {
  Ticket, CAMPOS_EDITABLES, catalogos, errores, idTicket, politicaSLA, politicaAsignacion, politicaAcceso,
};
