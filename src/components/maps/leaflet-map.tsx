"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  fetchDrivingRoute,
  straightRoute,
  type DrivingRoute,
} from "@/lib/routing";

export type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: LatLng = { lat: -3.1634, lng: 115.0835 };

const pinIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:18px;height:18px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
      transform:rotate(-45deg);
    "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -16],
  });

const outletIcon = pinIcon("#004ac6");
const customerIcon = pinIcon("#dc2626");
const defaultIcon = pinIcon("#2563eb");

function MapRecenter({
  position,
  zoom,
}: {
  position: LatLng;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng], zoom ?? map.getZoom(), {
      animate: true,
    });
  }, [map, position.lat, position.lng, zoom]);
  return null;
}

function FitBounds({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const b = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(b, { padding: [36, 36], maxZoom: 16 });
  }, [map, points]);
  return null;
}

function MapClickHandler({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick?: (pos: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled || !onPick) return;
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function RouteLayer({
  origin,
  destination,
  onRoute,
}: {
  origin: LatLng;
  destination: LatLng;
  onRoute?: (r: DrivingRoute | null, viaOsrm: boolean) => void;
}) {
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [viaOsrm, setViaOsrm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRoute(null);
    (async () => {
      const r = await fetchDrivingRoute(origin, destination);
      if (cancelled) return;
      if (r) {
        setRoute(r);
        setViaOsrm(true);
        onRoute?.(r, true);
      } else {
        const fallback = straightRoute(origin, destination);
        setRoute(fallback);
        setViaOsrm(false);
        onRoute?.(fallback, false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, destination.lat, destination.lng]);

  if (!route) return null;

  return (
    <>
      <Polyline
        positions={route.points}
        pathOptions={{
          color: viaOsrm ? "#004ac6" : "#64748b",
          weight: 5,
          opacity: 0.85,
          dashArray: viaOsrm ? undefined : "8 10",
        }}
      />
      <FitBounds points={route.points} />
    </>
  );
}

export type LeafletMapProps = {
  /** Single pin (address form etc.) */
  position?: LatLng | null;
  onPositionChange?: (pos: LatLng) => void;
  interactive?: boolean;
  draggableMarker?: boolean;
  zoom?: number;
  className?: string;
  height?: number | string;
  radiusKm?: number;
  showCoords?: boolean;
  /** Route mode: outlet / start */
  origin?: LatLng | null;
  /** Route mode: customer / end */
  destination?: LatLng | null;
  originLabel?: string;
  destinationLabel?: string;
  showRouteInfo?: boolean;
};

export function LeafletMap({
  position = null,
  onPositionChange,
  interactive = false,
  draggableMarker = false,
  zoom = 15,
  className = "",
  height = 250,
  radiusKm,
  showCoords = true,
  origin = null,
  destination = null,
  originLabel = "Outlet",
  destinationLabel = "Lokasi customer",
  showRouteInfo = true,
}: LeafletMapProps) {
  const hasRoute = origin != null && destination != null;
  const single = !hasRoute ? position : null;
  const center = destination || origin || position || DEFAULT_CENTER;
  const heightCss = typeof height === "number" ? `${height}px` : height;

  const [routeMeta, setRouteMeta] = useState<{
    r: DrivingRoute;
    osrm: boolean;
  } | null>(null);

  const routeKey = useMemo(
    () =>
      origin && destination
        ? `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`
        : "",
    [origin, destination]
  );

  useEffect(() => {
    setRouteMeta(null);
  }, [routeKey]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-outline-variant/50 shadow-sm ${className}`}
      style={{ height: heightCss }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="z-0 h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!hasRoute && (
          <MapRecenter position={center} zoom={single ? undefined : zoom} />
        )}

        <MapClickHandler enabled={interactive} onPick={onPositionChange} />

        {hasRoute && origin && destination && (
          <RouteLayer
            origin={origin}
            destination={destination}
            onRoute={(r, osrm) => {
              if (r) setRouteMeta({ r, osrm });
            }}
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={outletIcon}>
            <Popup>{originLabel}</Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={customerIcon}>
            <Popup>{destinationLabel}</Popup>
          </Marker>
        )}

        {single && (
          <Marker
            position={[single.lat, single.lng]}
            icon={defaultIcon}
            draggable={draggableMarker}
            eventHandlers={{
              dragend: (e) => {
                if (!onPositionChange) return;
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                onPositionChange({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        )}

        {single && radiusKm != null && radiusKm > 0 && (
          <Circle
            center={[single.lat, single.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#2563eb",
              fillOpacity: 0.08,
              weight: 1.5,
            }}
          />
        )}
      </MapContainer>

      {showRouteInfo && hasRoute && (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[min(100%,18rem)] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
          {routeMeta ? (
            <>
              <p className="font-semibold text-on-surface">
                Rute {originLabel} → {destinationLabel}
              </p>
              <p className="mt-0.5 tabular-nums text-on-surface-variant">
                ±{routeMeta.r.distanceKm} km · {routeMeta.r.durationMin} mnt
                {!routeMeta.osrm ? " · garis lurus" : ""}
              </p>
            </>
          ) : (
            <p className="text-on-surface-variant">Menghitung rute…</p>
          )}
        </div>
      )}

      {showCoords && single && (
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg bg-white/95 px-2 py-1 text-[11px] font-medium tabular-nums text-on-surface-variant shadow-sm backdrop-blur">
          {single.lat.toFixed(5)}, {single.lng.toFixed(5)}
        </div>
      )}
      {interactive && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] max-w-[70%] rounded-lg bg-white/95 px-2 py-1 text-[11px] text-on-surface-variant shadow-sm backdrop-blur">
          Ketuk peta atau seret pin untuk mengatur lokasi
        </div>
      )}
    </div>
  );
}

export default LeafletMap;
