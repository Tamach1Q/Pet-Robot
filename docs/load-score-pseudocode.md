# load_score 計算と user_profile 更新の疑似コード

以下は TypeScript 風の疑似コード。

目的は、散歩 1 回分の `walk_history` 入力から `load_score` を計算し、その結果で `user_profiles` を更新すること。

## 前提

- `load_score` は `0.0` から `1.0`
- 値が大きいほど「今回の散歩負荷が高かった」とみなす
- 更新は必ず安全側に倒す
- 天候要因は本人能力と分けて扱い、最後に提案時間へ補正をかける

## 型定義

```ts
type WalkHistoryInput = {
  userId: string;
  routeId?: string;
  startedAt: string;
  endedAt: string;
  actualDurationMin: number;
  movingDurationMin?: number | null;
  distanceM: number;
  restCount: number;
  restDurationMin: number;
  avgSpeedMPerMin?: number | null;
  firstHalfSpeedMPerMin?: number | null;
  secondHalfSpeedMPerMin?: number | null;
  slowdownRatio?: number | null;
  earlyStop: boolean;
  earlyStopReasonCode?: string | null;
  returnedHomeSafely: boolean;
  subjectiveFatigueLevel?: number | null; // 1-5
  subjectiveEnjoymentLevel?: number | null; // 1-5
  routePreferenceFeedback?: number | null; // 1-5
  freeComment?: string | null;
  weatherWbgt?: number | null;
  weatherPrecipitationMmPerH?: number | null;
  weatherTemperatureC?: number | null;
  weatherHumidityPct?: number | null;
};

type UserProfile = {
  userId: string;
  recommendedDurationMin: number;
  maxDurationMin: number;
  estimatedSpeedMPerMin: number;
  fatigueIndex: number; // 0.0 - 1.0
  restTendencyIndex: number; // 0.0 - 1.0
  earlyStopRiskIndex: number; // 0.0 - 1.0
  explorationPreference: number; // 0.0 - 1.0
  preferredFeaturesJson: Record<string, number>;
  heatCautionLevel: 0 | 1 | 2;
  rainCautionLevel: 0 | 1 | 2;
};

type CalculatedMetrics = {
  restRatio: number;
  slowdownRatio: number;
  subjectiveFatigueNormalized: number;
  earlyStopFlag: number;
  safetyPenalty: number;
  loadScore: number;
};

type UpdatedProfileResult = {
  loadScore: number;
  nextRecommendedDurationMin: number;
  nextMaxDurationMin: number;
  nextEstimatedSpeedMPerMin: number;
  nextFatigueIndex: number;
  nextRestTendencyIndex: number;
  nextEarlyStopRiskIndex: number;
  weatherAdjustedDurationMin: number;
};
```

## 補助関数

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeFatigue(subjectiveFatigueLevel?: number | null): number {
  if (subjectiveFatigueLevel == null) {
    return 0.4;
  }

  return clamp(subjectiveFatigueLevel / 5, 0.0, 1.0);
}

function deriveSlowdownRatio(
  firstHalfSpeedMPerMin?: number | null,
  secondHalfSpeedMPerMin?: number | null,
  slowdownRatio?: number | null,
): number {
  if (slowdownRatio != null) {
    return clamp(slowdownRatio, 0.0, 1.0);
  }

  if (
    firstHalfSpeedMPerMin == null ||
    secondHalfSpeedMPerMin == null ||
    firstHalfSpeedMPerMin <= 0
  ) {
    return 0.0;
  }

  const raw = 1 - secondHalfSpeedMPerMin / firstHalfSpeedMPerMin;
  return clamp(raw, 0.0, 1.0);
}

