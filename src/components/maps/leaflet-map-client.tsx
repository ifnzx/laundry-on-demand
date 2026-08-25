"use client";

import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./leaflet-map";

const LeafletMapInner = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[250px] w-full items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-container text-sm text-on-surface-variant">
      Memuat peta…
    </div>
  ),
});

/** Safe Leaflet map for App Router (no SSR). */
export function LeafletMapClient(props: LeafletMapProps) {
  return <LeafletMapInner {...props} />;
}
