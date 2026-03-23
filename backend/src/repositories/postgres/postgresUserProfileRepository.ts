import type { Pool } from "pg";
import { NotFoundError } from "../../lib/errors.js";
import type { UserProfile } from "../../types/domain.js";
import type { UserProfileRepository } from "../interfaces/userProfileRepository.js";
import { mapUserProfileRow } from "./postgresMappers.js";

const PATCH_FIELD_TO_COLUMN: Record<string, string> = {
  preferredWalkTimeStart: "preferred_walk_time_start",
  preferredWalkTimeEnd: "preferred_walk_time_end",
  mobilitySupportLevel: "mobility_support_level",
  slopeToleranceLevel: "slope_tolerance_level",
  heatCautionLevel: "heat_caution_level",
  rainCautionLevel: "rain_caution_level",
  prefersFixedRoutes: "prefers_fixed_routes",
  recommendedDurationMin: "recommended_duration_min",
  maxDurationMin: "max_duration_min",
  estimatedSpeedMPerMin: "estimated_speed_m_per_min",
  fatigueIndex: "fatigue_index",
  restTendencyIndex: "rest_tendency_index",
  earlyStopRiskIndex: "early_stop_risk_index",
  explorationPreference: "exploration_preference",
  preferredFeaturesJson: "preferred_features_json",
  lastProfileUpdatedAt: "last_profile_updated_at",
  updatedAt: "updated_at",
};

export class PostgresUserProfileRepository implements UserProfileRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      `
      SELECT *
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapUserProfileRow(result.rows[0]);
  }

  async updateByUserId(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      const current = await this.findByUserId(userId);
      if (!current) {
        throw new NotFoundError(`user_profile not found: ${userId}`);
      }
      return current;
    }

    const values: unknown[] = [userId];
    const setClauses = entries.map(([field, value], index) => {
      const column = PATCH_FIELD_TO_COLUMN[field];

      if (!column) {
        throw new Error(`Unsupported user_profile patch field: ${field}`);
      }

      values.push(value);
      return `${column} = $${index + 2}`;
    });

    if (!entries.some(([field]) => field === "updatedAt")) {
      setClauses.push("updated_at = NOW()");
    }

    const result = await this.pool.query(
      `
      UPDATE user_profiles
      SET ${setClauses.join(", ")}
      WHERE user_id = $1
      RETURNING *
      `,
      values,
    );

    if (result.rowCount === 0) {
      throw new NotFoundError(`user_profile not found: ${userId}`);
    }

    return mapUserProfileRow(result.rows[0]);
  }
}
