/**
 * Pure unit tests for the order state-machine — no DB, no network, no env.
 * Safe to run in any environment (no DATABASE_URL_TEST required).
 */
import { ORDER_STATUS } from '@elite/shared';
import { describe, expect, test } from 'vitest';

import { canTransition } from '../src/modules/order/order.stateMachine.js';

describe('order state machine — happy path', () => {
  test('walks the full lifecycle CREATED → CONFIRMED → … → DELIVERED', () => {
    const flow = [
      ORDER_STATUS.CREATED,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.PACKING,
      ORDER_STATUS.READY,
      ORDER_STATUS.ASSIGNED,
      ORDER_STATUS.PICKED_UP,
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.DELIVERED,
    ] as const;

    for (let i = 0; i < flow.length - 1; i++) {
      expect(canTransition(flow[i], flow[i + 1])).toBe(true);
    }
  });
});

describe('order state machine — forbidden transitions', () => {
  test('CREATED cannot skip straight to DELIVERED', () => {
    expect(canTransition(ORDER_STATUS.CREATED, ORDER_STATUS.DELIVERED)).toBe(false);
  });

  test('CREATED cannot skip fulfilment (→ PACKING, → READY)', () => {
    expect(canTransition(ORDER_STATUS.CREATED, ORDER_STATUS.PACKING)).toBe(false);
    expect(canTransition(ORDER_STATUS.CREATED, ORDER_STATUS.READY)).toBe(false);
  });

  test('an identity transition is rejected', () => {
    expect(canTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.CONFIRMED)).toBe(false);
    expect(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERED)).toBe(false);
  });

  test('DELIVERED may only go to RETURNED, not backwards or to CANCELLED', () => {
    expect(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED)).toBe(true);
    expect(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED)).toBe(false);
    expect(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.OUT_FOR_DELIVERY)).toBe(false);
  });
});

describe('order state machine — CANCELLED off-ramp', () => {
  test('CANCELLED is reachable from CREATED (customer self-cancel)', () => {
    expect(canTransition(ORDER_STATUS.CREATED, ORDER_STATUS.CANCELLED)).toBe(true);
  });

  test('CANCELLED is NOT reachable from DELIVERED (past the point of no return)', () => {
    expect(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED)).toBe(false);
  });

  test('CANCELLED is terminal — no outgoing transitions', () => {
    expect(canTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.CREATED)).toBe(false);
    expect(canTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.CONFIRMED)).toBe(false);
    expect(canTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED)).toBe(false);
  });
});
