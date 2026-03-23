import type { FastifyReply, FastifyRequest } from "fastify";
import type { UpdateUserProfileBody } from "../types/api.js";
import { UserProfileService } from "../services/userProfileService.js";

export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  get = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const profile = await this.userProfileService.getProfile(request.params.userId);
    reply.send({
      status: "ok",
      profile,
    });
  };

  update = async (
    request: FastifyRequest<{ Params: { userId: string }; Body: UpdateUserProfileBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const profile = await this.userProfileService.updateProfile(request.params.userId, {
      ...request.body,
      lastProfileUpdatedAt: new Date().toISOString(),
    });

    reply.send({
      status: "ok",
      profile,
    });
  };
}
