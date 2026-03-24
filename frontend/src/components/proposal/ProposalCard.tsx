"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { suggestWalkRoute } from "@/lib/api/walkRoutes";
import type { SuggestWalkRouteResponse } from "@/types/api";
import { RouteMap } from "./RouteMap";

function waypointChipLabel(
  waypoint: NonNullable<SuggestWalkRouteResponse["recommendedRoute"]>["waypoints"][number],
): string {
  if (waypoint.type === "start") {
    return "出発";
  }

  if (waypoint.type === "goal") {
    return "おうち";
  }

  return String(waypoint.order);
}

export function ProposalCard() {
  const [data, setData] = useState<SuggestWalkRouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await suggestWalkRoute();
        if (mounted) {
          setData(response);
        }
      } catch (_error) {
        if (mounted) {
          setError("おすすめを読み込めませんでした");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const recommendedRoute = data?.recommendedRoute ?? null;
  const alternativeRoute = data?.alternativeRoute ?? null;
  const isFallbackRoute = recommendedRoute?.polyline === "fallback-waypoints-route";
  const primaryHref = recommendedRoute
    ? `/walking?routeId=${recommendedRoute.routeId}&durationMin=${recommendedRoute.durationMin}`
    : "/walking";
  const secondaryHref = alternativeRoute
    ? `/walking?routeId=${alternativeRoute.routeId}&durationMin=${alternativeRoute.durationMin}`
    : "/walking";

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <section
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>きょうのおすすめ</p>
        <h2 style={{ margin: "10px 0 6px", fontSize: "34px", lineHeight: 1.1 }}>
          {loading ? "..." : `${recommendedRoute?.durationMin ?? 0}分`}
        </h2>
        <p style={{ margin: 0, fontSize: "18px", lineHeight: 1.6 }}>
          {loading
            ? "おすすめを読み込み中です"
            : recommendedRoute?.reason ?? "おすすめを表示します"}
        </p>
      </section>

      <section
        style={{
          background: "#f7f1e7",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "10px",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          {recommendedRoute ? (
            <RouteMap
              coordinates={recommendedRoute.coordinates}
              waypoints={recommendedRoute.waypoints}
              legs={recommendedRoute.legs}
            />
          ) : (
            <div
              style={{
                minHeight: "220px",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontWeight: 700,
              }}
            >
              地図を読み込み中です
            </div>
          )}
          {recommendedRoute ? (
            <div
              style={{
                display: "grid",
                gap: "10px",
                padding: "4px 6px 2px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                「出発」から始めて、数字の順に進み、最後は同じ場所に戻ります。
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                {recommendedRoute.waypoints.map((waypoint, index) => (
                  <div
                    key={waypoint.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        minWidth: waypoint.type === "checkpoint" ? "34px" : "60px",
                        padding: waypoint.type === "checkpoint" ? "6px 10px" : "6px 12px",
                        borderRadius: "999px",
                        background:
                          waypoint.type === "start"
                            ? "var(--accent)"
                            : waypoint.type === "goal"
                              ? "#fff"
                              : "#fffaf5",
                        border:
                          waypoint.type === "start"
                            ? "1px solid var(--accent-strong)"
                            : "1px solid var(--line)",
                        color:
                          waypoint.type === "start" ? "#fffaf2" : "var(--accent-strong)",
                        textAlign: "center",
                        fontSize: "14px",
                        fontWeight: 800,
                      }}
                    >
                      {waypointChipLabel(waypoint)}
                    </span>
                    {index < recommendedRoute.waypoints.length - 1 ? (
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        →
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: "12px",
              lineHeight: 1.5,
              textAlign: "right",
            }}
          >
            Map data © OpenStreetMap contributors / Routing © openrouteservice.org
          </p>
        </div>
      </section>

      {error ? (
        <section
          style={{
            background: "#fff",
            border: "1px solid #d9866c",
            borderRadius: "22px",
            padding: "20px",
            color: "#8e4e25",
          }}
        >
          {error}
        </section>
      ) : (
        <>
          {isFallbackRoute ? (
            <section
              style={{
                background: "#fff7eb",
                border: "1px solid #d8a06c",
                borderRadius: "22px",
                padding: "20px",
                color: "#8e4e25",
              }}
            >
              地図APIの経路取得に失敗したため、仮のルートを表示しています。
            </section>
          ) : null}
          <section
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: "22px",
              padding: "20px",
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>りゆう</p>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--muted)", lineHeight: 1.8 }}>
              <li>{recommendedRoute?.reason ?? "その日のようすに合わせて選びました"}</li>
              <li>
                {data
                  ? `おすすめ時間は ${data.decisionContext.weatherAdjustedDurationMin}分です`
                  : "その日の天気を見ています"}
              </li>
              <li>
                {recommendedRoute
                  ? `目印は ${recommendedRoute.waypoints.filter((waypoint) => waypoint.type === "checkpoint").length}か所です`
                  : "歩く順番を整えています"}
              </li>
            </ul>
          </section>
        </>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        <Link href={primaryHref} aria-disabled={!recommendedRoute}>
          <PrimaryButton>このコースでいく</PrimaryButton>
        </Link>
        <Link href={secondaryHref} aria-disabled={!alternativeRoute}>
          <SecondaryButton>
            {alternativeRoute
              ? `${alternativeRoute.durationMin}分のコースにする`
              : "短いコースにする"}
          </SecondaryButton>
        </Link>
        <button
          type="button"
          style={{
            width: "100%",
            border: "none",
            background: "transparent",
            color: "var(--muted)",
            fontSize: "16px",
            padding: "6px 0",
          }}
        >
          今日はやめる
        </button>
      </div>
    </div>
  );
}