function deriveRestRatio(actualDurationMin: number, restDurationMin: number): number {
  if (actualDurationMin <= 0) {
    return 1.0;
  }

  return clamp(restDurationMin / actualDurationMin, 0.0, 1.0);
}
```

## load_score 計算

```ts
function calculateLoadScore(input: WalkHistoryInput): CalculatedMetrics {
  const restRatio = deriveRestRatio(input.actualDurationMin, input.restDurationMin);
  const derivedSlowdownRatio = deriveSlowdownRatio(
    input.firstHalfSpeedMPerMin,
    input.secondHalfSpeedMPerMin,
    input.slowdownRatio,
  );
  const subjectiveFatigueNormalized = normalizeFatigue(input.subjectiveFatigueLevel);
  const earlyStopFlag = input.earlyStop ? 1.0 : 0.0;

  // 本人負荷に加えて、安全上の問題があれば小さな加点を入れる
  const safetyPenalty = input.returnedHomeSafely ? 0.0 : 0.2;

  const loadScoreRaw =
    restRatio * 0.35 +
    derivedSlowdownRatio * 0.25 +
    subjectiveFatigueNormalized * 0.25 +
    earlyStopFlag * 0.15 +
    safetyPenalty;

  const loadScore = clamp(round2(loadScoreRaw), 0.0, 1.0);

  return {
    restRatio: round2(restRatio),
    slowdownRatio: round2(derivedSlowdownRatio),
    subjectiveFatigueNormalized: round2(subjectiveFatigueNormalized),
    earlyStopFlag,
    safetyPenalty: round2(safetyPenalty),
    loadScore,
  };
}
```

## 推奨歩行時間の更新

```ts
function updateRecommendedDuration(
  currentRecommendedDurationMin: number,
  loadScore: number,
): number {
  if (loadScore <= 0.2) {
    return clamp(currentRecommendedDurationMin + 2, 5, 15);
  }

  if (loadScore <= 0.45) {
    return clamp(currentRecommendedDurationMin, 5, 15);
  }

  return clamp(currentRecommendedDurationMin - 2, 5, 15);
}
```

## 歩行速度と各種 index の更新

```ts
function updateEstimatedSpeed(
  previousEstimatedSpeedMPerMin: number,
  input: WalkHistoryInput,
): number {
  const observedSpeed =
    input.avgSpeedMPerMin ??
    (input.actualDurationMin > 0
      ? Math.round(input.distanceM / input.actualDurationMin)
      : previousEstimatedSpeedMPerMin);

  const smoothed =
    previousEstimatedSpeedMPerMin * 0.7 +
    observedSpeed * 0.3;

  return Math.round(clamp(smoothed, 10, 150));
}

function updateFatigueIndex(previousFatigueIndex: number, loadScore: number): number {
  return round2(clamp(previousFatigueIndex * 0.6 + loadScore * 0.4, 0.0, 1.0));
}

function updateRestTendencyIndex(
  previousRestTendencyIndex: number,
  restRatio: number,
): number {
  return round2(clamp(previousRestTendencyIndex * 0.7 + restRatio * 0.3, 0.0, 1.0));
}

