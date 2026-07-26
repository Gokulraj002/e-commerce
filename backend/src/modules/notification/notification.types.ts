/** Module-local DTOs + input shapes for notifications. */

export interface NotificationDTO {
  id: string;
  channel: string;
  title: string;
  body: string;
  isRead: boolean;
  meta: unknown;
  createdAt: string;
}

/**
 * Payload for `notify()`. Deliberately plain (no Express/req coupling) so it is
 * safe to call from a BullMQ worker or any background job.
 */
export interface NotifyInput {
  userId: string;
  channel?: string; // EMAIL / SMS / WHATSAPP / PUSH / IN_APP — defaults to IN_APP
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}
