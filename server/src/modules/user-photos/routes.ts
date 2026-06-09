import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { getUserPhotoRepository } from "../../store/userPhotoRepository";
import { imageMetaSchema, imageUrlSchema, requireProductionImageMeta } from "../uploads/imageInput";
import { ok } from "../../utils/response";
import { parseWithSchema } from "../../utils/validation";

const createUserPhotoBodySchema = z.object({
  imageUrl: imageUrlSchema,
  imageMeta: imageMetaSchema.optional(),
  displayName: z.string().min(1).max(40).default("我的模特")
});

const photoParamsSchema = z.object({
  id: z.string().min(1)
});

export async function userPhotoRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/user-photos",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const body = parseWithSchema(createUserPhotoBodySchema, request.body);
      requireProductionImageMeta(body.imageMeta);
      const photo = await getUserPhotoRepository().createPersonalModel({
        userId: request.user!.id,
        imageUrl: body.imageUrl,
        displayName: body.displayName
      });

      return ok({
        photo
      });
    }
  );

  app.get(
    "/user-photos",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const personalModels = await getUserPhotoRepository().listByUser(request.user!.id);

      return ok({
        items: personalModels
      });
    }
  );

  app.post(
    "/user-photos/:id/activate",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const params = parseWithSchema(photoParamsSchema, request.params);
      const userId = request.user!.id;
      const model = await getUserPhotoRepository().activatePersonalModel(params.id, userId);

      return ok({
        photo: model
      });
    }
  );
}
