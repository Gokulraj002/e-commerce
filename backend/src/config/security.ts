import type { HelmetOptions } from 'helmet';

import type { env as envConfig } from './env.js';

type Env = typeof envConfig;

/**
 * Options passed to the `cors` middleware. Structurally compatible with
 * `cors.CorsOptions` — declared inline to avoid namespace/`export =` import
 * gymnastics with @types/cors.
 */
export interface StrictCorsOptions {
  origin: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

/**
 * Strict Content-Security-Policy for a pure-JSON API. Nothing here should ever
 * render HTML, load fonts, or embed frames — deny everything at the root and
 * lock down base-uri / frame-ancestors so an injected `<base>` or clickjacking
 * frame can't do anything even if a JSON error message ever gets rendered as
 * HTML by an errant client.
 */
export const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
};

/**
 * Strict CORS: exact whitelist from env.corsOrigins (no wildcards, no reflected
 * origins), credentials on for cookie-based auth flows, and only the verbs and
 * headers the API actually consumes.
 */
export function strictCors(env: Env): StrictCorsOptions {
  return {
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
}
