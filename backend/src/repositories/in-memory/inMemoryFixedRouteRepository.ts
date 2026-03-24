import type { FixedRoute } from "../../types/domain.js";
import type { FixedRouteRepository } from "../interfaces/fixedRouteRepository.js";

export class InMemoryFixedRouteRepository implements FixedRouteRepository {
  private readonly routes: FixedRoute[] = [
    {
      routeId: "fixed-route-001",
      name: "日比谷公園の定番コース",
      distanceM: 650,
      durationMin: 8,
      tags: ["fixed", "park", "shade", "quiet_street"],
      polyline: "hibiya-park-short-loop",
      waypoints: [
        { lat: 35.67418, lng: 139.7589 },
        { lat: 35.67476, lng: 139.75812 },
        { lat: 35.6742, lng: 139.75698 },
        { lat: 35.67308, lng: 139.7571 },
        { lat: 35.67292, lng: 139.75826 },
      ],
    },
    {
      routeId: "fixed-route-002",
      name: "木陰多めの短縮コース",
      distanceM: 420,
      durationMin: 5,
      tags: ["fixed", "park", "shade", "familiar_route"],
      polyline: "hibiya-park-safe-short",
      waypoints: [
        { lat: 35.67392, lng: 139.75878 },
        { lat: 35.67408, lng: 139.75792 },
        { lat: 35.67338, lng: 139.75745 },
        { lat: 35.6729, lng: 139.75812 },
      ],
    },
    {
      routeId: "fixed-route-003",
      name: "公園を大きく回る標準コース",
      distanceM: 900,
      durationMin: 12,
      tags: ["fixed", "park", "shade"],
      polyline: "hibiya-park-standard-loop",
      waypoints: [
        { lat: 35.6743, lng: 139.75896 },
        { lat: 35.67502, lng: 139.7582 },
        { lat: 35.67476, lng: 139.75682 },
        { lat: 35.67378, lng: 139.75652 },
        { lat: 35.6728, lng: 139.75692 },
        { lat: 35.67248, lng: 139.75818 },
      ],
    }
  ];

  async listByUserId(_userId: string): Promise<FixedRoute[]> {
    return this.routes;
  }
}
