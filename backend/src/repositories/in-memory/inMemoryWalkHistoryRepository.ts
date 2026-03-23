import type { WalkHistoryRecord } from "../../types/domain.js";
import type { WalkHistoryRepository } from "../interfaces/walkHistoryRepository.js";

export class InMemoryWalkHistoryRepository implements WalkHistoryRepository {
  private readonly records: WalkHistoryRecord[] = [];

  async create(record: WalkHistoryRecord): Promise<WalkHistoryRecord> {
    this.records.unshift(record);
    return record;
  }

  async listByUserId(userId: string): Promise<WalkHistoryRecord[]> {
    return this.records.filter((record) => record.userId === userId);
  }
}
