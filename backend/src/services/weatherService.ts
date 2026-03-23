import type { WeatherSnapshot } from "../types/domain.js";

export class WeatherService {
  async getCurrentWeather(): Promise<WeatherSnapshot> {
    // TODO: Weather API 実装に差し替える
    return {
      wbgt: 24.1,
      precipitationMmPerH: 0.0,
      temperatureC: 21.5,
      humidityPct: 58.0,
    };
  }
}
