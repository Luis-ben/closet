import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/routes";
import { userRoutes } from "../modules/users/routes";
import { clothingItemRoutes } from "../modules/clothing-items/routes";
import { userPhotoRoutes } from "../modules/user-photos/routes";
import { aiRoutes } from "../modules/ai/routes";
import { creditRoutes } from "../modules/credits/routes";
import { privacyRoutes } from "../modules/privacy/routes";
import { uploadRoutes } from "../modules/uploads/routes";

export async function routes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(uploadRoutes);
  await app.register(clothingItemRoutes);
  await app.register(userPhotoRoutes);
  await app.register(aiRoutes);
  await app.register(creditRoutes);
  await app.register(privacyRoutes);
}
