import type { RouteCoordinate } from "../types/domain.js";

export type GeneratedRoute = {
  coordinates: RouteCoordinate[];
  distanceM: number;
  durationMin: number;
  polyline: string;
};

type RoutingServiceOptions = {
  baseUrl: string;
  apiKey: string | null;
};

function buildFallbackRoute(
  currentLocation: RouteCoordinate,
  waypoints: RouteCoordinate[],
): GeneratedRoute {
  const coordinates = [currentLocation, ...waypoints, currentLocation];

  return {
    coordinates,
    distanceM: 0,
    durationMin: 0,
    polyline: "fallback-waypoints-route",
  };
}

export class RoutingService {
  constructor(private readonly options: RoutingServiceOptions) {}

  async generateWalkingLoop(
    currentLocation: RouteCoordinate,
    waypoints: RouteCoordinate[],
  ): Promise<GeneratedRoute> {
    if (!this.options.apiKey) {
      return buildFallbackRoute(currentLocation, waypoints);
    }

    const coordinates = [currentLocation, ...waypoints, currentLocation].map((point) => [
      point.lng,
      point.lat,
    ]);

    const response = await fetch(
      `${this.options.baseUrl}/v2/directions/foot-walking/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: this.options.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates,
          instructions: false,
          elevation: false,
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
        };
      }>;
    };

    const feature = payload.features?.[0];
    const routeCoordinates = feature?.geometry?.coordinates ?? [];

    return {
      coordinates: routeCoordinates.map(([lng, lat]) => ({
        lat: Number(lat),
        lng: Number(lng),
      })),
      distanceM: Math.round(feature?.properties?.summary?.distance ?? 0),
      durationMin: Math.max(
        1,
        Math.round((feature?.properties?.summary?.duration ?? 0) / 60),
      ),
      polyline: "openrouteservice-geojson-route",
    };
  }
}
