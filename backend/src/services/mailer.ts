/**
 * Transactional email sender.
 *
 * Dev-safe: when SMTP credentials are missing (or `.env` hasn't been filled
 * in), we log a "would send" line instead of crashing. That lets the worker
 * process end-to-end order flows on a fresh clone without a live SMTP box.
 *
 * nodemailer is loaded through `createRequire` so this file still type-checks
 * before `npm install` pulls the package (matches the pdfkit pattern in
 * services/invoice.ts). The failure — if any — surfaces at first `sendMail`
 * call, not at import time.
 */
import { createRequire } from 'node:module';

import { logger } from '../lib/logger.js';

// ── Minimal nodemailer surface (only what we use) ──────────────────

interface SmtpAuth {
  user: string;
  pass: string;
}

interface TransportConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: SmtpAuth;
}

interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface Transporter {
  sendMail(options: SendMailOptions): Promise<{ messageId?: string }>;
}

interface NodemailerApi {
  createTransport(options: TransportConfig): Transporter;
}

const nodeRequire = createRequire(import.meta.url);

function loadNodemailer(): NodemailerApi {
  try {
    return nodeRequire('nodemailer') as NodemailerApi;
  } catch {
    throw new Error(
      'nodemailer is not installed. Run `npm install` in the backend workspace to enable email delivery.',
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_FROM = 'Elite NonVeg <no-reply@elitenonveg.com>';

interface CachedTransport {
  transporter: Transporter;
  from: string;
}

let cached: CachedTransport | null = null;

/**
 * Build (once) or return the cached SMTP transporter. Returns `null` when
 * required env vars are missing — the caller then falls back to the dev-safe
 * log path so the worker keeps flowing.
 */
function getTransport(): CachedTransport | null {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587) || 587;
  const from = process.env.SMTP_FROM ?? DEFAULT_FROM;

  const transporter = loadNodemailer().createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });

  cached = { transporter, from };
  return cached;
}

/**
 * Send one email. Errors are logged and swallowed — the notification worker
 * MUST NOT die because a single provider hiccuped; the IN_APP row is the
 * durable record.
 */
export async function sendMail(input: MailInput): Promise<void> {
  const t = getTransport();
  if (!t) {
    logger.info(
      { to: input.to, subject: input.subject },
      '[mailer:dev] SMTP not configured — skipping send',
    );
    return;
  }

  try {
    const info = await t.transporter.sendMail({
      from: t.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    logger.debug({ to: input.to, subject: input.subject, messageId: info.messageId }, 'email sent');
  } catch (err) {
    logger.error({ err, to: input.to, subject: input.subject }, 'email send failed');
  }
}
