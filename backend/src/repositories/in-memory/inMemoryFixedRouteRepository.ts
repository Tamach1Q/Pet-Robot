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
        { lat: 35.68162, lng: 139.76838 },
        { lat: 35.68088, lng: 139.76928 },
        { lat: 35.67992, lng: 139.76862 },
        { lat: 35.68018, lng: 139.76734 },
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
        { lat: 35.68138, lng: 139.76792 },
        { lat: 35.68082, lng: 139.76818 },
        { lat: 35.68058, lng: 139.76734 },
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
        { lat: 35.68202, lng: 139.76872 },
        { lat: 35.68112, lng: 139.77028 },
        { lat: 35.67986, lng: 139.76988 },
        { lat: 35.67934, lng: 139.76822 },
        { lat: 35.68014, lng: 139.76692 },
      ],
    }
  ];

  async listByUserId(_userId: string): Promise<FixedRoute[]> {
    return this.routes;
  }
}