function updateEarlyStopRiskIndex(
  previousEarlyStopRiskIndex: number,
  earlyStopFlag: number,
): number {
  return round2(clamp(previousEarlyStopRiskIndex * 0.8 + earlyStopFlag * 0.2, 0.0, 1.0));
}
```

## 天候補正

```ts
function calculateWeatherReductionRate(profile: UserProfile, input: WalkHistoryInput): number {
  let reductionRate = 0.0;

  if (input.weatherWbgt != null) {
    if (input.weatherWbgt >= 31) {
      return 1.0;
    }

    if (input.weatherWbgt >= 28) {
      reductionRate = Math.max(reductionRate, 0.3);
    } else if (input.weatherWbgt >= 25) {
      reductionRate = Math.max(reductionRate, 0.15);
    }
  }

  if (input.weatherPrecipitationMmPerH != null) {
    if (input.weatherPrecipitationMmPerH >= 3) {
      return 1.0;
    }

    if (input.weatherPrecipitationMmPerH >= 1) {
      reductionRate = Math.max(reductionRate, 0.2);
    }
  }

  if (profile.heatCautionLevel === 2 && reductionRate > 0) {
    reductionRate += 0.1;
  }

  if (profile.rainCautionLevel === 2 && input.weatherPrecipitationMmPerH != null && input.weatherPrecipitationMmPerH >= 1) {
    reductionRate += 0.1;
  }

  return clamp(reductionRate, 0.0, 1.0);
}
```

## user_profile 更新フロー

```ts
function updateUserProfileAfterWalk(
  profile: UserProfile,
  input: WalkHistoryInput,
): UpdatedProfileResult {
  const metrics = calculateLoadScore(input);

  const nextRecommendedDurationMin = updateRecommendedDuration(
    profile.recommendedDurationMin,
    metrics.loadScore,
  );

  const nextMaxDurationMin = clamp(nextRecommendedDurationMin + 4, 8, 20);

  const nextEstimatedSpeedMPerMin = updateEstimatedSpeed(
    profile.estimatedSpeedMPerMin,
    input,
  );

  const nextFatigueIndex = updateFatigueIndex(
    profile.fatigueIndex,
    metrics.loadScore,
  );

  const nextRestTendencyIndex = updateRestTendencyIndex(
    profile.restTendencyIndex,
    metrics.restRatio,
  );

  const nextEarlyStopRiskIndex = updateEarlyStopRiskIndex(
    profile.earlyStopRiskIndex,
    metrics.earlyStopFlag,
  );

  const fatigueReductionRate = nextFatigueIndex * 0.3;
  const weatherReductionRate = calculateWeatherReductionRate(profile, input);
  const totalReductionRate = clamp(fatigueReductionRate + weatherReductionRate, 0.0, 1.0);

  const weatherAdjustedDurationMin =
    totalReductionRate >= 1.0
      ? 0
      : Math.max(
          0,
          Math.floor(nextRecommendedDurationMin * (1 - totalReductionRate)),
        );

  return {
    loadScore: metrics.loadScore,
    nextRecommendedDurationMin,
    nextMaxDurationMin,
    nextEstimatedSpeedMPerMin,
    nextFatigueIndex,
    nextRestTendencyIndex,
    nextEarlyStopRiskIndex,
    weatherAdjustedDurationMin,
  };
}
```

## 永続化フロー

```ts
async function handleWalkCompleted(input: WalkHistoryInput): Promise<void> {
  const profile = await userProfileRepository.findByUserId(input.userId);

  const result = updateUserProfileAfterWalk(profile, input);

  await db.transaction(async (tx) => {
    await walkHistoryRepository.insert(tx, {
      ...input,
      slowdownRatio: deriveSlowdownRatio(
        input.firstHalfSpeedMPerMin,
        input.secondHalfSpeedMPerMin,
        input.slowdownRatio,
      ),
      loadScore: result.loadScore,
    });

    await userProfileRepository.updateByUserId(tx, input.userId, {
      recommendedDurationMin: result.nextRecommendedDurationMin,
      maxDurationMin: result.nextMaxDurationMin,
      estimatedSpeedMPerMin: result.nextEstimatedSpeedMPerMin,
      fatigueIndex: result.nextFatigueIndex,
      restTendencyIndex: result.nextRestTendencyIndex,
      earlyStopRiskIndex: result.nextEarlyStopRiskIndex,
      lastProfileUpdatedAt: new Date().toISOString(),
    });
  });
}
```

## 散歩提案での使い方

```ts
function decideTodaySuggestedDuration(profile: UserProfile, weather: {
  wbgt?: number | null;
  precipitationMmPerH?: number | null;
}): number {
  const reductionRate = calculateWeatherReductionRate(profile, {
    userId: profile.userId,
    startedAt: '',
    endedAt: '',
    actualDurationMin: profile.recommendedDurationMin,
    distanceM: 0,
    restCount: 0,
    restDurationMin: 0,
    earlyStop: false,
    returnedHomeSafely: true,
    weatherWbgt: weather.wbgt,
    weatherPrecipitationMmPerH: weather.precipitationMmPerH,
  });

  const fatigueReductionRate = profile.fatigueIndex * 0.3;
  const totalReductionRate = clamp(reductionRate + fatigueReductionRate, 0.0, 1.0);

  if (totalReductionRate >= 1.0) {
    return 0;
  }

  return Math.max(
    5,
    Math.floor(profile.recommendedDurationMin * (1 - totalReductionRate)),
  );
}
```

## 実装上の注意

- `subjectiveFatigueLevel` が未入力でも動くようにデフォルト値を持つ
- `load_score` は説明可能な重み付き和にしておく
- 更新幅は `±2分` に固定し、急に長くしない
- `WBGT 31以上` や `降水量 3mm/h 以上` は更新以前に「中止」判定を優先する
- LLM は `free_comment` の要約や `route_preference_feedback` 補助には使えるが、`load_score` 本体の計算には使わない
