const crypto = require('crypto');
const { internalKey } = require('../config/auth');

const HEADER = 'x-internal-key';

// Comparación en tiempo constante para no filtrar la clave por timing
const _coincide = (recibida) => {
  const a = Buffer.from(String(recibida));
  const b = Buffer.from(internalKey);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Protege /internal/*: solo domain-service conoce AUTHCORE_INTERNAL_KEY.
const requireInternalKey = (req, res, next) => {
  const recibida = req.get(HEADER);
  if (!recibida || !_coincide(recibida)) {
    return res.status(401).json({ success: false, message: 'Clave interna inválida' });
  }
  next();
};

module.exports = { requireInternalKey, HEADER };
