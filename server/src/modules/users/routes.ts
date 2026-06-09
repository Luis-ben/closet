import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { getUserRepository } from "../../store/userRepository";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/users/me",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const user = await getUserRepository().findActiveById(request.user!.id);

      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
      }

      return ok({
        user
      });
    }
  );
}
