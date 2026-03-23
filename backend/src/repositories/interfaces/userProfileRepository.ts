import type { UserProfile } from "../../types/domain.js";

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  updateByUserId(userId: string, patch: Partial<UserProfile>): Promise<UserProfile>;
}
