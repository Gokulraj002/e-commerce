/**
 * Delivery service — business logic. Throws ApiError, orchestrates the
 * repository + auto-assign algorithm, and maps entities to shared DTOs.
 * Never touches Prisma directly (see delivery.repository.ts).
 */
import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  type DeliveryAssignmentDTO,
  type DeliverySlotDTO,
} from '@elite/shared';

import { logger } from '../../lib/logger.js';
import { getQueue, QUEUES } from '../../lib/queue.js';
import { ApiError } from '../../utils/ApiError.js';

import { selectBestPartner, type PartnerCandidate } from './delivery.autoAssign.js';
import * as repo from './delivery.repository.js';
import type { AssignmentWithRelations } from './delivery.repository.js';
import type {
  AssignmentBoardFilter,
  ServiceabilityResult,
  SlotWindowInput,
} from './delivery.types.js';
import { toGeoPoint } from './haversine.js';

const MAX_SLOT_RANGE_DAYS = 60;
const DEFAULT_SLOT_CAPACITY = 50;
const DEFAULT_CUTOFF_MINUTES = 120;

// Slot type as returned by the repository (Prisma DeliverySlot).
type SlotEntity = NonNullable<Awaited<ReturnType<typeof repo.findSlotById>>>;

// ── DTO mappers ─────────────────────────────────────────────────────

function isSlotAvailable(slot: SlotEntity, now = new Date()): boolean {
  return slot.isActive && slot.booked < slot.capacity && now < slot.cutoffAt;
}

function toSlotDTO(slot: SlotEntity): DeliverySlotDTO {
  return {
    id: slot.id,
    label: slot.label,
    date: slot.date.toISOString(),
    startTime: slot.startTime,
    endTime: slot.endTime,
    available: isSlotAvailable(slot),
    cutoffAt: slot.cutoffAt.toISOString(),
  };
}

function toAssignmentDTO(a: AssignmentWithRelations): DeliveryAssignmentDTO {
  return {
    id: a.id,
    orderCode: a.order.code,
    status: a.status,
    partnerName: a.partner?.user.name ?? null,
    otpVerified: a.otpVerified,
    assignedAt: a.assignedAt ? a.assignedAt.toISOString() : null,
  };
}

// ── Serviceability & slots (public) ─────────────────────────────────

export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const zone = await repo.findZoneByPincode(pincode);
  if (!zone) return { serviceable: false, zone: null, feePaise: 0 };
  return { serviceable: true, zone: zone.name, feePaise: zone.feePaise };
}

export async function getAvailableSlots(
  date: string,
  pincode?: string,
): Promise<DeliverySlotDTO[]> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  let zoneId: string | undefined;
  if (pincode) {
    const zone = await repo.findZoneByPincode(pincode);
    if (!zone) return []; // pincode not serviceable → no slots
    zoneId = zone.id;
  }

  const slots = await repo.findSlotsForDate(dayStart, dayEnd, zoneId);
  return slots.filter((s) => isSlotAvailable(s)).map(toSlotDTO);
}

/**
 * Reserve a seat on a slot (increment booked). Exported for the checkout flow.
 * Atomic + capacity/cutoff-safe. Throws when the slot is missing or full.
 */
export async function reserveSlot(slotId: string): Promise<DeliverySlotDTO> {
  const result = await repo.reserveSlotSeat(slotId, new Date());
  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') throw ApiError.notFound('Delivery slot not found');
    throw ApiError.conflict('Delivery slot is full or past its cutoff');
  }
  return toSlotDTO(result.slot);
}

// ── Zones (admin) ───────────────────────────────────────────────────

export async function listZones() {
  return repo.listZones();
}

export async function createZone(data: {
  name: string;
  pincodes: string[];
  feePaise: number;
  isActive: boolean;
}) {
  return repo.createZone(data);
}

export async function updateZone(
  id: string,
  data: Partial<{ name: string; pincodes: string[]; feePaise: number; isActive: boolean }>,
) {
  const zone = await repo.findZoneById(id);
  if (!zone) throw ApiError.notFound('Delivery zone not found');
  return repo.updateZone(id, data);
}

export async function deleteZone(id: string) {
  const zone = await repo.findZoneById(id);
  if (!zone) throw ApiError.notFound('Delivery zone not found');
  await repo.deleteZone(id);
  return { id };
}

