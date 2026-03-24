export type SuggestWalkRouteBody = {
  userId: string;
  robotId: string;
  currentLocation: {
    lat: number;
    lng: number;
  };
  requestedAt: string;
};

export type GenerateLoopRouteBody = {
  currentLocation: {
    lat: number;
    lng: number;
  };
  desiredWalkMinutes: number;
};

export type CreateWalkHistoryBody = {
  userId: string;
  routeId?: string;
  startedAt: string;
  endedAt: string;
  actualDurationMin: number;
  movingDurationMin?: number | null;
  distanceM: number;
  restCount: number;
  restDurationMin: number;
  firstHalfSpeedMPerMin?: number | null;
  secondHalfSpeedMPerMin?: number | null;
  earlyStop: boolean;
  returnedHomeSafely: boolean;
  subjectiveFatigueLevel?: number | null;
  subjectiveEnjoymentLevel?: number | null;
  routePreferenceFeedback?: number | null;
  weatherWbgt?: number | null;
  weatherPrecipitationMmPerH?: number | null;
  weatherTemperatureC?: number | null;
  weatherHumidityPct?: number | null;
};

export type UpdateUserProfileBody = Partial<{
  preferredWalkTimeStart: string | null;
  preferredWalkTimeEnd: string | null;
  mobilitySupportLevel: 0 | 1 | 2;
  slopeToleranceLevel: 0 | 1 | 2;
  heatCautionLevel: 0 | 1 | 2;
  rainCautionLevel: 0 | 1 | 2;
  prefersFixedRoutes: boolean;
}>;
