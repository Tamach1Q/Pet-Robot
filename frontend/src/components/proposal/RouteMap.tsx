"use client";

import { useEffect, useRef } from "react";

type RouteCoordinate = {
  lat: number;
  lng: number;
};

type RouteWaypoint = {
  id: string;
  name: string;
  type: "start" | "checkpoint" | "goal";
  order: number;
  lat: number;
  lng: number;
};

type RouteLeg = {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  distanceM: number;
  durationMin: number;
  color: string;
  coordinates: RouteCoordinate[];
};

type RouteMapProps = {
  coordinates: RouteCoordinate[];
  waypoints: RouteWaypoint[];
  legs: RouteLeg[];
};

function markerLabel(waypoint: RouteWaypoint, hasOverlappingGoal: boolean): string {
  if (waypoint.type === "start") {
    return hasOverlappingGoal ? "発" : "出";
  }

  if (waypoint.type === "goal") {
    return "帰";
  }

  return String(waypoint.order);
}

function markerMarkup(waypoint: RouteWaypoint, hasOverlappingGoal: boolean): string {
  const isStart = waypoint.type === "start";
  const isGoal = waypoint.type === "goal";
  const size = isStart ? 40 : isGoal ? 34 : 30;
  const borderColor = isStart ? "#8e4e25" : "#c1672f";
  const background = isStart ? "#b86d3c" : "#ffffff";
  const color = isStart ? "#fffaf2" : "#6c3515";
  const badge =
    isStart && hasOverlappingGoal
      ? `
        <div style="
          position: absolute;
          top: -10px;
          right: -10px;
          padding: 2px 7px;
          border-radius: 999px;
          background: #fffaf2;
          border: 2px solid #8e4e25;
          color: #8e4e25;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          box-shadow: 0 2px 4px rgba(86, 48, 20, 0.14);
        ">
          もどる
        </div>
      `
      : "";

  return `
    <div style="position: relative; width: ${size}px; height: ${size}px;">
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 999px;
        background: ${background};
        border: 3px solid ${borderColor};
        color: ${color};
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: ${isStart ? 16 : 15}px;
        box-shadow: 0 4px 10px rgba(86, 48, 20, 0.18);
      ">
        ${markerLabel(waypoint, hasOverlappingGoal)}
      </div>
      ${badge}
    </div>
  `;
}

export function RouteMap({ coordinates, waypoints, legs }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayGroupRef = useRef<import("leaflet").LayerGroup | null>(null);

  function zoomIn() {
    mapRef.current?.zoomIn();
  }

  function zoomOut() {
    mapRef.current?.zoomOut();
  }

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
          scrollWheelZoom: true,
          dragging: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: false,
          tapHold: false,
          touchZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);

        overlayGroupRef.current = L.layerGroup().addTo(mapRef.current);
      }

      overlayGroupRef.current?.clearLayers();

      const routeBoundsLayer = L.polyline(
        coordinates.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: "#fffaf2",
          weight: 14,
          opacity: 0.98,
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(overlayGroupRef.current!);

      L.polyline(
        coordinates.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: "#b86d3c",
          weight: 8,
          opacity: 0.96,
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(overlayGroupRef.current!);

      L.polyline(
        coordinates.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: "#f7d5b6",
          weight: 3,
          opacity: 0.8,
          dashArray: "10 12",
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(overlayGroupRef.current!);

      const startWaypoint = waypoints.find((waypoint) => waypoint.type === "start");
      const goalOverlapsStart = waypoints.some(
        (waypoint) =>
          waypoint.type === "goal" &&
          waypoint.lat === startWaypoint?.lat &&
          waypoint.lng === startWaypoint?.lng,
      );

      waypoints.forEach((waypoint, index) => {
        const hasOverlappingGoal = waypoint.type === "start" && goalOverlapsStart;
        const isOverlappingGoal =
          waypoint.type === "goal" &&
          goalOverlapsStart &&
          waypoint.lat === startWaypoint?.lat &&
          waypoint.lng === startWaypoint?.lng;

        if (isOverlappingGoal) {
          return;
        }

        const marker = L.marker([waypoint.lat, waypoint.lng], {
          icon: L.divIcon({
            className: "pet-route-marker",
            html: markerMarkup(waypoint, hasOverlappingGoal),
            iconSize: waypoint.type === "start" ? [40, 40] : waypoint.type === "goal" ? [34, 34] : [30, 30],
            iconAnchor:
              waypoint.type === "start"
                ? [20, 20]
                : waypoint.type === "goal"
                  ? [17, 17]
                  : [15, 15],
          }),
          title: waypoint.name,
        });

        marker.addTo(overlayGroupRef.current!);
      });

      mapRef.current.fitBounds(routeBoundsLayer.getBounds(), {
        padding: [40, 40],
        maxZoom: 16,
      });
    }

    void setupMap();

    return () => {
      cancelled = true;
    };
  }, [coordinates, legs, waypoints]);

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
      style={{
        position: "relative",
        minHeight: "220px",
        width: "100%",
        overflow: "hidden",
        borderRadius: "22px",
      }}
    >
      <div
        ref={containerRef}
        style={{
          minHeight: "220px",
          width: "100%",
          overflow: "hidden",
          borderRadius: "22px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          display: "grid",
          gap: "8px",
          zIndex: 500,
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          aria-label="地図を拡大"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "14px",
            border: "1px solid rgba(142, 78, 37, 0.24)",
            background: "rgba(255, 250, 242, 0.96)",
            color: "#8e4e25",
            fontSize: "28px",
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: "0 6px 16px rgba(86, 48, 20, 0.16)",
            cursor: "pointer",
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="地図を縮小"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "14px",
            border: "1px solid rgba(142, 78, 37, 0.24)",
            background: "rgba(255, 250, 242, 0.96)",
            color: "#8e4e25",
            fontSize: "28px",
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: "0 6px 16px rgba(86, 48, 20, 0.16)",
            cursor: "pointer",
          }}
        >
          -
        </button>
      </div>
    </div>
  );
}
