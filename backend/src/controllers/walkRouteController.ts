import type { FastifyReply, FastifyRequest } from "fastify";
import type { GenerateLoopRouteBody } from "../types/api.js";
import { RoutingService } from "../services/routingService.js";

export class WalkRouteController {
  constructor(private readonly routingService: RoutingService) {}

  generateLoop = async (
    request: FastifyRequest<{ Body: GenerateLoopRouteBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.routingService.generateLoopRoute({
      latitude: request.body.currentLocation.lat,
      longitude: request.body.currentLocation.lng,
      desiredWalkMinutes: request.body.desiredWalkMinutes,
    });

    reply.send({
      status: "ok",
      route: result,
    });
  };
}
