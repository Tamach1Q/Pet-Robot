import { loadEnv } from "./config/env.js";
import { RouteSuggestionController } from "./controllers/routeSuggestionController.js";
import { UserProfileController } from "./controllers/userProfileController.js";
import { WalkRouteController } from "./controllers/walkRouteController.js";
import { WalkHistoryController } from "./controllers/walkHistoryController.js";
import { createPostgresPool } from "./lib/postgres.js";
import { InMemoryFixedRouteRepository } from "./repositories/in-memory/inMemoryFixedRouteRepository.js";
import { InMemoryUserProfileRepository } from "./repositories/in-memory/inMemoryUserProfileRepository.js";
import { InMemoryWalkHistoryRepository } from "./repositories/in-memory/inMemoryWalkHistoryRepository.js";
import { PostgresFixedRouteRepository } from "./repositories/postgres/postgresFixedRouteRepository.js";
import { PostgresUserProfileRepository } from "./repositories/postgres/postgresUserProfileRepository.js";
import { PostgresWalkHistoryRepository } from "./repositories/postgres/postgresWalkHistoryRepository.js";
import { PersonalizationService } from "./services/personalizationService.js";
import { RoutingService } from "./services/routingService.js";
import { RouteSuggestionService } from "./services/routeSuggestionService.js";
import { UserProfileService } from "./services/userProfileService.js";
import { WeatherService } from "./services/weatherService.js";

export function createContainer() {
  const env = loadEnv();

  if (env.storageMode === "postgres" && !env.databaseUrl) {
    throw new Error("DATABASE_URL is required when STORAGE_MODE=postgres");
  }

  const pool =
    env.storageMode === "postgres" && env.databaseUrl
      ? createPostgresPool(env.databaseUrl)
      : null;

  const userProfileRepository = pool
    ? new PostgresUserProfileRepository(pool)
    : new InMemoryUserProfileRepository();
  const walkHistoryRepository = pool
    ? new PostgresWalkHistoryRepository(pool)
    : new InMemoryWalkHistoryRepository();
  const fixedRouteRepository = pool
    ? new PostgresFixedRouteRepository(pool)
    : new InMemoryFixedRouteRepository();

  const weatherService = new WeatherService();
  const routingService = new RoutingService({
    baseUrl: env.openRouteServiceBaseUrl,
    apiKey: env.openRouteServiceApiKey,
  });
  const userProfileService = new UserProfileService(userProfileRepository);
  const personalizationService = new PersonalizationService(
    userProfileRepository,
    walkHistoryRepository,
  );
  const routeSuggestionService = new RouteSuggestionService(
    userProfileRepository,
    walkHistoryRepository,
    fixedRouteRepository,
    weatherService,
    routingService,
  );

  return {
    cleanup: async () => {
      if (pool) {
        await pool.end();
      }
    },
    controllers: {
      routeSuggestionController: new RouteSuggestionController(routeSuggestionService),
      walkRouteController: new WalkRouteController(routingService),
      userProfileController: new UserProfileController(userProfileService),
      walkHistoryController: new WalkHistoryController(
        personalizationService,
        walkHistoryRepository,
      ),
    },
  };
}
