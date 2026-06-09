import cors from "@fastify/cors";
import Fastify from "fastify";
import { errorHandlerPlugin } from "./plugins/errorHandler";
import { authPlugin } from "./plugins/auth";
import { routes } from "./routes";
import { ok } from "./utils/response";
import { uploadStaticRoutes } from "./modules/uploads/staticRoutes";
import { closeMongoConnection, ensureMongoIndexes } from "./store/mongo";
import { getDataStoreProvider } from "./store";
import { createImageGenerationAdapter } from "./modules/ai/adapterFactory";
import { getAiTaskQueue } from "./modules/ai/taskQueue";

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

  if (getDataStoreProvider() === "mongodb") {
    await ensureMongoIndexes();
  }

  getAiTaskQueue().startWorker(app, createImageGenerationAdapter());

  app.addHook("onClose", async () => {
    await closeMongoConnection();
  });

  app.get("/health", async () => ok({ status: "ok" }));
  await uploadStaticRoutes(app);

  await app.register(routes, {
    prefix: "/api"
  });

  return app;
}
