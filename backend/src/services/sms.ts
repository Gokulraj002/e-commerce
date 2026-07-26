/**
 * Transactional SMS sender.
 *
 * Provider-agnostic: fires a JSON POST at whatever endpoint SMS_API_URL
 * points to (Msg91, Textlocal, Kaleyra, an internal gateway, …) with a
 * Bearer token from SMS_API_KEY. The exact payload shape is intentionally
 * generic — most Indian SMS providers accept { to, message, sender }; swap
 * this out for their SDK when picking a vendor for real.
 *
 * Dev-safe: when SMS_API_URL or SMS_API_KEY is missing, log a "would send"
 * line instead of throwing. The IN_APP notification row is still written
 * by the worker regardless.
 */
import { logger } from '../lib/logger.js';

export interface SmsInput {
  /** E.164 phone number (`+91XXXXXXXXXX`). */
  to: string;
  /** Plain-text body — keep under ~160 chars to fit a single segment. */
  body: string;
}

interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  senderId: string;
}

/** Read env once per call — cheap, and lets tests mutate process.env freely. */
function readConfig(): ProviderConfig | null {
  const apiUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl, apiKey, senderId: process.env.SMS_SENDER_ID ?? 'ELTNVG' };
}

export async function sendSms(input: SmsInput): Promise<void> {
  const cfg = readConfig();
  if (!cfg) {
    logger.info({ to: input.to, body: input.body }, '[sms:dev] SMS provider not configured — skipping send');
    return;
  }

  try {
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        to: input.to,
        message: input.body,
        sender: cfg.senderId,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>');
      logger.error({ to: input.to, status: res.status, body }, 'sms provider returned error');
      return;
    }
    logger.debug({ to: input.to, status: res.status }, 'sms sent');
  } catch (err) {
    logger.error({ err, to: input.to }, 'sms send failed');
  }
}
