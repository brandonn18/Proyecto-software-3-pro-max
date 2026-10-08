// Blacklist en memoria de tokens cerrados con logout.
// Solo la consulta authcore; domain-service valida la firma y confía en la
// expiración corta del JWT. En producción reemplazar por Redis con TTL = exp.
const _blacklist = new Set();

const add = (jti) => _blacklist.add(jti);
const has = (jti) => _blacklist.has(jti);

module.exports = { add, has };
