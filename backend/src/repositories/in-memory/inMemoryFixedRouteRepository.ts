import type { FixedRoute } from "../../types/domain.js";
import type { FixedRouteRepository } from "../interfaces/fixedRouteRepository.js";

export class InMemoryFixedRouteRepository implements FixedRouteRepository {
  private readonly routes: FixedRoute[] = [
    {
      routeId: "fixed-route-001",
      name: "短距離の定番コース",
      distanceM: 650,
      durationMin: 8,
      tags: ["fixed", "shade", "quiet_street"],
      polyline: "tokyo-station-short-loop",
      waypoints: [
        { lat: 35.68142, lng: 139.76798 },
        { lat: 35.68176, lng: 139.76882 },
        { lat: 35.68112, lng: 139.76924 },
        { lat: 35.68036, lng: 139.76872 },
        { lat: 35.68052, lng: 139.76772 },
      ],
    },
    {
      routeId: "fixed-route-002",
      name: "安全寄りの短縮コース",
      distanceM: 420,
      durationMin: 5,
      tags: ["fixed", "familiar_route"],
      polyline: "tokyo-station-safe-short",
      waypoints: [
        { lat: 35.68136, lng: 139.76776 },
        { lat: 35.68118, lng: 139.76832 },
        { lat: 35.68068, lng: 139.76828 },
        { lat: 35.6807, lng: 139.76756 },
      ],
    },
    {
      routeId: "fixed-route-003",
      name: "少し長めの標準コース",
      distanceM: 900,
      durationMin: 12,
      tags: ["fixed", "park", "shade"],
      polyline: "tokyo-station-standard-loop",
      waypoints: [
        { lat: 35.68182, lng: 139.76792 },
        { lat: 35.68218, lng: 139.76916 },
        { lat: 35.68152, lng: 139.77002 },
        { lat: 35.68042, lng: 139.76978 },
        { lat: 35.67996, lng: 139.76862 },
        { lat: 35.68044, lng: 139.76758 },
      ],
    }
  ];

  async listByUserId(_userId: string): Promise<FixedRoute[]> {
    return this.routes;
  }
}
