import { apiFetch } from "./client";
import type { UserProfileResponse } from "@/types/api";

export async function getUserProfile(userId: string) {
  return apiFetch<UserProfileResponse>(`/api/v1/users/${userId}/profile`);
}
