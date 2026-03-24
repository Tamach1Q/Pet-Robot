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

type DirectionsRequestBody = {
  coordinates: number[][];
  instructions: boolean;
  elevation: boolean;
  options?: {
    avoid_features?: string[];
    profile_params?: {
      weightings?: {
        green?: {
          factor: number;
        };
        quiet?: {
          factor: number;
        };
      };
    };
  };
};

type DirectionsFeature = {
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

function buildDirectionsRequestBody(waypoints: RouteWaypoint[], useRoutingOptions: boolean): DirectionsRequestBody {
  const body: DirectionsRequestBody = {
    coordinates: waypoints.map((point) => [point.lng, point.lat]),
    instructions: false,
    elevation: false,
  };

  if (useRoutingOptions) {
    body.options = {
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
    };
  }

  return body;
}

async function parseDirectionsResponse(
  response: Response,
): Promise<{
  feature: DirectionsFeature;
  routeCoordinates: RouteCoordinate[];
  segments: NonNullable<DirectionsFeature["properties"]>["segments"];
}> {
  const payload = (await response.json()) as {
    features?: DirectionsFeature[];
  };
  const feature = payload.features?.[0];
  const routeCoordinates = (feature?.geometry?.coordinates ?? []).map(([lng, lat]) => ({
    lat: Number(lat),
    lng: Number(lng),
  }));
  const segments = feature?.properties?.segments ?? [];

  if (routeCoordinates.length < 2) {
    throw new Error("openrouteservice returned too few coordinates");
  }

  return {
    feature: feature ?? {},
    routeCoordinates,
    segments,
  };
}

function buildLegs(
  routeId: string,
  waypoints: RouteWaypoint[],
  routeCoordinates: RouteCoordinate[],
  segments: Array<{
    distance?: number;
    duration?: number;
    way_points?: [number, number];
  }>,
): RouteLeg[] {
  if (segments.length === 0) {
    return [];
  }

  if (segments.length !== waypoints.length - 1) {
    console.warn("RoutingService.generateWalkingLoop unexpected segment count", {
      routeId,
      expectedSegments: waypoints.length - 1,
      actualSegments: segments.length,
    });
    return [];
  }

  return segments.map((segment, index) => {
    const startIndex = segment.way_points?.[0] ?? 0;
    const endIndex = segment.way_points?.[1] ?? startIndex;
    const legCoordinates = routeCoordinates.slice(startIndex, endIndex + 1);

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
}

async function requestRoute(
  baseUrl: string,
  apiKey: string,
  body: DirectionsRequestBody,
): Promise<Response> {
  return fetch(`${baseUrl}/v2/directions/foot-walking/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
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
      const requests: Array<{
        description: string;
        body: DirectionsRequestBody;
      }> = [
        {
          description: "with routing options",
          body: buildDirectionsRequestBody(waypoints, true),
        },
        {
          description: "without routing options",
          body: buildDirectionsRequestBody(waypoints, false),
        },
      ];
      let lastError: Error | null = null;
      let feature: DirectionsFeature | null = null;
      let routeCoordinates: RouteCoordinate[] = [];
      let segments: Array<{
        distance?: number;
        duration?: number;
        way_points?: [number, number];
      }> = [];

      for (const request of requests) {
        const response = await requestRoute(
          this.options.baseUrl,
          this.options.apiKey,
          request.body,
        );

        if (!response.ok) {
          const body = await response.text();
          lastError = new Error(
            `openrouteservice routing failed (${request.description}): ${response.status} ${body}`,
          );
          continue;
        }

        const parsed = await parseDirectionsResponse(response);
        feature = parsed.feature;
        routeCoordinates = parsed.routeCoordinates;
        segments = parsed.segments ?? [];
        lastError = null;
        break;
      }

      if (lastError) {
        throw lastError;
      }

      if (!feature) {
        throw new Error("openrouteservice returned no route");
      }

      const legs = buildLegs(routeId, waypoints, routeCoordinates, segments);

      return {
        coordinates: routeCoordinates,
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
