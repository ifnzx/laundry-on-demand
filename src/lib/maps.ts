/** OpenStreetMap helpers (no Google Maps). */

export function osmMapUrl(lat: number, lng: number, zoom = 16) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

export function osmSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export function osmPlaceUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}) {
  if (opts.lat != null && opts.lng != null) {
    return osmMapUrl(opts.lat, opts.lng);
  }
  if (opts.address) {
    return osmSearchUrl(opts.address);
  }
  return null;
}
