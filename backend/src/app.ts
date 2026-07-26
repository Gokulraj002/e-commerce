import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { helmetOptions, strictCors } from './config/security.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { requestId } from './middlewares/requestId.js';
import { stripEmpty } from './middlewares/sanitize.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(requestId);
  // Some transitive deps ship Express-5 middleware types; a couple of the
  // hardening middlewares below need a narrow cast so the overload resolves.
  app.use(helmet(helmetOptions) as RequestHandler);
  app.use(cors(strictCors(env)));
  app.use(
    express.json({
      limit: '1mb',
      // Capture the exact raw bytes so gateway webhook signatures can be
      // verified against the untouched payload (see payment.controller.webhook).
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }) as RequestHandler,
  );
  app.use(stripEmpty);
  app.use(express.urlencoded({ extended: true }) as RequestHandler);
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Global soft rate limit (per-route stricter limits live in modules).
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // TODO(rate-limit): mount the authenticated `writeLimiter` at the router
  // layer (see routes/limits.ts) rather than globally here — `req.user` is only
  // populated after each router's `requireAuth` middleware runs, so a global
  // mount would always fall back to IP-keying and defeat per-user granularity.

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
