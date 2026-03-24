"use client";

import { divIcon, type Marker as LeafletMarker } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface SetupLocation {
  lat: number;
  lng: number;
}

type SetupMapProps = {
  center: SetupLocation;
  markerPosition: SetupLocation;
  zoom: number;
  routeCoordinates?: SetupLocation[];
  onMarkerMove: (nextPosition: SetupLocation) => void;
  onZoomChange: (nextZoom: number) => void;
};

type MapViewportControllerProps = {
  center: SetupLocation;
  zoom: number;
  routeCoordinates?: SetupLocation[];
  onMapClick: (nextPosition: SetupLocation) => void;
  onZoomChange: (nextZoom: number) => void;
};

const startPinIcon = divIcon({
  className: "setup-start-pin",
  html: `
    <div style="position: relative; width: 42px; height: 56px;">
      <div style="
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 26px;
        height: 26px;
        transform: translateX(-50%) rotate(45deg);
        border-radius: 10px 10px 16px 10px;
        background: #cc6b2c;
        box-shadow: 0 10px 20px rgba(95, 57, 28, 0.28);
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        top: 2px;
        width: 34px;
        height: 34px;
        transform: translateX(-50%);
        border-radius: 999px;
        border: 3px solid #fff8ef;
        background: #9f4d18;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 16px;
        font-weight: 800;
      ">出</div>
    </div>
  `,
  iconSize: [42, 56],
  iconAnchor: [21, 56],
});

function MapViewportController({
  center,
  zoom,
  routeCoordinates,
  onMapClick,
  onZoomChange,
}: MapViewportControllerProps) {
  const map = useMap();
  const previousRouteSignatureRef = useRef<string | null>(null);
  const previousCenterSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 1) {
      const routeSignature = routeCoordinates
        .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
        .join("|");

      if (previousRouteSignatureRef.current !== routeSignature) {
        previousRouteSignatureRef.current = routeSignature;
        map.fitBounds(
          routeCoordinates.map((point) => [point.lat, point.lng] as [number, number]),
          {
            padding: [36, 36],
            maxZoom: 16,
          },
        );
      }

      return;
    }

    previousRouteSignatureRef.current = null;
    const centerSignature = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;

    if (previousCenterSignatureRef.current !== centerSignature) {
      previousCenterSignatureRef.current = centerSignature;
      map.setView([center.lat, center.lng], zoom, {
        animate: true,
      });
    }
  }, [center.lat, center.lng, map, routeCoordinates, zoom]);

  useMapEvents({
    click(event) {
      onMapClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  return null;
}

export function SetupMap({
  center,
  markerPosition,
  zoom,
  routeCoordinates,
  onMarkerMove,
  onZoomChange,
}: SetupMapProps) {
  const markerRef = useRef<LeafletMarker | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px]">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportController
          center={center}
          zoom={zoom}
          routeCoordinates={routeCoordinates}
          onMapClick={onMarkerMove}
          onZoomChange={onZoomChange}
        />
        {routeCoordinates && routeCoordinates.length > 1 ? (
          <>
            <Polyline
              positions={routeCoordinates.map((point) => [point.lat, point.lng] as [number, number])}
              pathOptions={{
                color: "#fff7ef",
                weight: 14,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={routeCoordinates.map((point) => [point.lat, point.lng] as [number, number])}
              pathOptions={{
                color: "#cc6b2c",
                weight: 8,
                opacity: 0.98,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        ) : null}
        <Marker
          ref={markerRef}
          position={[markerPosition.lat, markerPosition.lng]}
          draggable
          icon={startPinIcon}
          eventHandlers={{
            dragend: () => {
              const nextPosition = markerRef.current?.getLatLng();

              if (!nextPosition) {
                return;
              }

              onMarkerMove({
                lat: nextPosition.lat,
                lng: nextPosition.lng,
              });
            },
          }}
        />
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-stone-700 shadow-[0_12px_24px_rgba(98,64,33,0.14)]">
        ピンをドラッグ、または地図をタップ
      </div>
    </div>
  );
}
