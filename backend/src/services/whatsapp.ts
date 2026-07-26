/**
 * Transactional WhatsApp sender.
 *
 * Shaped for Meta's Cloud API by default (`{ messaging_product, to, type,
 * text: { body } }`); most BSP gateways (Gupshup, Interakt, AiSensy, …)
 * accept a very similar body. Swap in the exact vendor payload when picking
 * one for real.
 *
 * Dev-safe: when WHATSAPP_API_URL or WHATSAPP_API_TOKEN is missing, log
 * a "would send" line instead of throwing. Errors are always logged and
 * swallowed so a single provider hiccup can't kill the notification worker.
 */
import { logger } from '../lib/logger.js';

export interface WhatsAppInput {
  /** E.164 phone number (`+91XXXXXXXXXX`) or WA-formatted `919XXXXXXXXX`. */
  to: string;
  /** Plain-text body. WhatsApp supports *bold*, _italic_, ```code```. */
  body: string;
}

interface ProviderConfig {
  apiUrl: string;
  apiToken: string;
}

function readConfig(): ProviderConfig | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  if (!apiUrl || !apiToken) return null;
  return { apiUrl, apiToken };
}

export async function sendWhatsApp(input: WhatsAppInput): Promise<void> {
  const cfg = readConfig();
  if (!cfg) {
    logger.info(
      { to: input.to, body: input.body },
      '[whatsapp:dev] WhatsApp provider not configured — skipping send',
    );
    return;
  }

  try {
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'text',
        text: { body: input.body },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>');
      logger.error({ to: input.to, status: res.status, body }, 'whatsapp provider returned error');
      return;
    }
    logger.debug({ to: input.to, status: res.status }, 'whatsapp sent');
  } catch (err) {
    logger.error({ err, to: input.to }, 'whatsapp send failed');
  }
}