// ── Slots (admin) ───────────────────────────────────────────────────

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Invalid date range');
  }
  if (end < start) throw ApiError.badRequest('endDate must not precede startDate');

  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
    if (days.length > MAX_SLOT_RANGE_DAYS) {
      throw ApiError.badRequest(`Date range exceeds ${MAX_SLOT_RANGE_DAYS} days`);
    }
  }
  return days;
}

export async function generateSlots(input: {
  zoneId?: string;
  startDate: string;
  endDate: string;
  windows: SlotWindowInput[];
}) {
  if (input.zoneId) {
    const zone = await repo.findZoneById(input.zoneId);
    if (!zone) throw ApiError.notFound('Delivery zone not found');
  }

  const days = enumerateDates(input.startDate, input.endDate);
  const rows = days.flatMap((dateStr) =>
    input.windows.map((w) => {
      const cutoffMinutes = w.cutoffMinutesBefore ?? DEFAULT_CUTOFF_MINUTES;
      const start = new Date(`${dateStr}T${w.startTime}:00.000Z`);
      const cutoffAt = new Date(start.getTime() - cutoffMinutes * 60_000);
      return {
        zoneId: input.zoneId ?? null,
        label: w.label ?? `${w.startTime}-${w.endTime}`,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        startTime: w.startTime,
        endTime: w.endTime,
        capacity: w.capacity ?? DEFAULT_SLOT_CAPACITY,
        cutoffAt,
      };
    }),
  );

  const { count } = await repo.createSlots(rows);
  return { created: count };
}

export async function updateSlot(
  id: string,
  data: Partial<{ label: string; capacity: number; cutoffAt: string; isActive: boolean }>,
) {
  const slot = await repo.findSlotById(id);
  if (!slot) throw ApiError.notFound('Delivery slot not found');
  const patch = {
    ...('label' in data ? { label: data.label } : {}),
    ...('capacity' in data ? { capacity: data.capacity } : {}),
    ...('isActive' in data ? { isActive: data.isActive } : {}),
    ...(data.cutoffAt ? { cutoffAt: new Date(data.cutoffAt) } : {}),
  };
  const updated = await repo.updateSlot(id, patch);
  return toSlotDTO(updated);
}

export async function deleteSlot(id: string) {
  const slot = await repo.findSlotById(id);
  if (!slot) throw ApiError.notFound('Delivery slot not found');
  await repo.deleteSlot(id);
  return { id };
}

// ── Assignment board (dispatch) ─────────────────────────────────────

