import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateWalkHistoryBody } from "../types/api.js";
import { PersonalizationService } from "../services/personalizationService.js";
import type { WalkHistoryRepository } from "../repositories/interfaces/walkHistoryRepository.js";

export class WalkHistoryController {
  constructor(
    private readonly personalizationService: PersonalizationService,
    private readonly walkHistoryRepository: WalkHistoryRepository,
  ) {}

  create = async (
    request: FastifyRequest<{ Body: CreateWalkHistoryBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = await this.personalizationService.createWalkHistoryAndUpdateProfile(request.body);

    reply.send({
      status: "ok",
      walkHistoryId: result.walkHistory.id,
      loadScore: result.walkHistory.loadScore,
      profileUpdate: {
        previousRecommendedDurationMin: result.previousRecommendedDurationMin,
        nextRecommendedDurationMin: result.nextProfile.recommendedDurationMin,
        nextMaxDurationMin: result.nextProfile.maxDurationMin,
      },
    });
  };

  listByUserId = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const records = await this.walkHistoryRepository.listByUserId(request.params.userId);
    reply.send({
      status: "ok",
      items: records,
    });
  };
}
