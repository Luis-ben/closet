import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { store } from "../../store";
import { ok } from "../../utils/response";

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/credits/logs",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const logs = store.creditLogs.filter((item) => item.userId === userId);

      return ok({
        items: logs
      });
    }
  );
}
