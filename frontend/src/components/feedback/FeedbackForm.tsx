"use client";

import { useMemo, useState } from "react";
import { RatingSelector } from "@/components/ui/RatingSelector";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { createWalkHistory } from "@/lib/api/walkHistory";

function toFiveScale(value: string | null): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

function toRouteFeedback(value: string | null): number | null {
  if (!value) {
    return null;
  }

  if (value === "よい") {
    return 5;
  }

  if (value === "ふつう") {
    return 3;
  }

  return 1;
}

export function FeedbackForm() {
  const [fatigue, setFatigue] = useState<string | null>(null);
  const [enjoyment, setEnjoyment] = useState<string | null>(null);
  const [routeFeedback, setRouteFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(fatigue && enjoyment && routeFeedback) && !submitting;
  }, [enjoyment, fatigue, routeFeedback, submitting]);

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - 8 * 60 * 1000);

    try {
      const response = await createWalkHistory({
        userId: "11111111-1111-1111-1111-111111111111",
        routeId: "fixed-route-001",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        actualDurationMin: 8,
        movingDurationMin: 7,
        distanceM: 430,
        restCount: 1,
        restDurationMin: 1,
        firstHalfSpeedMPerMin: 56,
        secondHalfSpeedMPerMin: 48,
        earlyStop: false,
        returnedHomeSafely: true,
        subjectiveFatigueLevel: toFiveScale(fatigue) ?? 3,
        subjectiveEnjoymentLevel: toFiveScale(enjoyment) ?? 3,
        routePreferenceFeedback: toRouteFeedback(routeFeedback) ?? 3,
        weatherWbgt: 24.1,
        weatherPrecipitationMmPerH: 0.0,
        weatherTemperatureC: 21.5,
        weatherHumidityPct: 58.0,
      });

      setMessage(`記録しました。つぎのおすすめは ${response.profileUpdate.nextRecommendedDurationMin}分です。`);
    } catch (_error) {
      setMessage("送信に失敗しました。もう一度ためしてください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <section
        style={{
          display: "grid",
          gap: "10px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>つかれましたか</p>
        <RatingSelector
          labels={["1", "2", "3", "4", "5"]}
          selectedLabel={fatigue}
          onSelect={setFatigue}
        />
      </section>

      <section
        style={{
          display: "grid",
          gap: "10px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>たのしかったですか</p>
        <RatingSelector
          labels={["1", "2", "3", "4", "5"]}
          selectedLabel={enjoyment}
          onSelect={setEnjoyment}
        />
      </section>

      <section
        style={{
          display: "grid",
          gap: "10px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>この道はどうでしたか</p>
        <RatingSelector
          labels={["よい", "ふつう", "いまいち"]}
          selectedLabel={routeFeedback}
          onSelect={setRouteFeedback}
        />
      </section>

      {message ? (
        <section
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "18px",
            padding: "16px",
            color: "var(--muted)",
            lineHeight: 1.7,
          }}
        >
          {message}
        </section>
      ) : null}

      <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
        {submitting ? "送信中..." : "送信する"}
      </PrimaryButton>
    </div>
  );
}
