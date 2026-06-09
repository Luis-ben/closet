import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { getClothingRepository } from "../../store/clothingRepository";
import { getUserRepository } from "../../store/userRepository";
import { getUserPhotoRepository } from "../../store/userPhotoRepository";
import { AppError } from "../../utils/errors";
import { nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/privacy/delete-clothing-items",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const deletedCount = await getClothingRepository().softDeleteAllByUser(userId);

      return ok({
        deleted: true,
        deletedCount
      });
    }
  );

  app.post(
    "/privacy/delete-models",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const deletedCount = await getUserPhotoRepository().softDeleteAllByUser(userId);

      return ok({
        deleted: true,
        deletedCount
      });
    }
  );

  app.post(
    "/privacy/delete-account",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const now = nowIso();
      const deletedUser = await getUserRepository().softDeleteById(userId, now);

      if (!deletedUser) {
        throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
      }

      await getClothingRepository().softDeleteAllByUser(userId);
      await getUserPhotoRepository().softDeleteAllByUser(userId);

      return ok({
        deleted: true,
        cleanupStatus: "queued"
      });
    }
  );
}
