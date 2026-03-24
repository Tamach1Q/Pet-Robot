import type { RouteCoordinate, RouteLeg, RouteWaypoint } from "../types/domain.js";

export interface RouteResult {
  coordinates: [number, number][];
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
}

export interface GenerateLoopRouteInput {
  latitude: number;
  longitude: number;
  desiredWalkMinutes: number;
  waypointCount?: 2 | 3;
}

export class RoutingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingServiceError";
  }
}

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

type CoordinateTuple = [number, number];

type DirectionsRequestBody = {
  coordinates: number[][];
  instructions: boolean;
  elevation: boolean;
  maximum_speed?: number;
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

type IsochroneGeometry = {
  type?: "Polygon" | "MultiPolygon";
  coordinates?: number[][][] | number[][][][];
};

type IsochroneFeature = {
  geometry?: IsochroneGeometry;
};

type LoopCandidateConfig = {
  waypointCount: 2 | 3;
  rangeSeconds: number;
  pullFactor: number;
  phaseOffsetRatio: number;
};

type LoopCandidateResult = RouteResult & {
  waypointCount: 2 | 3;
  rangeSeconds: number;
  pullFactor: number;
  phaseOffsetRatio: number;
  orsDurationSeconds: number;
  durationDeltaSeconds: number;
  distanceDeltaMeters: number;
};

const LEG_COLORS = ["#dc5f00", "#24a148", "#0f62fe", "#8a3ffc", "#d12771"];
const ELDERLY_WALKING_SPEED_KMH = 2.5;
const ORS_FOOT_WALKING_SPEED_KMH = 5;
const ELDERLY_WALKING_SPEED_MPS = (ELDERLY_WALKING_SPEED_KMH * 1000) / 3600;
const ORS_FOOT_WALKING_SPEED_MPS = (ORS_FOOT_WALKING_SPEED_KMH * 1000) / 3600;
const LOOP_RANGE_MULTIPLIERS = [0.8, 1.0, 1.2];
const LOOP_PHASE_OFFSETS = [0, 0.18];
const LOOP_ROUTE_GEOMETRY_FACTORS: Record<2 | 3, number> = {
  2: 3.2,
  3: 4.4,
};
const LOOP_PULL_FACTORS: Record<2 | 3, number[]> = {
  2: [0.42, 0.55],
  3: [0.32, 0.42],
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildDirectionsRequestBody(
  waypoints: RouteWaypoint[],
  useRoutingOptions: boolean,
): DirectionsRequestBody {
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

function buildLoopDirectionsRequestBody(
  origin: CoordinateTuple,
  waypointCoordinates: CoordinateTuple[],
  useReducedWalkingSpeed: boolean,
): DirectionsRequestBody {
  const body: DirectionsRequestBody = {
    coordinates: [origin, ...waypointCoordinates, origin],
    instructions: false,
    elevation: false,
    options: {
      avoid_features: ["ferries", "steps"],
    },
  };

  if (useReducedWalkingSpeed) {
    body.maximum_speed = ELDERLY_WALKING_SPEED_KMH;
  }

  return body;
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

function normalizeCoordinateTuple(coordinate: number[]): CoordinateTuple | null {
  const [lng, lat] = coordinate;

  if (!isFiniteCoordinate(lng) || !isFiniteCoordinate(lat)) {
    return null;
  }

  return [Number(lng), Number(lat)];
}

function ringsFromIsochroneGeometry(geometry: IsochroneGeometry): number[][][] {
  if (geometry.type === "Polygon") {
    const polygonCoordinates = geometry.coordinates as number[][][] | undefined;

    return Array.isArray(polygonCoordinates) ? [polygonCoordinates[0] ?? []] : [];
  }

  if (geometry.type === "MultiPolygon") {
    const multiPolygonCoordinates = geometry.coordinates as number[][][][] | undefined;

    return Array.isArray(multiPolygonCoordinates)
      ? multiPolygonCoordinates.map((polygon) => polygon[0] ?? [])
      : [];
  }

  return [];
}

function approximateRingArea(ring: CoordinateTuple[]): number {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

function extractBoundaryRing(geometry: IsochroneGeometry): CoordinateTuple[] {
  const normalizedRings = ringsFromIsochroneGeometry(geometry)
    .map((ring) =>
      ring
        .map((coordinate) => normalizeCoordinateTuple(coordinate))
        .filter((coordinate): coordinate is CoordinateTuple => coordinate !== null),
    )
    .filter((ring) => ring.length >= 4)
    .sort((left, right) => approximateRingArea(right) - approximateRingArea(left));

  const boundaryRing = normalizedRings[0];

  if (!boundaryRing) {
    throw new Error("openrouteservice returned no usable isochrone boundary");
  }

  const firstCoordinate = boundaryRing[0];
  const lastCoordinate = boundaryRing[boundaryRing.length - 1];

  if (firstCoordinate[0] === lastCoordinate[0] && firstCoordinate[1] === lastCoordinate[1]) {
    boundaryRing.pop();
  }

  if (boundaryRing.length < 3) {
    throw new Error("openrouteservice returned too few boundary coordinates");
  }

  return boundaryRing;
}

function pullWaypointTowardOrigin(
  origin: CoordinateTuple,
  target: CoordinateTuple,
  factor: number,
): CoordinateTuple {
  return [
    origin[0] + (target[0] - origin[0]) * factor,
    origin[1] + (target[1] - origin[1]) * factor,
  ];
}

function uniqueCoordinates(coordinates: CoordinateTuple[]): CoordinateTuple[] {
  const seen = new Set<string>();

  return coordinates.filter(([lng, lat]) => {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function selectLoopWaypoints(
  origin: CoordinateTuple,
  boundaryRing: CoordinateTuple[],
  requestedWaypointCount: number,
  pullFactor: number,
  phaseOffsetRatio: number,
): CoordinateTuple[] {
  if (boundaryRing.length < requestedWaypointCount * 2) {
    throw new Error("isochrone boundary is too small to extract waypoints");
  }

  const phaseOffset = Math.floor(boundaryRing.length * phaseOffsetRatio) % boundaryRing.length;
  const evenlySpacedPoints = Array.from({ length: requestedWaypointCount }, (_, index) => {
    const sampledIndex = (
      phaseOffset + Math.floor(((index + 0.5) * boundaryRing.length) / requestedWaypointCount)
    ) % boundaryRing.length;

    return pullWaypointTowardOrigin(origin, boundaryRing[sampledIndex], pullFactor);
  });

  const uniqueEvenlySpacedPoints = uniqueCoordinates(evenlySpacedPoints);

  if (uniqueEvenlySpacedPoints.length === requestedWaypointCount) {
    return uniqueEvenlySpacedPoints;
  }

  const fallbackPoints = Array.from({ length: requestedWaypointCount }, (_, index) => {
    const sampledIndex = (
      phaseOffset + Math.floor((index * boundaryRing.length) / requestedWaypointCount)
    ) % boundaryRing.length;

    return pullWaypointTowardOrigin(origin, boundaryRing[sampledIndex], pullFactor);
  });
  const uniqueFallbackPoints = uniqueCoordinates(fallbackPoints);

  if (uniqueFallbackPoints.length < requestedWaypointCount) {
    throw new Error("failed to derive distinct waypoints from the isochrone boundary");
  }

  return uniqueFallbackPoints;
}

function toDesiredWalkDurationSeconds(desiredWalkMinutes: number): number {
  if (!Number.isFinite(desiredWalkMinutes) || desiredWalkMinutes <= 0) {
    throw new RoutingServiceError("desiredWalkMinutes must be a positive number");
  }

  return Math.max(5 * 60, Math.round(desiredWalkMinutes * 60));
}

function estimateDurationSecondsFromDistance(distanceMeters: number): number {
  return Math.max(60, Math.round(distanceMeters / ELDERLY_WALKING_SPEED_MPS));
}

function estimateTargetDistanceMeters(targetDurationSeconds: number): number {
  return Math.round(targetDurationSeconds * ELDERLY_WALKING_SPEED_MPS);
}

function getWaypointCountCandidates(
  desiredWalkMinutes: number,
  explicitWaypointCount?: 2 | 3,
): Array<2 | 3> {
  if (explicitWaypointCount) {
    return [explicitWaypointCount];
  }

  if (desiredWalkMinutes <= 25) {
    return [2];
  }

  if (desiredWalkMinutes <= 40) {
    return [2, 3];
  }

  return [3, 2];
}

function buildLoopCandidateConfigs(
  input: GenerateLoopRouteInput,
  targetDurationSeconds: number,
): LoopCandidateConfig[] {
  const targetDistanceMeters = estimateTargetDistanceMeters(targetDurationSeconds);
  const waypointCounts = getWaypointCountCandidates(
    input.desiredWalkMinutes,
    input.waypointCount,
  );
  const maxRangeSeconds = Math.max(90, Math.round(targetDurationSeconds * 0.35));
  const configs = waypointCounts.flatMap((waypointCount) => {
    const baseRadiusMeters =
      targetDistanceMeters / LOOP_ROUTE_GEOMETRY_FACTORS[waypointCount];
    const baseRangeSeconds = Math.max(
      60,
      Math.round(baseRadiusMeters / ORS_FOOT_WALKING_SPEED_MPS),
    );

    return LOOP_RANGE_MULTIPLIERS.flatMap((rangeMultiplier) => {
      const rangeSeconds = clamp(
        Math.round(baseRangeSeconds * rangeMultiplier),
        60,
        maxRangeSeconds,
      );

      return LOOP_PULL_FACTORS[waypointCount].flatMap((pullFactor) =>
        LOOP_PHASE_OFFSETS.map((phaseOffsetRatio) => ({
          waypointCount,
          rangeSeconds,
          pullFactor,
          phaseOffsetRatio,
        })),
      );
    });
  });

  const seen = new Set<string>();

  return configs.filter((config) => {
    const key = [
      config.waypointCount,
      config.rangeSeconds,
      config.pullFactor.toFixed(2),
      config.phaseOffsetRatio.toFixed(2),
    ].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isBetterLoopCandidate(
  candidate: LoopCandidateResult,
  currentBest: LoopCandidateResult | null,
): boolean {
  if (!currentBest) {
    return true;
  }

  if (candidate.durationDeltaSeconds !== currentBest.durationDeltaSeconds) {
    return candidate.durationDeltaSeconds < currentBest.durationDeltaSeconds;
  }

  if (candidate.distanceDeltaMeters !== currentBest.distanceDeltaMeters) {
    return candidate.distanceDeltaMeters < currentBest.distanceDeltaMeters;
  }

  return candidate.waypointCount < currentBest.waypointCount;
}

async function parseDirectionsResponse(
  response: Response,
): Promise<{
  feature: DirectionsFeature;
  geoJsonCoordinates: CoordinateTuple[];
  routeCoordinates: RouteCoordinate[];
  segments: NonNullable<DirectionsFeature["properties"]>["segments"];
}> {
  const payload = (await response.json()) as {
    features?: DirectionsFeature[];
  };
  const feature = payload.features?.[0];
  const geoJsonCoordinates = (feature?.geometry?.coordinates ?? [])
    .map((coordinate) => normalizeCoordinateTuple(coordinate))
    .filter((coordinate): coordinate is CoordinateTuple => coordinate !== null);
  const routeCoordinates = geoJsonCoordinates.map(([lng, lat]) => ({
    lat: Number(lat),
    lng: Number(lng),
  }));
  const segments = feature?.properties?.segments ?? [];

  if (routeCoordinates.length < 2) {
    throw new Error("openrouteservice returned too few coordinates");
  }

  return {
    feature: feature ?? {},
    geoJsonCoordinates,
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

async function requestIsochrone(
  baseUrl: string,
  apiKey: string,
  origin: CoordinateTuple,
  rangeSeconds: number,
): Promise<Response> {
  return fetch(`${baseUrl}/v2/isochrones/foot-walking`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: [origin],
      range: [rangeSeconds],
      range_type: "time",
    }),
  });
}

async function parseIsochroneBoundary(response: Response): Promise<CoordinateTuple[]> {
  const payload = (await response.json()) as {
    features?: IsochroneFeature[];
  };
  const geometry = payload.features?.[0]?.geometry;

  if (!geometry) {
    throw new Error("openrouteservice returned no isochrone polygon");
  }

  return extractBoundaryRing(geometry);
}

async function requestLoopDirections(
  baseUrl: string,
  apiKey: string,
  origin: CoordinateTuple,
  waypointCoordinates: CoordinateTuple[],
): Promise<{
  coordinates: CoordinateTuple[];
  totalDistanceMeters: number;
  orsDurationSeconds: number;
}> {
  const directionsRequests: Array<{
    description: string;
    body: DirectionsRequestBody;
  }> = [
    {
      description: "with reduced walking speed",
      body: buildLoopDirectionsRequestBody(origin, waypointCoordinates, true),
    },
    {
      description: "with default walking speed",
      body: buildLoopDirectionsRequestBody(origin, waypointCoordinates, false),
    },
  ];
  let lastError: Error | null = null;

  for (const request of directionsRequests) {
    const response = await requestRoute(baseUrl, apiKey, request.body);

    if (!response.ok) {
      const body = await response.text();
      lastError = new Error(
        `openrouteservice directions failed (${request.description}): ${response.status} ${body}`,
      );
      continue;
    }

    const parsed = await parseDirectionsResponse(response);
    const totalDistanceMeters = Math.round(parsed.feature.properties?.summary?.distance ?? 0);
    const orsDurationSeconds = Math.round(parsed.feature.properties?.summary?.duration ?? 0);

    if (totalDistanceMeters <= 0) {
      lastError = new Error("openrouteservice returned a route with no distance");
      continue;
    }

    return {
      coordinates: parsed.geoJsonCoordinates,
      totalDistanceMeters,
      orsDurationSeconds,
    };
  }

  throw lastError ?? new Error("openrouteservice returned no loop route");
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
        distanceM: Math.round(feature.properties?.summary?.distance ?? 0),
        durationMin: durationMinutes(feature.properties?.summary?.duration ?? 0),
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

  async generateLoopRoute(input: GenerateLoopRouteInput): Promise<RouteResult> {
    const apiKey = process.env.ORS_API_KEY ?? this.options.apiKey;
    const origin: CoordinateTuple = [input.longitude, input.latitude];

    if (!apiKey) {
      const error = new RoutingServiceError("ORS_API_KEY is not configured");
      console.error("RoutingService.generateLoopRoute failed", {
        input,
        error,
      });
      throw error;
    }

    if (
      input.waypointCount !== undefined &&
      input.waypointCount !== 2 &&
      input.waypointCount !== 3
    ) {
      const error = new RoutingServiceError("waypointCount must be 2 or 3");
      console.error("RoutingService.generateLoopRoute failed", {
        input,
        error,
      });
      throw error;
    }

    try {
      const targetDurationSeconds = toDesiredWalkDurationSeconds(
        input.desiredWalkMinutes,
      );
      const targetDistanceMeters = estimateTargetDistanceMeters(targetDurationSeconds);
      const toleranceSeconds = Math.max(
        3 * 60,
        Math.round(targetDurationSeconds * 0.15),
      );
      const candidateConfigs = buildLoopCandidateConfigs(input, targetDurationSeconds);
      const boundaryRingCache = new Map<number, CoordinateTuple[]>();
      let bestCandidate: LoopCandidateResult | null = null;
      let lastError: Error | null = null;

      for (const candidateConfig of candidateConfigs) {
        let boundaryRing = boundaryRingCache.get(candidateConfig.rangeSeconds);

        if (!boundaryRing) {
          const isochroneResponse = await requestIsochrone(
            this.options.baseUrl,
            apiKey,
            origin,
            candidateConfig.rangeSeconds,
          );

          if (!isochroneResponse.ok) {
            const body = await isochroneResponse.text();
            lastError = new Error(
              `openrouteservice isochrone failed (${candidateConfig.rangeSeconds}s): ${isochroneResponse.status} ${body}`,
            );
            continue;
          }

          boundaryRing = await parseIsochroneBoundary(isochroneResponse);
          boundaryRingCache.set(candidateConfig.rangeSeconds, boundaryRing);
        }

        let loopWaypoints: CoordinateTuple[];

        try {
          loopWaypoints = selectLoopWaypoints(
            origin,
            boundaryRing,
            candidateConfig.waypointCount,
            candidateConfig.pullFactor,
            candidateConfig.phaseOffsetRatio,
          );
        } catch (error) {
          lastError =
            error instanceof Error
              ? error
              : new Error("failed to derive loop waypoints");
          continue;
        }

        try {
          const route = await requestLoopDirections(
            this.options.baseUrl,
            apiKey,
            origin,
            loopWaypoints,
          );
          const estimatedDurationSeconds = estimateDurationSecondsFromDistance(
            route.totalDistanceMeters,
          );
          const candidate: LoopCandidateResult = {
            coordinates: route.coordinates,
            totalDistanceMeters: route.totalDistanceMeters,
            estimatedDurationSeconds,
            waypointCount: candidateConfig.waypointCount,
            rangeSeconds: candidateConfig.rangeSeconds,
            pullFactor: candidateConfig.pullFactor,
            phaseOffsetRatio: candidateConfig.phaseOffsetRatio,
            orsDurationSeconds: route.orsDurationSeconds,
            durationDeltaSeconds: Math.abs(
              estimatedDurationSeconds - targetDurationSeconds,
            ),
            distanceDeltaMeters: Math.abs(
              route.totalDistanceMeters - targetDistanceMeters,
            ),
          };

          if (isBetterLoopCandidate(candidate, bestCandidate)) {
            bestCandidate = candidate;
          }

          if (candidate.durationDeltaSeconds <= toleranceSeconds) {
            break;
          }
        } catch (error) {
          lastError =
            error instanceof Error
              ? error
              : new Error("openrouteservice returned no loop route");
        }
      }

      if (bestCandidate) {
        console.info("RoutingService.generateLoopRoute selected candidate", {
          requestedMinutes: input.desiredWalkMinutes,
          targetDurationSeconds,
          targetDistanceMeters,
          selectedWaypointCount: bestCandidate.waypointCount,
          selectedRangeSeconds: bestCandidate.rangeSeconds,
          selectedPullFactor: bestCandidate.pullFactor,
          selectedPhaseOffsetRatio: bestCandidate.phaseOffsetRatio,
          totalDistanceMeters: bestCandidate.totalDistanceMeters,
          estimatedDurationSeconds: bestCandidate.estimatedDurationSeconds,
          orsDurationSeconds: bestCandidate.orsDurationSeconds,
          durationDeltaSeconds: bestCandidate.durationDeltaSeconds,
        });

        return {
          coordinates: bestCandidate.coordinates,
          totalDistanceMeters: bestCandidate.totalDistanceMeters,
          estimatedDurationSeconds: bestCandidate.estimatedDurationSeconds,
        };
      }

      throw lastError ?? new Error("openrouteservice returned no loop route");
    } catch (error) {
      console.error("RoutingService.generateLoopRoute failed", {
        input,
        error,
      });

      if (error instanceof RoutingServiceError) {
        throw error;
      }

      throw new RoutingServiceError("ループ経路の生成に失敗しました");
    }
  }
}
