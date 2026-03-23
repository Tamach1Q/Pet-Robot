import type {
  FixedRoute,
  RouteCoordinate,
  RouteWaypoint,
  SuggestedRoute,
  UserProfile,
  WeatherSnapshot,
} from "../types/domain.js";
import type { SuggestWalkRouteBody } from "../types/api.js";
import type { FixedRouteRepository } from "../repositories/interfaces/fixedRouteRepository.js";
import type { UserProfileRepository } from "../repositories/interfaces/userProfileRepository.js";
import type { WalkHistoryRepository } from "../repositories/interfaces/walkHistoryRepository.js";
import { NotFoundError } from "../lib/errors.js";
import { RoutingService } from "./routingService.js";
import { WeatherService } from "./weatherService.js";

type SuggestionResult = {
  recommendedRoute: SuggestedRoute;
  alternativeRoute: SuggestedRoute | null;
  decisionContext: {
    wbgt: number;
    precipitationMmPerH: number;
    profileRecommendedDurationMin: number;
    weatherAdjustedDurationMin: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function calculateWeatherAdjustedDuration(profile: UserProfile, weather: WeatherSnapshot): number {
  let reductionRate = profile.fatigueIndex * 0.3;

  if (weather.wbgt >= 31 || weather.precipitationMmPerH >= 3) {
    return 0;
  }

  if (weather.wbgt >= 28) {
    reductionRate += 0.3;
  } else if (weather.wbgt >= 25) {
    reductionRate += 0.15;
  }

  if (weather.precipitationMmPerH >= 1) {
    reductionRate += 0.2;
  }

  if (profile.heatCautionLevel === 2 && weather.wbgt >= 25) {
    reductionRate += 0.1;
  }

  if (profile.rainCautionLevel === 2 && weather.precipitationMmPerH >= 1) {
    reductionRate += 0.1;
  }

  return Math.max(
    5,
    Math.floor(profile.recommendedDurationMin * (1 - clamp(reductionRate, 0, 1))),
  );
}

function buildReason(profile: UserProfile, weather: WeatherSnapshot, route: FixedRoute, adjustedDuration: number): string {
  if (adjustedDuration === 0) {
    return "天候リスクが高いため散歩は中止推奨です";
  }

  if (weather.wbgt >= 25) {
    return "暑さを考慮して短めの定番コースを提案";
  }

  if (weather.precipitationMmPerH >= 1) {
    return "雨を考慮して短く戻りやすいコースを提案";
  }

  if (profile.prefersFixedRoutes) {
    return "定番コースを好む設定に合わせて提案";
  }

  return `${route.name} を今日の散歩候補として提案`;
}

function buildRouteWaypoints(route: FixedRoute, currentLocation: RouteCoordinate): RouteWaypoint[] {
  const checkpoints = route.waypoints.map((point, index) => ({
    id: `${route.routeId}-checkpoint-${index + 1}`,
    name: `ポイント${index + 1}`,
    type: "checkpoint" as const,
    order: index + 1,
    lat: point.lat,
    lng: point.lng,
  }));

  return [
    {
      id: `${route.routeId}-start`,
      name: "しゅっぱつ",
      type: "start",
      order: 0,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    },
    ...checkpoints,
    {
      id: `${route.routeId}-goal`,
      name: "おうち",
      type: "goal",
      order: checkpoints.length + 1,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    },
  ];
}

function toSuggestedRoute(
  route: FixedRoute,
  generatedRoute: {
    coordinates: RouteCoordinate[];
    waypoints: RouteWaypoint[];
    legs: SuggestedRoute["legs"];
    distanceM: number;
    durationMin: number;
    polyline: string;
  },
  profile: UserProfile,
  weather: WeatherSnapshot,
  adjustedDuration: number,
): SuggestedRoute {
  return {
    routeId: route.routeId,
    distanceM: generatedRoute.distanceM || route.distanceM,
    durationMin: generatedRoute.durationMin || route.durationMin,
    polyline: generatedRoute.polyline,
    coordinates: generatedRoute.coordinates,
    waypoints: generatedRoute.waypoints,
    legs: generatedRoute.legs,
    reason: buildReason(profile, weather, route, adjustedDuration),
    riskLevel:
      adjustedDuration === 0
        ? "high"
        : (generatedRoute.durationMin || route.durationMin) > adjustedDuration
          ? "medium"
          : "low",
  };
}

export class RouteSuggestionService {
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly walkHistoryRepository: WalkHistoryRepository,
    private readonly fixedRouteRepository: FixedRouteRepository,
    private readonly weatherService: WeatherService,
    private readonly routingService: RoutingService,
  ) {}

  async suggestRoute(input: SuggestWalkRouteBody): Promise<SuggestionResult> {
    const [profile, fixedRoutes, weather] = await Promise.all([
      this.userProfileRepository.findByUserId(input.userId),
      this.fixedRouteRepository.listByUserId(input.userId),
      this.weatherService.getCurrentWeather(),
    ]);

    if (!profile) {
      throw new NotFoundError(`user_profile not found: ${input.userId}`);
    }

    await this.walkHistoryRepository.listByUserId(input.userId);

    const weatherAdjustedDurationMin = calculateWeatherAdjustedDuration(profile, weather);
    const targetDuration = weatherAdjustedDurationMin === 0 ? 5 : weatherAdjustedDurationMin;

    const sortedRoutes = [...fixedRoutes].sort((a, b) => {
      const scoreA = Math.abs(a.durationMin - targetDuration);
      const scoreB = Math.abs(b.durationMin - targetDuration);
      return scoreA - scoreB;
    });

    if (sortedRoutes.length === 0) {
      throw new NotFoundError(`fixed_routes not found: ${input.userId}`);
    }

    const recommended = sortedRoutes[0];
    const alternative = sortedRoutes[1] ?? null;
    const currentLocation: RouteCoordinate = {
      lat: input.currentLocation.lat,
      lng: input.currentLocation.lng,
    };
    const recommendedWaypoints = buildRouteWaypoints(recommended, currentLocation);
    const alternativeWaypoints = alternative
      ? buildRouteWaypoints(alternative, currentLocation)
      : null;

    const [recommendedGeneratedRoute, alternativeGeneratedRoute] = await Promise.all([
      this.routingService.generateWalkingLoop({
        routeId: recommended.routeId,
        waypoints: recommendedWaypoints,
      }),
      alternative
        ? this.routingService.generateWalkingLoop({
            routeId: alternative.routeId,
            waypoints: alternativeWaypoints!,
          })
        : Promise.resolve(null),
    ]);

    return {
      recommendedRoute: toSuggestedRoute(
        recommended,
        recommendedGeneratedRoute,
        profile,
        weather,
        weatherAdjustedDurationMin,
      ),
      alternativeRoute: alternative
        ? toSuggestedRoute(
            alternative,
            alternativeGeneratedRoute!,
            profile,
            weather,
            weatherAdjustedDurationMin,
          )
        : null,
      decisionContext: {
        wbgt: weather.wbgt,
        precipitationMmPerH: weather.precipitationMmPerH,
        profileRecommendedDurationMin: profile.recommendedDurationMin,
        weatherAdjustedDurationMin,
      },
    };
  }
}
