/**
 * Weighted scoring auto-assignment algorithm.
 *
 * Pure & side-effect free: it takes a snapshot of candidate partners plus the
 * delivery context and returns the best-scored partner. All I/O (fetching
 * partners, persisting the assignment) is the service's job — this file only
 * decides *who*. Higher score = better partner.
 */
import { haversineKm, type GeoPoint } from './haversine.js';

/** Snapshot of a delivery partner used for scoring. */
export interface PartnerCandidate {
  id: string;
  isAvailable: boolean;
  currentLoad: number;
  zonePincodes: string[];
  lat: number | null;
  lng: number | null;
}

/** Context describing the order being assigned. */
export interface AutoAssignContext {
  pincode: string;
  destination: GeoPoint | null; // delivery address coords, if known
  express: boolean; // priority / express order
  maxLoad?: number; // hard cap on concurrent deliveries per partner
}

export interface ScoreBreakdown {
  availability: number;
  workload: number;
  distance: number;
}

export interface ScoredPartner {
  partner: PartnerCandidate;
  score: number;
  distanceKm: number | null;
  breakdown: ScoreBreakdown;
}

/** Default concurrent-delivery ceiling used when the caller omits maxLoad. */
export const DEFAULT_MAX_LOAD = 15;

/** Baseline weights; express orders bias harder toward proximity. */
export const AUTO_ASSIGN_WEIGHTS = {
  standard: { availability: 0.2, workload: 0.4, distance: 0.4 },
  express: { availability: 0.15, workload: 0.3, distance: 0.55 },
} as const;

/** Hard filter: a partner must be available and cover the destination pincode. */
function isEligible(partner: PartnerCandidate, context: AutoAssignContext): boolean {
  const maxLoad = context.maxLoad ?? DEFAULT_MAX_LOAD;
  return (
    partner.isAvailable &&
    partner.currentLoad < maxLoad &&
    partner.zonePincodes.includes(context.pincode)
  );
}

/** Score a single eligible candidate into [0, 1]. */
function scoreOne(partner: PartnerCandidate, context: AutoAssignContext): ScoredPartner {
  const weights = context.express ? AUTO_ASSIGN_WEIGHTS.express : AUTO_ASSIGN_WEIGHTS.standard;
  const maxLoad = context.maxLoad ?? DEFAULT_MAX_LOAD;

  // Availability is 1 for eligible partners; kept explicit for transparency.
  const availability = partner.isAvailable ? 1 : 0;

  // Lower load is better; linear falloff toward the ceiling.
  const workload = Math.max(0, (maxLoad - partner.currentLoad) / maxLoad);

  // Lower distance is better. Neutral 0.5 when coordinates are unknown so a
  // geo-less partner is neither rewarded nor punished.
  let distanceKm: number | null = null;
  let distance = 0.5;
  if (context.destination && partner.lat !== null && partner.lng !== null) {
    distanceKm = haversineKm(context.destination, { lat: partner.lat, lng: partner.lng });
    distance = 1 / (1 + distanceKm);
  }

  const score =
    weights.availability * availability +
    weights.workload * workload +
    weights.distance * distance;

  return { partner, score, distanceKm, breakdown: { availability, workload, distance } };
}

/** Score every eligible partner, best first. */
export function scorePartners(
  candidates: PartnerCandidate[],
  context: AutoAssignContext,
): ScoredPartner[] {
  return candidates
    .filter((c) => isEligible(c, context))
    .map((c) => scoreOne(c, context))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-breakers: lighter load, then nearer.
      if (a.partner.currentLoad !== b.partner.currentLoad) {
        return a.partner.currentLoad - b.partner.currentLoad;
      }
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });
}

/** Return the single best partner, or null when none are eligible. */
export function selectBestPartner(
  candidates: PartnerCandidate[],
  context: AutoAssignContext,
): ScoredPartner | null {
  const ranked = scorePartners(candidates, context);
  return ranked[0] ?? null;
}
