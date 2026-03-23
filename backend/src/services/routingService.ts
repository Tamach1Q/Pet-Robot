import type { RouteCoordinate, RouteLeg, RouteWaypoint } from "../types/domain.js";

export type GeneratedRoute = {
  coordinates: RouteCoordinate[];
  waypoints: RouteWaypoint[];
  legs: RouteLeg[];
  distanceM: number;
  durationMin: number;
  polyline: string;
};

type RoutingServiceOptions = {
  baseUrl: string;
  apiKey: string | null;
};

type GenerateWalkingLoopInput = {
  routeId: string;
  waypoints: RouteWaypoint[];
};

const LEG_COLORS = ["#dc5f00", "#24a148", "#0f62fe", "#8a3ffc", "#d12771"];

function buildFallbackRoute(waypoints: RouteWaypoint[]): GeneratedRoute {
  const coordinates = waypoints.map(({ lat, lng }) => ({ lat, lng }));
  const legs = waypoints.slice(0, -1).map((waypoint, index) => {
    const nextWaypoint = waypoints[index + 1];

    return {
      id: `fallback-leg-${index + 1}`,
      fromWaypointId: waypoint.id,
      toWaypointId: nextWaypoint.id,
      distanceM: 0,
      durationMin: 0,
      coordinates: [
        { lat: waypoint.lat, lng: waypoint.lng },
        { lat: nextWaypoint.lat, lng: nextWaypoint.lng },
      ],
      color: LEG_COLORS[index % LEG_COLORS.length],
    } satisfies RouteLeg;
  });

  return {
    coordinates,
    waypoints,
    legs,
    distanceM: 0,
    durationMin: 0,
    polyline: "fallback-waypoints-route",
  };
}

function durationMinutes(durationSec: number): number {
  return Math.max(1, Math.round(durationSec / 60));
}

export class RoutingService {
  constructor(private readonly options: RoutingServiceOptions) {}

  async generateWalkingLoop(
    input: GenerateWalkingLoopInput,
  ): Promise<GeneratedRoute> {
    const { routeId, waypoints } = input;

    if (!this.options.apiKey) {
      return buildFallbackRoute(waypoints);
    }

    try {
      const response = await fetch(
        `${this.options.baseUrl}/v2/directions/foot-walking/geojson`,
        {
          method: "POST",
          headers: {
            Authorization: this.options.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinates: waypoints.map((point) => [point.lng, point.lat]),
            instructions: false,
            elevation: false,
            options: {
              avoid_features: ["ferries", "steps"],
              profile_params: {
                weightings: {
                  green: {
                    factor: 0.7,
                  },
                  quiet: {
                    factor: 1.0,
                  },
                },
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`openrouteservice routing failed: ${response.status} ${body}`);
      }

      const payload = (await response.json()) as {
        features?: Array<{
          geometry?: {
            coordinates?: number[][];
          };
          properties?: {
            summary?: {
              distance?: number;
              duration?: number;
            };
            segments?: Array<{
              distance?: number;
              duration?: number;
              way_points?: [number, number];
            }>;
          };
        }>;
      };

      const feature = payload.features?.[0];
      const routeCoordinates = feature?.geometry?.coordinates ?? [];
      const segments = feature?.properties?.segments ?? [];

      if (routeCoordinates.length < 10) {
        throw new Error("openrouteservice returned too few coordinates");
      }

      if (segments.length !== waypoints.length - 1) {
        throw new Error("openrouteservice returned unexpected segment count");
      }

      const legs = segments.map((segment, index) => {
        const startIndex = segment.way_points?.[0] ?? 0;
        const endIndex = segment.way_points?.[1] ?? startIndex;
        const legCoordinates = routeCoordinates
          .slice(startIndex, endIndex + 1)
          .map(([lng, lat]) => ({
            lat: Number(lat),
            lng: Number(lng),
          }));

        return {
          id: `${routeId}-leg-${index + 1}`,
          fromWaypointId: waypoints[index].id,
          toWaypointId: waypoints[index + 1].id,
          distanceM: Math.round(segment.distance ?? 0),
          durationMin: durationMinutes(segment.duration ?? 0),
          coordinates: legCoordinates,
          color: LEG_COLORS[index % LEG_COLORS.length],
        } satisfies RouteLeg;
      });

      return {
        coordinates: routeCoordinates.map(([lng, lat]) => ({
          lat: Number(lat),
          lng: Number(lng),
        })),
        waypoints,
        legs,
        distanceM: Math.round(feature?.properties?.summary?.distance ?? 0),
        durationMin: durationMinutes(feature?.properties?.summary?.duration ?? 0),
        polyline: "openrouteservice-waypoint-route",
      };
    } catch (error) {
      console.error("RoutingService.generateWalkingLoop failed", {
        routeId,
        error,
      });
      return buildFallbackRoute(waypoints);
    }
  }
}
