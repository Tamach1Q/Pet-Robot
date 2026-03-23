import type { FastifyReply, FastifyRequest } from "fastify";
import type { SuggestWalkRouteBody } from "../types/api.js";
import { RouteSuggestionService } from "../services/routeSuggestionService.js";

export class RouteSuggestionController {
  constructor(private readonly routeSuggestionService: RouteSuggestionService) {}

  suggest = async (
    request: FastifyRequest<{ Body: SuggestWalkRouteBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.routeSuggestionService.suggestRoute(request.body);
    reply.send({
      status: "ok",
      ...result,
    });
  };
}
