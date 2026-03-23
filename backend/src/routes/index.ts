import type { FastifyInstance } from "fastify";
import { RouteSuggestionController } from "../controllers/routeSuggestionController.js";
import { UserProfileController } from "../controllers/userProfileController.js";
import { WalkHistoryController } from "../controllers/walkHistoryController.js";

type RouteDependencies = {
  routeSuggestionController: RouteSuggestionController;
  userProfileController: UserProfileController;
  walkHistoryController: WalkHistoryController;
};

export async function registerRoutes(
  app: FastifyInstance,
  dependencies: RouteDependencies,
): Promise<void> {
  app.post("/api/v1/walk-routes/suggest", dependencies.routeSuggestionController.suggest);

  app.post("/api/v1/walk-history", dependencies.walkHistoryController.create);
  app.get("/api/v1/users/:userId/walk-history", dependencies.walkHistoryController.listByUserId);

  app.get("/api/v1/users/:userId/profile", dependencies.userProfileController.get);
  app.patch("/api/v1/users/:userId/profile", dependencies.userProfileController.update);
}
