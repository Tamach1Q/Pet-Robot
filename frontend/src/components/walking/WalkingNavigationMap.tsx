"use client";

import { divIcon } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

type Coordinate = {
  lat: number;
  lng: number;
};

type WalkingNavigationMapProps = {
  center: Coordinate;
  routeCoordinates: Coordinate[];
  heading: number;
  trackingMessage: string;
  isLoading: boolean;
};

function createCurrentLocationIcon(heading: number) {
  return divIcon({
    className: "walking-current-location-icon",
    html: `
      <div style="position: relative; width: 54px; height: 54px;">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(11, 107, 255, 0.18);
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 3px solid #ffffff;
          background: #0b6bff;
          box-shadow: 0 8px 18px rgba(11, 107, 255, 0.26);
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 6px;
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 18px solid #0b6bff;
          transform: translateX(-50%) rotate(${heading}deg);
          transform-origin: 50% 160%;
          filter: drop-shadow(0 4px 6px rgba(11, 107, 255, 0.28));
        "></div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
  });
}

function NavigationViewportController({
  center,
  zoom,
}: {
  center: Coordinate;
  zoom: number;
}) {
  const map = useMap();
  const previousCenterSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSignature = `${center.lat.toFixed(6)},${center.lng.toFixed(6)},${zoom}`;

    if (previousCenterSignatureRef.current === nextSignature) {
      return;
    }

    previousCenterSignatureRef.current = nextSignature;
    map.flyTo([center.lat, center.lng], zoom, {
      animate: true,
      duration: 0.8,
    });
  }, [center.lat, center.lng, map, zoom]);

  return null;
}

export function WalkingNavigationMap({
  center,
  routeCoordinates,
  heading,
  trackingMessage,
  isLoading,
}: WalkingNavigationMapProps) {
  const currentLocationIcon = useMemo(() => createCurrentLocationIcon(heading), [heading]);

  return (
    <div className="relative h-full min-h-[360px] w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={18}
        scrollWheelZoom
        zoomControl={false}
        className="h-full min-h-[360px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <NavigationViewportController center={center} zoom={18} />
        <Polyline
          positions={routeCoordinates.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{
            color: "#ffffff",
            weight: 16,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        <Polyline
          positions={routeCoordinates.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{
            color: "#0b6bff",
            weight: 8,
            opacity: 0.98,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        <Marker position={[center.lat, center.lng]} icon={currentLocationIcon} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-col gap-2">
        <div className="inline-flex max-w-fit items-center rounded-full bg-white/94 px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
          {isLoading ? "現在地を確認しています" : trackingMessage}
        </div>
        <div className="inline-flex max-w-fit items-center rounded-full bg-slate-900/80 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.22)]">
          進行方向 {Math.round(heading)}°
        </div>
      </div>
    </div>
  );
}
