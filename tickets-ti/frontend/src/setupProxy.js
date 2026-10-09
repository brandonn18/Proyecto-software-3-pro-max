// Proxy del servidor de desarrollo de React (npm start). Reemplaza al
// "proxy" único de package.json: ahora hay dos servicios.
// En producción este archivo no se usa; enruta nginx (nginx/nginx.conf).
const { createProxyMiddleware } = require('http-proxy-middleware');

const AUTHCORE = process.env.AUTHCORE_DEV_URL || 'http://localhost:3002';
const DOMAIN = process.env.DOMAIN_DEV_URL || 'http://localhost:3003';

module.exports = (app) => {
  app.use(['/api/auth', '/api/users'], createProxyMiddleware({ target: AUTHCORE, changeOrigin: true }));
  app.use(['/api', '/socket.io'], createProxyMiddleware({ target: DOMAIN, changeOrigin: true, ws: true }));
};
