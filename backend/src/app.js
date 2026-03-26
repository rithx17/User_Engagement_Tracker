import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import devRoutes from './routes/devRoutes.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';

export const app = express();

app.use(helmet());

const allowedOrigins = new Set([
  env.clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools and same-origin requests with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.nodeEnv === 'development' ? 10000 : 1000,
    skip: (req) => req.path === '/health'
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
if (env.nodeEnv !== 'production') {
  app.use('/api/dev', devRoutes);
}

app.use(notFound);
app.use(errorHandler);
