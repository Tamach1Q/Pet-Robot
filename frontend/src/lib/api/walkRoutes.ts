import { apiFetch } from "./client";
import type { SuggestWalkRouteResponse } from "@/types/api";

export async function suggestWalkRoute() {
  return apiFetch<SuggestWalkRouteResponse>("/api/v1/walk-routes/suggest", {
    method: "POST",
    body: JSON.stringify({
      userId: "11111111-1111-1111-1111-111111111111",
      robotId: "robot-001",
      currentLocation: {
        lat: 35.67336,
        lng: 139.7591,
      },
      requestedAt: "2026-03-23T08:00:00+09:00",
    }),
  });
}
