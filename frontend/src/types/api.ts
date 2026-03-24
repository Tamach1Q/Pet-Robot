export type UserProfileResponse = {
  status: "ok";
  profile: {
    id: string;
    userId: string;
    preferredWalkTimeStart: string | null;
    preferredWalkTimeEnd: string | null;
    recommendedDurationMin: number;
    maxDurationMin: number;
  };
};

export type CreateWalkHistoryRequest = {
  userId: string;
  routeId: string;
  startedAt: string;
  endedAt: string;
  actualDurationMin: number;
  movingDurationMin: number;
  distanceM: number;
  restCount: number;
  restDurationMin: number;
  firstHalfSpeedMPerMin: number;
  secondHalfSpeedMPerMin: number;
  earlyStop: boolean;
  returnedHomeSafely: boolean;
  subjectiveFatigueLevel: number;
  subjectiveEnjoymentLevel: number;
  routePreferenceFeedback: number;
  weatherWbgt: number;
  weatherPrecipitationMmPerH: number;
  weatherTemperatureC: number;
  weatherHumidityPct: number;
};

export type CreateWalkHistoryResponse = {
  status: "ok";
  walkHistoryId: string;
  loadScore: number;
  profileUpdate: {
    previousRecommendedDurationMin: number;
    nextRecommendedDurationMin: number;
    nextMaxDurationMin: number;
  };
};

export type SuggestWalkRouteResponse = {
  status: "ok";
  recommendedRoute: {
    routeId: string;
    distanceM: number;
    durationMin: number;
    polyline: string;
    coordinates: {
      lat: number;
      lng: number;
    }[];
    waypoints: {
      id: string;
      name: string;
      type: "start" | "checkpoint" | "goal";
      order: number;
      lat: number;
      lng: number;
    }[];
    legs: {
      id: string;
      fromWaypointId: string;
      toWaypointId: string;
      distanceM: number;
      durationMin: number;
      color: string;
      coordinates: {
        lat: number;
        lng: number;
      }[];
    }[];
    reason: string;
    riskLevel: "low" | "medium" | "high";
  };
  alternativeRoute: {
    routeId: string;
    distanceM: number;
    durationMin: number;
    polyline: string;
    coordinates: {
      lat: number;
      lng: number;
    }[];
    waypoints: {
      id: string;
      name: string;
      type: "start" | "checkpoint" | "goal";
      order: number;
      lat: number;
      lng: number;
    }[];
    legs: {
      id: string;
      fromWaypointId: string;
      toWaypointId: string;
      distanceM: number;
      durationMin: number;
      color: string;
      coordinates: {
        lat: number;
        lng: number;
      }[];
    }[];
    reason: string;
    riskLevel: "low" | "medium" | "high";
  } | null;
  decisionContext: {
    wbgt: number;
    precipitationMmPerH: number;
    profileRecommendedDurationMin: number;
    weatherAdjustedDurationMin: number;
  };
};

export type GenerateLoopRouteRequest = {
  currentLocation: {
    lat: number;
    lng: number;
  };
  desiredWalkMinutes: number;
};

export type GenerateLoopRouteResponse = {
  status: "ok";
  route: {
    coordinates: [number, number][];
    totalDistanceMeters: number;
    estimatedDurationSeconds: number;
  };
};
