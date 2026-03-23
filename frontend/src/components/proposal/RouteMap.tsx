"use client";

import { useEffect, useRef } from "react";

type RouteCoordinate = {
  lat: number;
  lng: number;
};

type RouteMapProps = {
  coordinates: RouteCoordinate[];
};

export function RouteMap({ coordinates }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayGroupRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setupMap() {
      if (!containerRef.current || coordinates.length === 0) {
        return;
      }

      const L = await import("leaflet");

      if (cancelled || !containerRef.current) {
        return;
      }

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          tapHold: false,
          touchZoom: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);

        overlayGroupRef.current = L.layerGroup().addTo(mapRef.current);
      }

      overlayGroupRef.current?.clearLayers();

      const latLngs: [number, number][] = coordinates.map((point) => [
        point.lat,
        point.lng,
      ]);

      const routeLayer = L.polyline(latLngs, {
        color: "#b86d3c",
        weight: 6,
        opacity: 0.9,
      }).addTo(overlayGroupRef.current!);

      const start = coordinates[0];
      const end = coordinates[coordinates.length - 1];

      L.circleMarker([start.lat, start.lng], {
        radius: 6,
        color: "#8e4e25",
        fillColor: "#fff7eb",
        fillOpacity: 1,
        weight: 3,
      }).addTo(overlayGroupRef.current!);

      L.circleMarker([end.lat, end.lng], {
        radius: 6,
        color: "#8e4e25",
        fillColor: "#f4efe6",
        fillOpacity: 1,
        weight: 3,
      }).addTo(overlayGroupRef.current!);

      mapRef.current.fitBounds(routeLayer.getBounds(), {
        padding: [24, 24],
      });
    }

    void setupMap();

    return () => {
      cancelled = true;
    };
  }, [coordinates]);

  useEffect(() => {
    return () => {
      overlayGroupRef.current?.remove();
      overlayGroupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (coordinates.length === 0) {
    return (
      <div
        style={{
          minHeight: "220px",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
        }}
      >
        地図を表示できませんでした
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "220px",
        width: "100%",
        overflow: "hidden",
        borderRadius: "22px",
      }}
    />
  );
}
