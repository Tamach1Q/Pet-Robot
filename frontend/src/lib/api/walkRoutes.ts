import { apiFetch } from "./client";
import type {
  GenerateLoopRouteRequest,
  GenerateLoopRouteResponse,
  SuggestWalkRouteResponse,
} from "@/types/api";

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

export async function generateLoopRoute(input: GenerateLoopRouteRequest) {
  return apiFetch<GenerateLoopRouteResponse>("/api/v1/walk-routes/loop", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
