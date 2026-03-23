import type { FixedRoute } from "../../types/domain.js";

export interface FixedRouteRepository {
  listByUserId(userId: string): Promise<FixedRoute[]>;
}
