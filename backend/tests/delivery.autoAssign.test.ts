/**
 * Pure unit tests for `selectBestPartner` — no DB, no network, no env. The
 * algorithm is deterministic given a fixed candidate list + context, so we
 * assert on the concrete partner ID and eligibility rather than fuzzy
 * scoring internals.
 */
import { describe, expect, test } from 'vitest';

import {
  selectBestPartner,
  type AutoAssignContext,
  type PartnerCandidate,
} from '../src/modules/delivery/delivery.autoAssign.js';

// ── Fixture builders ────────────────────────────────────────────────

function partner(overrides: Partial<PartnerCandidate> & { id: string }): PartnerCandidate {
  return {
    isAvailable: true,
    currentLoad: 0,
    zonePincodes: ['500001'],
    lat: null,
    lng: null,
    ...overrides,
  };
}

function context(overrides: Partial<AutoAssignContext> = {}): AutoAssignContext {
  return {
    pincode: '500001',
    destination: null,
    express: false,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('delivery.autoAssign / selectBestPartner', () => {
  test('excludes partners whose zone does not cover the destination pincode', () => {
    const wrongZone = partner({ id: 'wrong-zone', zonePincodes: ['400001'] });
    const rightZone = partner({ id: 'right-zone', zonePincodes: ['500001'] });

    const best = selectBestPartner([wrongZone, rightZone], context());

    expect(best).not.toBeNull();
    expect(best!.partner.id).toBe('right-zone');
  });

  test('excludes partners who are unavailable', () => {
    const offline = partner({ id: 'offline', isAvailable: false });
    const online = partner({ id: 'online', isAvailable: true });

    const best = selectBestPartner([offline, online], context());

    expect(best).not.toBeNull();
    expect(best!.partner.id).toBe('online');
  });

  test('lower current load wins when all other factors are equal', () => {
    // Same availability, same zone, no destination coordinates → the score
    // difference is driven entirely by the workload term (lower is better).
    const busy = partner({ id: 'busy', currentLoad: 8 });
    const free = partner({ id: 'free', currentLoad: 1 });

    const best = selectBestPartner([busy, free], context());

    expect(best).not.toBeNull();
    expect(best!.partner.id).toBe('free');
  });

  test('returns null when no candidate is eligible', () => {
    const offline = partner({ id: 'offline', isAvailable: false });
    const wrongZone = partner({ id: 'wrong-zone', zonePincodes: ['999999'] });

    const best = selectBestPartner([offline, wrongZone], context());

    expect(best).toBeNull();
  });

  test('returns null on an empty candidate list', () => {
    expect(selectBestPartner([], context())).toBeNull();
  });
});
