export type RouteCoordinate = {
  lat: number;
  lng: number;
};

export type UserProfile = {
  id: string;
  userId: string;
  preferredWalkTimeStart: string | null;
  preferredWalkTimeEnd: string | null;
  mobilitySupportLevel: 0 | 1 | 2;
  slopeToleranceLevel: 0 | 1 | 2;
  heatCautionLevel: 0 | 1 | 2;
  rainCautionLevel: 0 | 1 | 2;
  prefersFixedRoutes: boolean;
  recommendedDurationMin: number;
  maxDurationMin: number;
  estimatedSpeedMPerMin: number;
  fatigueIndex: number;
  restTendencyIndex: number;
  earlyStopRiskIndex: number;
  explorationPreference: number;
  preferredFeaturesJson: Record<string, number>;
  lastProfileUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type WeatherSnapshot = {
  wbgt: number;
  precipitationMmPerH: number;
  temperatureC: number;
  humidityPct: number;
};

export type FixedRoute = {
  routeId: string;
  name: string;
  distanceM: number;
  durationMin: number;
  tags: string[];
  polyline: string;
  waypoints: RouteCoordinate[];
};

export type WalkHistoryRecord = {
  id: string;
  userId: string;
  routeId: string | null;
  startedAt: string;
  endedAt: string;
  actualDurationMin: number;
  movingDurationMin: number | null;
  distanceM: number;
  restCount: number;
  restDurationMin: number;
  firstHalfSpeedMPerMin: number | null;
  secondHalfSpeedMPerMin: number | null;
  earlyStop: boolean;
  returnedHomeSafely: boolean;
  subjectiveFatigueLevel: number | null;
  subjectiveEnjoymentLevel: number | null;
  routePreferenceFeedback: number | null;
  weatherWbgt: number | null;
  weatherPrecipitationMmPerH: number | null;
  weatherTemperatureC: number | null;
  weatherHumidityPct: number | null;
  slowdownRatio: number | null;
  loadScore: number | null;
  createdAt: string;
};

export type SuggestedRoute = {
  routeId: string;
  distanceM: number;
  durationMin: number;
  polyline: string;
  coordinates: RouteCoordinate[];
  reason: string;
  riskLevel: "low" | "medium" | "high";
};
