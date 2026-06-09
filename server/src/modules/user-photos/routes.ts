import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { store } from "../../store/mockStore";
import type { UserPhotoRecord } from "../../store/types";
import { imageMetaSchema, imageUrlSchema, requireProductionImageMeta } from "../uploads/imageInput";
import { AppError } from "../../utils/errors";
import { createId, nowIso } from "../../utils/ids";
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
      const now = nowIso();

      for (const photo of store.userPhotos) {
        if (photo.userId === request.user!.id && photo.type === "personal_model") {
          photo.isActiveModel = false;
          photo.updatedAt = now;
        }
      }

      const photo: UserPhotoRecord = {
        _id: createId("model"),
        userId: request.user!.id,
        imageUrl: body.imageUrl,
        type: "personal_model",
        isActiveModel: true,
        displayName: body.displayName,
        auditStatus: "pass",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      store.userPhotos.push(photo);

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
      const personalModels = store.userPhotos.filter(
        (photo) => photo.userId === request.user!.id && !photo.deletedAt
      );

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
      const now = nowIso();
      const model = store.userPhotos.find(
        (photo) =>
          photo._id === params.id &&
          photo.userId === userId &&
          photo.type === "personal_model" &&
          photo.auditStatus === "pass" &&
          !photo.deletedAt
      );

      if (!model) {
        throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
      }

      for (const photo of store.userPhotos) {
        if (photo.userId === userId && photo.type === "personal_model" && !photo.deletedAt) {
          photo.isActiveModel = photo._id === model._id;
          photo.updatedAt = now;
        }
      }

      return ok({
        photo: model
      });
    }
  );
}
