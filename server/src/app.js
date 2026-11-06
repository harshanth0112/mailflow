import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mongoSanitize } from './middleware/mongoSanitize.js';

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", env.CLIENT_URL || '*'],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cookie parser for secure refresh token handling
app.use(cookieParser());

// CORS Configuration
const allowedOrigins =
  env.NODE_ENV === 'production'
    ? [env.CLIENT_URL]
    : [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id', 'x-idempotency-key'],
  })
);

// Logging
if (env.NODE_ENV !== 'test') {
  morgan.token('path', (req) => req.path);
  app.use(
    morgan(
      env.NODE_ENV === 'development'
        ? 'dev'
        : ':method :path :status :response-time ms'
    )
  );
}

// Body parsers with payload limit protection
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL injection protection
app.use(mongoSanitize);

// API versioning prefix: /api/v1
app.use('/api/v1', apiRoutes);

// Fallback handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
