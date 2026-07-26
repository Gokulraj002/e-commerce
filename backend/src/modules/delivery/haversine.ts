/**
 * Great-circle distance helper for delivery routing / auto-assignment.
 * Pure math — no I/O, no Prisma. Distances are returned in kilometres.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance in kilometres between two lat/lng points on the earth's surface. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Returns a GeoPoint only when both coordinates are present. */
export function toGeoPoint(lat: number | null, lng: number | null): GeoPoint | null {
  if (lat === null || lng === null) return null;
  return { lat, lng };
}
