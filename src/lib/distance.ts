/**
 * Haversine formula — distance between two GPS points in KM
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function calculateDeliveryFee(
  distanceKm: number,
  baseFee: number,
  pricePerKm: number
): number {
  return Math.round(baseFee + distanceKm * pricePerKm);
}
