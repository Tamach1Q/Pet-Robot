import type { WalkHistoryRecord } from "../../types/domain.js";

export interface WalkHistoryRepository {
  create(record: WalkHistoryRecord): Promise<WalkHistoryRecord>;
  listByUserId(userId: string): Promise<WalkHistoryRecord[]>;
}
