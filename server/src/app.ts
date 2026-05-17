import cors from "@fastify/cors";
import Fastify from "fastify";
import { errorHandlerPlugin } from "./plugins/errorHandler";
import { authPlugin } from "./plugins/auth";
import { routes } from "./routes";
import { ok } from "./utils/response";
import { uploadStaticRoutes } from "./modules/uploads/staticRoutes";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  await app.register(cors, {
    origin: true
  });

  await errorHandlerPlugin(app);
  await authPlugin(app);

  app.get("/health", async () => ok({ status: "ok" }));
  await uploadStaticRoutes(app);

  await app.register(routes, {
    prefix: "/api"
  });

  return app;
}
