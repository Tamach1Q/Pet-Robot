import { apiFetch } from "./client";
import type { CreateWalkHistoryRequest, CreateWalkHistoryResponse } from "@/types/api";

export async function createWalkHistory(payload: CreateWalkHistoryRequest) {
  return apiFetch<CreateWalkHistoryResponse>("/api/v1/walk-history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
