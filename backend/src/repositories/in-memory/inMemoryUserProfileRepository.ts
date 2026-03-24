import { NotFoundError } from "../../lib/errors.js";
import type { UserProfile } from "../../types/domain.js";
import type { UserProfileRepository } from "../interfaces/userProfileRepository.js";

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();

  constructor() {
    const now = new Date().toISOString();

    this.profiles.set("11111111-1111-1111-1111-111111111111", {
      id: "22222222-2222-2222-2222-222222222222",
      userId: "11111111-1111-1111-1111-111111111111",
      preferredWalkTimeStart: "07:00",
      preferredWalkTimeEnd: "10:00",
      mobilitySupportLevel: 0,
      slopeToleranceLevel: 1,
      heatCautionLevel: 2,
      rainCautionLevel: 2,
      prefersFixedRoutes: true,
      recommendedDurationMin: 8,
      maxDurationMin: 12,
      estimatedSpeedMPerMin: 50,
      fatigueIndex: 0.2,
      restTendencyIndex: 0.2,
      earlyStopRiskIndex: 0.1,
      explorationPreference: 0.2,
      preferredFeaturesJson: {
        shade: 0.8,
        familiar_route: 0.9,
        quiet_street: 0.7,
      },
      lastProfileUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async updateByUserId(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const existing = this.profiles.get(userId);

    if (!existing) {
      throw new NotFoundError(`user_profile not found: ${userId}`);
    }

    const next: UserProfile = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(userId, next);
    return next;
  }
}
