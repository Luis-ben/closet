import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { store } from "../../store/mockStore";
import { AppError } from "../../utils/errors";
import { nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/privacy/delete-account",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const now = nowIso();
      const user = store.users.find((item) => item._id === userId && !item.deletedAt);

      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
      }

      user.deletedAt = now;
      user.updatedAt = now;

      for (const item of store.clothingItems) {
        if (item.userId === userId) {
          item.status = "deleted";
          item.deletedAt = now;
          item.updatedAt = now;
        }
      }

      for (const photo of store.userPhotos) {
        if (photo.userId === userId) {
          photo.deletedAt = now;
          photo.isActiveModel = false;
          photo.updatedAt = now;
        }
      }

      return ok({
        deleted: true,
        cleanupStatus: "queued"
      });
    }
  );
}
