const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const internalRoutes = require('./routes/internal');
const { errorHandler } = require('./middlewares/errorHandler');
const { rateLimiter } = require('./middlewares/rateLimiter');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// /internal va antes del rate limiter público: lo usa solo domain-service
app.use('/internal', internalRoutes);

app.use(rateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', servicio: 'authcore' }, message: 'OK' }));

app.use(errorHandler);

module.exports = app;
