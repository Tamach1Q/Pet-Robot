import { randomUUID } from "node:crypto";
import { NotFoundError } from "../lib/errors.js";
import type { UserProfile, WalkHistoryRecord } from "../types/domain.js";
import type { CreateWalkHistoryBody } from "../types/api.js";
import type { UserProfileRepository } from "../repositories/interfaces/userProfileRepository.js";
import type { WalkHistoryRepository } from "../repositories/interfaces/walkHistoryRepository.js";

type LoadScoreMetrics = {
  restRatio: number;
  slowdownRatio: number;
  subjectiveFatigueNormalized: number;
  earlyStopFlag: number;
  loadScore: number;
};

type PersonalizationResult = {
  walkHistory: WalkHistoryRecord;
  previousRecommendedDurationMin: number;
  nextProfile: UserProfile;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function deriveSlowdownRatio(
  firstHalfSpeedMPerMin: number | null | undefined,
  secondHalfSpeedMPerMin: number | null | undefined,
): number {
  if (!firstHalfSpeedMPerMin || !secondHalfSpeedMPerMin || firstHalfSpeedMPerMin <= 0) {
    return 0;
  }

  return clamp(1 - secondHalfSpeedMPerMin / firstHalfSpeedMPerMin, 0, 1);
}

function calculateLoadScore(input: CreateWalkHistoryBody): LoadScoreMetrics {
  const restRatio = input.actualDurationMin <= 0
    ? 1
    : clamp(input.restDurationMin / input.actualDurationMin, 0, 1);

  const slowdownRatio = deriveSlowdownRatio(
    input.firstHalfSpeedMPerMin,
    input.secondHalfSpeedMPerMin,
  );
  const subjectiveFatigueNormalized = clamp((input.subjectiveFatigueLevel ?? 2) / 5, 0, 1);
  const earlyStopFlag = input.earlyStop ? 1 : 0;

  const loadScore = clamp(
    round2(
      restRatio * 0.35 +
      slowdownRatio * 0.25 +
      subjectiveFatigueNormalized * 0.25 +
      earlyStopFlag * 0.15,
    ),
    0,
    1,
  );

  return {
    restRatio: round2(restRatio),
    slowdownRatio: round2(slowdownRatio),
    subjectiveFatigueNormalized: round2(subjectiveFatigueNormalized),
    earlyStopFlag,
    loadScore,
  };
}

function updateRecommendedDuration(currentRecommendedDurationMin: number, loadScore: number): number {
  if (loadScore <= 0.2) {
    return clamp(currentRecommendedDurationMin + 2, 5, 15);
  }

  if (loadScore <= 0.45) {
    return currentRecommendedDurationMin;
  }

  return clamp(currentRecommendedDurationMin - 2, 5, 15);
}

export class PersonalizationService {
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly walkHistoryRepository: WalkHistoryRepository,
  ) {}

  async createWalkHistoryAndUpdateProfile(input: CreateWalkHistoryBody): Promise<PersonalizationResult> {
    const profile = await this.userProfileRepository.findByUserId(input.userId);

    if (!profile) {
      throw new NotFoundError(`user_profile not found: ${input.userId}`);
    }

    const metrics = calculateLoadScore(input);
    const previousRecommendedDurationMin = profile.recommendedDurationMin;
    const nextRecommendedDurationMin = updateRecommendedDuration(
      profile.recommendedDurationMin,
      metrics.loadScore,
    );

    const nextProfile = await this.userProfileRepository.updateByUserId(input.userId, {
      recommendedDurationMin: nextRecommendedDurationMin,
      maxDurationMin: Math.min(nextRecommendedDurationMin + 4, 20),
      fatigueIndex: round2(clamp(profile.fatigueIndex * 0.6 + metrics.loadScore * 0.4, 0, 1)),
      restTendencyIndex: round2(clamp(profile.restTendencyIndex * 0.7 + metrics.restRatio * 0.3, 0, 1)),
      earlyStopRiskIndex: round2(clamp(profile.earlyStopRiskIndex * 0.8 + metrics.earlyStopFlag * 0.2, 0, 1)),
      estimatedSpeedMPerMin: input.actualDurationMin > 0
        ? Math.round(input.distanceM / input.actualDurationMin)
        : profile.estimatedSpeedMPerMin,
      lastProfileUpdatedAt: new Date().toISOString(),
    });

    const walkHistory: WalkHistoryRecord = await this.walkHistoryRepository.create({
      id: randomUUID(),
      userId: input.userId,
      routeId: input.routeId ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      actualDurationMin: input.actualDurationMin,
      movingDurationMin: input.movingDurationMin ?? null,
      distanceM: input.distanceM,
      restCount: input.restCount,
      restDurationMin: input.restDurationMin,
      firstHalfSpeedMPerMin: input.firstHalfSpeedMPerMin ?? null,
      secondHalfSpeedMPerMin: input.secondHalfSpeedMPerMin ?? null,
      earlyStop: input.earlyStop,
      returnedHomeSafely: input.returnedHomeSafely,
      subjectiveFatigueLevel: input.subjectiveFatigueLevel ?? null,
      subjectiveEnjoymentLevel: input.subjectiveEnjoymentLevel ?? null,
      routePreferenceFeedback: input.routePreferenceFeedback ?? null,
      weatherWbgt: input.weatherWbgt ?? null,
      weatherPrecipitationMmPerH: input.weatherPrecipitationMmPerH ?? null,
      weatherTemperatureC: input.weatherTemperatureC ?? null,
      weatherHumidityPct: input.weatherHumidityPct ?? null,
      slowdownRatio: metrics.slowdownRatio,
      loadScore: metrics.loadScore,
      createdAt: new Date().toISOString(),
    });

    return {
      walkHistory,
      previousRecommendedDurationMin,
      nextProfile,
    };
  }
}
