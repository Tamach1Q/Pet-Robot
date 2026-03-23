import type { QueryResultRow } from "pg";
import type { FixedRoute, RouteCoordinate, UserProfile, WalkHistoryRecord } from "../../types/domain.js";

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  return Number(value);
}

export function mapUserProfileRow(row: QueryResultRow): UserProfile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    preferredWalkTimeStart: row.preferred_walk_time_start ? String(row.preferred_walk_time_start) : null,
    preferredWalkTimeEnd: row.preferred_walk_time_end ? String(row.preferred_walk_time_end) : null,
    mobilitySupportLevel: toNumber(row.mobility_support_level) as 0 | 1 | 2,
    slopeToleranceLevel: toNumber(row.slope_tolerance_level) as 0 | 1 | 2,
    heatCautionLevel: toNumber(row.heat_caution_level) as 0 | 1 | 2,
    rainCautionLevel: toNumber(row.rain_caution_level) as 0 | 1 | 2,
    prefersFixedRoutes: Boolean(row.prefers_fixed_routes),
    recommendedDurationMin: toNumber(row.recommended_duration_min),
    maxDurationMin: toNumber(row.max_duration_min),
    estimatedSpeedMPerMin: toNumber(row.estimated_speed_m_per_min),
    fatigueIndex: toNumber(row.fatigue_index),
    restTendencyIndex: toNumber(row.rest_tendency_index),
    earlyStopRiskIndex: toNumber(row.early_stop_risk_index),
    explorationPreference: toNumber(row.exploration_preference),
    preferredFeaturesJson: (row.preferred_features_json ?? {}) as Record<string, number>,
    lastProfileUpdatedAt: new Date(row.last_profile_updated_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapWalkHistoryRow(row: QueryResultRow): WalkHistoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    routeId: row.route_id ? String(row.route_id) : null,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: new Date(row.ended_at).toISOString(),
    actualDurationMin: toNumber(row.actual_duration_min),
    movingDurationMin: row.moving_duration_min == null ? null : toNumber(row.moving_duration_min),
    distanceM: toNumber(row.distance_m),
    restCount: toNumber(row.rest_count),
    restDurationMin: toNumber(row.rest_duration_min),
    firstHalfSpeedMPerMin: row.first_half_speed_m_per_min == null ? null : toNumber(row.first_half_speed_m_per_min),
    secondHalfSpeedMPerMin: row.second_half_speed_m_per_min == null ? null : toNumber(row.second_half_speed_m_per_min),
    earlyStop: Boolean(row.early_stop),
    returnedHomeSafely: Boolean(row.returned_home_safely),
    subjectiveFatigueLevel: row.subjective_fatigue_level == null ? null : toNumber(row.subjective_fatigue_level),
    subjectiveEnjoymentLevel: row.subjective_enjoyment_level == null ? null : toNumber(row.subjective_enjoyment_level),
    routePreferenceFeedback: row.route_preference_feedback == null ? null : toNumber(row.route_preference_feedback),
    weatherWbgt: row.weather_wbgt == null ? null : toNumber(row.weather_wbgt),
    weatherPrecipitationMmPerH: row.weather_precipitation_mm_per_h == null ? null : toNumber(row.weather_precipitation_mm_per_h),
    weatherTemperatureC: row.weather_temperature_c == null ? null : toNumber(row.weather_temperature_c),
    weatherHumidityPct: row.weather_humidity_pct == null ? null : toNumber(row.weather_humidity_pct),
    slowdownRatio: row.slowdown_ratio == null ? null : toNumber(row.slowdown_ratio),
    loadScore: row.load_score == null ? null : toNumber(row.load_score),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapFixedRouteRow(row: QueryResultRow): FixedRoute {
  const coordinates =
    Array.isArray(row.coordinates_json)
      ? row.coordinates_json.map((point: unknown): RouteCoordinate => {
          const pair = point as [number, number];
          return {
            lat: Number(pair[0]),
            lng: Number(pair[1]),
          };
        })
      : [];

  return {
    routeId: String(row.route_id),
    name: String(row.name),
    distanceM: toNumber(row.distance_m),
    durationMin: toNumber(row.duration_min),
    tags: Array.isArray(row.tags_json) ? row.tags_json.map((tag) => String(tag)) : [],
    polyline: String(row.polyline),
    waypoints: coordinates,
  };
}
