/**
 * Delivery repository — the ONLY place Prisma is touched for this module.
 * Returns plain Prisma entities; the service maps them to shared DTOs.
 *
 * NOTE(integration): order-status writes (Order.status + OrderStatusHistory)
 * are done inline here for now. When order.service lands, these transactions
 * should call into it so status transitions have a single owner.
 */
import { DELIVERY_STATUS, ORDER_STATUS } from '@elite/shared';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

import type { AssignmentBoardFilter } from './delivery.types.js';

const assignmentInclude = {
  order: { select: { id: true, code: true } },
  partner: { include: { user: { select: { id: true, name: true } } } },
} satisfies Prisma.DeliveryAssignmentInclude;

// ── Zones ───────────────────────────────────────────────────────────

export function findZoneByPincode(pincode: string) {
  return prisma.deliveryZone.findFirst({
    where: { isActive: true, pincodes: { has: pincode } },
  });
}

export function listZones() {
  return prisma.deliveryZone.findMany({ orderBy: { name: 'asc' } });
}

export function findZoneById(id: string) {
  return prisma.deliveryZone.findUnique({ where: { id } });
}

export function createZone(data: Prisma.DeliveryZoneCreateInput) {
  return prisma.deliveryZone.create({ data });
}

export function updateZone(id: string, data: Prisma.DeliveryZoneUpdateInput) {
  return prisma.deliveryZone.update({ where: { id }, data });
}

export function deleteZone(id: string) {
  return prisma.deliveryZone.delete({ where: { id } });
}

// ── Slots ───────────────────────────────────────────────────────────

/** Slots for a given calendar day, optionally constrained to a zone. */
export function findSlotsForDate(dayStart: Date, dayEnd: Date, zoneId?: string) {
  return prisma.deliverySlot.findMany({
    where: {
      isActive: true,
      date: { gte: dayStart, lt: dayEnd },
      ...(zoneId ? { zoneId } : {}),
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}

export function findSlotById(id: string) {
  return prisma.deliverySlot.findUnique({ where: { id } });
}

export function createSlots(rows: Prisma.DeliverySlotCreateManyInput[]) {
  return prisma.deliverySlot.createMany({ data: rows });
}

export function updateSlot(id: string, data: Prisma.DeliverySlotUpdateInput) {
  return prisma.deliverySlot.update({ where: { id }, data });
}

export function deleteSlot(id: string) {
  return prisma.deliverySlot.delete({ where: { id } });
}

/**
 * Atomically reserve one seat on a slot. Returns a discriminated result so the
 * service can raise the right ApiError without leaking Prisma details.
 */
export function reserveSlotSeat(slotId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const slot = await tx.deliverySlot.findUnique({ where: { id: slotId } });
    if (!slot) return { ok: false as const, reason: 'NOT_FOUND' as const };
    if (!slot.isActive || slot.cutoffAt <= now || slot.booked >= slot.capacity) {
      return { ok: false as const, reason: 'UNAVAILABLE' as const };
    }
    const updated = await tx.deliverySlot.update({
      where: { id: slotId },
      data: { booked: { increment: 1 } },
    });
    return { ok: true as const, slot: updated };
  });
}

// ── Partners ────────────────────────────────────────────────────────

export function findAvailablePartners() {
  return prisma.deliveryPartnerProfile.findMany({ where: { isAvailable: true } });
}

export function findPartnerById(id: string) {
  return prisma.deliveryPartnerProfile.findUnique({ where: { id } });
}

export function findPartnerByUserId(userId: string) {
  return prisma.deliveryPartnerProfile.findUnique({ where: { userId } });
}

// ── Orders (read) ───────────────────────────────────────────────────

export function findOrderWithAddress(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { address: true },
  });
}

// ── Assignments ─────────────────────────────────────────────────────

export function listAssignments(filter: AssignmentBoardFilter) {
  const where: Prisma.DeliveryAssignmentWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.date) {
    const start = new Date(filter.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.assignedAt = { gte: start, lt: end };
  }
  return prisma.deliveryAssignment.findMany({
    where,
    include: assignmentInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export function findAssignmentById(id: string) {
  return prisma.deliveryAssignment.findUnique({ where: { id }, include: assignmentInclude });
}

export function findAssignmentsByPartner(partnerId: string) {
  return prisma.deliveryAssignment.findMany({
    where: { partnerId },
    include: assignmentInclude,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create/refresh an assignment and move the order to ASSIGNED, atomically:
 * upsert assignment (ASSIGNED + otp), write order status + history, bump load.
 */
export function applyAssignment(input: {
  orderId: string;
  partnerId: string;
  otpCode: string;
  actorId?: string;
}) {
  const { orderId, partnerId, otpCode, actorId } = input;
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.deliveryAssignment.upsert({
      where: { orderId },
      create: {
        orderId,
        partnerId,
        status: DELIVERY_STATUS.ASSIGNED,
        otpCode,
        assignedAt: new Date(),
      },
      update: {
        partnerId,
        status: DELIVERY_STATUS.ASSIGNED,
        otpCode,
        otpVerified: false,
        failReason: null,
        assignedAt: new Date(),
      },
      include: assignmentInclude,
    });

    // TODO(integration): delegate to order.service once it exists.
    await tx.order.update({ where: { id: orderId }, data: { status: ORDER_STATUS.ASSIGNED } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: ORDER_STATUS.ASSIGNED,
        changedBy: actorId,
        note: 'Assigned to delivery partner',
      },
    });
    await tx.deliveryPartnerProfile.update({
      where: { id: partnerId },
      data: { currentLoad: { increment: 1 } },
    });

    return assignment;
  });
}

/**
 * Advance an existing assignment through the fulfilment lifecycle, optionally
 * mirroring an Order status + history row and releasing partner load.
 */
export function advanceAssignment(input: {
  assignmentId: string;
  toStatus: DELIVERY_STATUS_VALUE;
  orderStatus?: ORDER_STATUS_VALUE;
  actorId?: string;
  patch?: Prisma.DeliveryAssignmentUpdateInput;
  releasePartner?: boolean;
}) {
  const { assignmentId, toStatus, orderStatus, actorId, patch, releasePartner } = input;
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: toStatus, ...patch },
      include: assignmentInclude,
    });

    if (orderStatus) {
      // TODO(integration): delegate to order.service once it exists.
      await tx.order.update({ where: { id: assignment.orderId }, data: { status: orderStatus } });
      await tx.orderStatusHistory.create({
        data: { orderId: assignment.orderId, status: orderStatus, changedBy: actorId },
      });
    }

    if (releasePartner && assignment.partnerId) {
      await tx.deliveryPartnerProfile.update({
        where: { id: assignment.partnerId },
        data: { currentLoad: { decrement: 1 } },
      });
    }

    return assignment;
  });
}

// Local aliases so callers pass shared-enum values without importing Prisma enums.
type DELIVERY_STATUS_VALUE = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];
type ORDER_STATUS_VALUE = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export type AssignmentWithRelations = Prisma.DeliveryAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;
