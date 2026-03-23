import { NotFoundError } from "../lib/errors.js";
import type { UserProfile } from "../types/domain.js";
import type { UserProfileRepository } from "../repositories/interfaces/userProfileRepository.js";

export class UserProfileService {
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.userProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundError(`user_profile not found: ${userId}`);
    }

    return profile;
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    return this.userProfileRepository.updateByUserId(userId, patch);
  }
}
