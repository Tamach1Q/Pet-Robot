import type { Pool } from "pg";
import type { WalkHistoryRecord } from "../../types/domain.js";
import type { WalkHistoryRepository } from "../interfaces/walkHistoryRepository.js";
import { mapWalkHistoryRow } from "./postgresMappers.js";

export class PostgresWalkHistoryRepository implements WalkHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async create(record: WalkHistoryRecord): Promise<WalkHistoryRecord> {
    const result = await this.pool.query(
      `
      INSERT INTO walk_history (
        id,
        user_id,
        route_id,
        started_at,
        ended_at,
        actual_duration_min,
        moving_duration_min,
        distance_m,
        rest_count,
        rest_duration_min,
        first_half_speed_m_per_min,
        second_half_speed_m_per_min,
        early_stop,
        returned_home_safely,
        subjective_fatigue_level,
        subjective_enjoyment_level,
        route_preference_feedback,
        weather_wbgt,
        weather_precipitation_mm_per_h,
        weather_temperature_c,
        weather_humidity_pct,
        slowdown_ratio,
        load_score,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING *
      `,
      [
        record.id,
        record.userId,
        record.routeId,
        record.startedAt,
        record.endedAt,
        record.actualDurationMin,
        record.movingDurationMin,
        record.distanceM,
        record.restCount,
        record.restDurationMin,
        record.firstHalfSpeedMPerMin,
        record.secondHalfSpeedMPerMin,
        record.earlyStop,
        record.returnedHomeSafely,
        record.subjectiveFatigueLevel,
        record.subjectiveEnjoymentLevel,
        record.routePreferenceFeedback,
        record.weatherWbgt,
        record.weatherPrecipitationMmPerH,
        record.weatherTemperatureC,
        record.weatherHumidityPct,
        record.slowdownRatio,
        record.loadScore,
        record.createdAt,
      ],
    );

    return mapWalkHistoryRow(result.rows[0]);
  }

  async listByUserId(userId: string): Promise<WalkHistoryRecord[]> {
    const result = await this.pool.query(
      `
      SELECT *
      FROM walk_history
      WHERE user_id = $1
      ORDER BY started_at DESC
      `,
      [userId],
    );

    return result.rows.map(mapWalkHistoryRow);
  }
}
