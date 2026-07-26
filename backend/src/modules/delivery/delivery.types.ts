/**
 * Module-local types for the delivery module. Cross-cutting DTOs
 * (DeliverySlotDTO, DeliveryAssignmentDTO) live in @elite/shared.
 */
import type { DeliveryStatus, OrderStatus } from '@elite/shared';

/** Public serviceability answer for a pincode. */
export interface ServiceabilityResult {
  serviceable: boolean;
  zone: string | null;
  feePaise: number;
}

/** Board filter for the dispatcher assignment view. */
export interface AssignmentBoardFilter {
  status?: DeliveryStatus;
  date?: Date;
}

/** One time window used when generating slots across a date range. */
export interface SlotWindowInput {
  label?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  cutoffMinutesBefore?: number;
}

/** Internal instruction describing an assignment status transition. */
export interface AssignmentTransition {
  toStatus: DeliveryStatus;
  orderStatus?: OrderStatus;
  patch?: {
    otpVerified?: boolean;
    pickedUpAt?: Date;
    deliveredAt?: Date;
    failReason?: string | null;
  };
  releasePartner?: boolean;
}
