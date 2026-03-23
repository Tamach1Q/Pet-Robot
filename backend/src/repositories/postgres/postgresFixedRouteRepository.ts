import type { Pool } from "pg";
import type { FixedRoute } from "../../types/domain.js";
import type { FixedRouteRepository } from "../interfaces/fixedRouteRepository.js";
import { mapFixedRouteRow } from "./postgresMappers.js";

export class PostgresFixedRouteRepository implements FixedRouteRepository {
  constructor(private readonly pool: Pool) {}

  async listByUserId(userId: string): Promise<FixedRoute[]> {
    const result = await this.pool.query(
      `
      SELECT *
      FROM fixed_routes
      WHERE user_id = $1
      ORDER BY duration_min ASC, created_at ASC
      `,
      [userId],
    );

    return result.rows.map(mapFixedRouteRow);
  }
}
