export type LatLng = { lat: number; lng: number };

export type DrivingRoute = {
  /** [lat, lng] pairs for Leaflet polyline */
  points: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: number;
  durationMin: number;
};

/**
 * Fetch driving route via public OSRM demo server.
 * Coords: OpenStreetMap (lng,lat). Leaflet uses lat,lng.
 */
export async function fetchDrivingRoute(
  from: LatLng,
  to: LatLng
): Promise<DrivingRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const points: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );
    return {
      points,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}

/** Straight-line fallback when routing API unavailable */
export function straightRoute(from: LatLng, to: LatLng): DrivingRoute {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return {
    points: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceMeters: km * 1000,
    durationSeconds: (km / 30) * 3600,
    distanceKm: Math.round(km * 10) / 10,
    durationMin: Math.max(1, Math.round((km / 30) * 60)),
  };
}
