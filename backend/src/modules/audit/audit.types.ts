/** Module-local DTOs for the audit log. */

export interface AuditActorDTO {
  id: string;
  name: string;
  email: string | null;
}

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  changes: unknown;
  ip: string | null;
  createdAt: string;
  actor: AuditActorDTO | null;
}
