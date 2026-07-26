/**
 * Delivery controllers — (req,res) only. Read validated input, call the
 * service, respond with ok()/created(). No business logic, no Prisma.
 */
import type { Request, Response } from 'express';

import { ApiError } from '../../utils/ApiError.js';
import { created, ok } from '../../utils/http.js';

import * as service from './delivery.service.js';

/** req.user is guaranteed by requireAuth, but narrow it for the type checker. */
function actorId(req: Request): string {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}

// ── Public ──────────────────────────────────────────────────────────

export async function getServiceability(req: Request, res: Response) {
  const { pincode } = req.query as { pincode: string };
  return ok(res, await service.checkServiceability(pincode));
}

export async function getSlots(req: Request, res: Response) {
  const { date, pincode } = req.query as { date: string; pincode?: string };
  return ok(res, await service.getAvailableSlots(date, pincode));
}

// ── Zones (admin) ───────────────────────────────────────────────────

export async function listZones(_req: Request, res: Response) {
  return ok(res, await service.listZones());
}

export async function createZone(req: Request, res: Response) {
  return created(res, await service.createZone(req.body));
}

export async function updateZone(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.updateZone(id, req.body));
}

export async function deleteZone(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.deleteZone(id));
}

// ── Slots (admin) ───────────────────────────────────────────────────

export async function generateSlots(req: Request, res: Response) {
  return created(res, await service.generateSlots(req.body));
}

export async function updateSlot(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.updateSlot(id, req.body));
}

export async function deleteSlot(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.deleteSlot(id));
}

// ── Assignment board (dispatch) ─────────────────────────────────────

export async function getAssignments(req: Request, res: Response) {
  const { status, date } = req.query as { status?: string; date?: string };
  return ok(
    res,
    await service.getAssignmentBoard({
      status: status as never,
      date: date ? new Date(`${date}T00:00:00.000Z`) : undefined,
    }),
  );
}

export async function assignManually(req: Request, res: Response) {
  const { orderId } = req.params as { orderId: string };
  const { partnerId } = req.body as { partnerId: string };
  return created(res, await service.assignManually(orderId, partnerId, actorId(req)));
}

export async function autoAssign(req: Request, res: Response) {
  const { orderId } = req.params as { orderId: string };
  const { express } = req.body as { express: boolean };
  return created(res, await service.autoAssign(orderId, express, actorId(req)));
}

// ── Partner app ─────────────────────────────────────────────────────

export async function getMyAssignments(req: Request, res: Response) {
  return ok(res, await service.getMyAssignments(actorId(req)));
}

export async function acceptAssignment(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.acceptAssignment(actorId(req), id));
}

export async function pickupAssignment(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.pickupAssignment(actorId(req), id));
}

export async function outForDelivery(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.outForDelivery(actorId(req), id));
}

export async function verifyOtp(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { otp } = req.body as { otp: string };
  return ok(res, await service.verifyOtp(actorId(req), id, otp));
}

export async function failDelivery(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { reason } = req.body as { reason: string };
  return ok(res, await service.failDelivery(actorId(req), id, reason));
}

export async function returnToStore(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  return ok(res, await service.returnToStore(actorId(req), id));
}
