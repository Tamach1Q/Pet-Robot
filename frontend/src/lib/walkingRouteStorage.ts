export type StoredWalkingCoordinate = {
  lat: number;
  lng: number;
};

export type StoredWalkingRoute = {
  coordinates: StoredWalkingCoordinate[];
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
};

type WalkingRouteStorageRecord = {
  version: 1;
  savedAt: string;
  route: StoredWalkingRoute;
};

const WALKING_ROUTE_STORAGE_KEY = "pet-robot.walking-route.v1";
const MAX_ROUTE_AGE_MS = 12 * 60 * 60 * 1000;

function isStoredWalkingCoordinate(value: unknown): value is StoredWalkingCoordinate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredWalkingCoordinate>;

  return (
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lng)
  );
}

function isStoredWalkingRoute(value: unknown): value is StoredWalkingRoute {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredWalkingRoute>;

  return (
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length > 1 &&
    candidate.coordinates.every(isStoredWalkingCoordinate) &&
    typeof candidate.totalDistanceMeters === "number" &&
    Number.isFinite(candidate.totalDistanceMeters) &&
    typeof candidate.estimatedDurationSeconds === "number" &&
    Number.isFinite(candidate.estimatedDurationSeconds)
  );
}

function isWalkingRouteStorageRecord(value: unknown): value is WalkingRouteStorageRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WalkingRouteStorageRecord>;

  return (
    candidate.version === 1 &&
    typeof candidate.savedAt === "string" &&
    isStoredWalkingRoute(candidate.route)
  );
}

export function persistWalkingRoute(route: StoredWalkingRoute): void {
  if (typeof window === "undefined") {
    return;
  }

  const record: WalkingRouteStorageRecord = {
    version: 1,
    savedAt: new Date().toISOString(),
    route,
  };

  try {
    window.localStorage.setItem(WALKING_ROUTE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage write failures and continue with in-memory UI state.
  }
}

export function readPersistedWalkingRoute(): StoredWalkingRoute | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(WALKING_ROUTE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isWalkingRouteStorageRecord(parsed)) {
      window.localStorage.removeItem(WALKING_ROUTE_STORAGE_KEY);
      return null;
    }

    const savedAtTimestamp = Date.parse(parsed.savedAt);

    if (!Number.isFinite(savedAtTimestamp) || Date.now() - savedAtTimestamp > MAX_ROUTE_AGE_MS) {
      window.localStorage.removeItem(WALKING_ROUTE_STORAGE_KEY);
      return null;
    }

    return parsed.route;
  } catch {
    return null;
  }
}

export function clearPersistedWalkingRoute(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(WALKING_ROUTE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}