export async function getAssignmentBoard(
  filter: AssignmentBoardFilter,
): Promise<DeliveryAssignmentDTO[]> {
  const assignments = await repo.listAssignments(filter);
  return assignments.map(toAssignmentDTO);
}

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function enqueueAssignmentNotification(assignment: AssignmentWithRelations): Promise<void> {
  try {
    await getQueue(QUEUES.NOTIFICATIONS).add('delivery.assigned', {
      orderId: assignment.orderId,
      orderCode: assignment.order.code,
      partnerId: assignment.partnerId,
      partnerUserId: assignment.partner?.userId ?? null,
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to enqueue delivery assignment notification');
  }
}

export async function assignManually(
  orderId: string,
  partnerId: string,
  actorId?: string,
): Promise<DeliveryAssignmentDTO> {
  const order = await repo.findOrderWithAddress(orderId);
  if (!order) throw ApiError.notFound('Order not found');

  const partner = await repo.findPartnerById(partnerId);
  if (!partner) throw ApiError.notFound('Delivery partner not found');
  if (!partner.zonePincodes.includes(order.address.pincode)) {
    throw ApiError.badRequest('Partner does not serve the delivery pincode');
  }

  const assignment = await repo.applyAssignment({
    orderId,
    partnerId,
    otpCode: generateOtp(),
    actorId,
  });
  await enqueueAssignmentNotification(assignment);
  return toAssignmentDTO(assignment);
}

export async function autoAssign(
  orderId: string,
  express: boolean,
  actorId?: string,
): Promise<DeliveryAssignmentDTO> {
  const order = await repo.findOrderWithAddress(orderId);
  if (!order) throw ApiError.notFound('Order not found');

  const partners = await repo.findAvailablePartners();
  const candidates: PartnerCandidate[] = partners.map((p) => ({
    id: p.id,
    isAvailable: p.isAvailable,
    currentLoad: p.currentLoad,
    zonePincodes: p.zonePincodes,
    lat: p.lat,
    lng: p.lng,
  }));

  const best = selectBestPartner(candidates, {
    pincode: order.address.pincode,
    destination: toGeoPoint(order.address.lat, order.address.lng),
    express,
  });
  if (!best) throw ApiError.conflict('No available delivery partner for this pincode');

  const assignment = await repo.applyAssignment({
    orderId,
    partnerId: best.partner.id,
    otpCode: generateOtp(),
    actorId,
  });
  await enqueueAssignmentNotification(assignment);
  return toAssignmentDTO(assignment);
}

// ── Partner app ─────────────────────────────────────────────────────

const TERMINAL_STATUSES: string[] = [
  DELIVERY_STATUS.DELIVERED,
  DELIVERY_STATUS.RETURNED_TO_STORE,
];

async function loadOwnedAssignment(
  userId: string,
  assignmentId: string,
): Promise<AssignmentWithRelations> {
  const profile = await repo.findPartnerByUserId(userId);
  if (!profile) throw ApiError.forbidden('Not a delivery partner');
  const assignment = await repo.findAssignmentById(assignmentId);
  if (!assignment) throw ApiError.notFound('Assignment not found');
  if (assignment.partnerId !== profile.id) throw ApiError.forbidden('Assignment not yours');
  return assignment;
}

export async function getMyAssignments(userId: string): Promise<DeliveryAssignmentDTO[]> {
  const profile = await repo.findPartnerByUserId(userId);
  if (!profile) throw ApiError.forbidden('Not a delivery partner');
  const assignments = await repo.findAssignmentsByPartner(profile.id);
  return assignments.map(toAssignmentDTO);
}

export async function acceptAssignment(
  userId: string,
  assignmentId: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (assignment.status !== DELIVERY_STATUS.ASSIGNED) {
    throw ApiError.conflict('Assignment cannot be accepted in its current state');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.ACCEPTED,
    actorId: userId,
  });
  return toAssignmentDTO(updated);
}

export async function pickupAssignment(
  userId: string,
  assignmentId: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (TERMINAL_STATUSES.includes(assignment.status)) {
    throw ApiError.conflict('Assignment already completed');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.PICKED_UP,
    orderStatus: ORDER_STATUS.PICKED_UP,
    actorId: userId,
    patch: { pickedUpAt: new Date() },
  });
  return toAssignmentDTO(updated);
}

export async function outForDelivery(
  userId: string,
  assignmentId: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (TERMINAL_STATUSES.includes(assignment.status)) {
    throw ApiError.conflict('Assignment already completed');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.OUT_FOR_DELIVERY,
    orderStatus: ORDER_STATUS.OUT_FOR_DELIVERY,
    actorId: userId,
  });
  return toAssignmentDTO(updated);
}

export async function verifyOtp(
  userId: string,
  assignmentId: string,
  otp: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (TERMINAL_STATUSES.includes(assignment.status)) {
    throw ApiError.conflict('Assignment already completed');
  }
  if (!assignment.otpCode || assignment.otpCode !== otp) {
    throw ApiError.badRequest('Invalid delivery OTP');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.DELIVERED,
    orderStatus: ORDER_STATUS.DELIVERED,
    actorId: userId,
    patch: { otpVerified: true, deliveredAt: new Date() },
    releasePartner: true,
  });
  return toAssignmentDTO(updated);
}

export async function failDelivery(
  userId: string,
  assignmentId: string,
  reason: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (TERMINAL_STATUSES.includes(assignment.status)) {
    throw ApiError.conflict('Assignment already completed');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.FAILED,
    orderStatus: ORDER_STATUS.FAILED_DELIVERY,
    actorId: userId,
    patch: { failReason: reason },
    releasePartner: true,
  });
  return toAssignmentDTO(updated);
}

export async function returnToStore(
  userId: string,
  assignmentId: string,
): Promise<DeliveryAssignmentDTO> {
  const assignment = await loadOwnedAssignment(userId, assignmentId);
  if (assignment.status === DELIVERY_STATUS.RETURNED_TO_STORE) {
    throw ApiError.conflict('Assignment already returned to store');
  }
  const updated = await repo.advanceAssignment({
    assignmentId,
    toStatus: DELIVERY_STATUS.RETURNED_TO_STORE,
    orderStatus: ORDER_STATUS.RETURNED,
    actorId: userId,
  });
  return toAssignmentDTO(updated);
}
