import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../../plugins/auth";
import { getCreditRepository } from "../../store/creditRepository";
import { ok } from "../../utils/response";

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/credits/logs",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const userId = request.user!.id;
      const logs = await getCreditRepository().listLogs(userId);

      return ok({
        items: logs
      });
    }
  );
}
