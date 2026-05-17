import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { store } from "../../store/mockStore";
import type { UserPhotoRecord } from "../../store/types";
import { createId, nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";
import { allowedImageMimeTypes, maxImageSizeBytes, parseWithSchema } from "../../utils/validation";

const imageMetaSchema = z
  .object({
    sizeBytes: z.number().int().positive().max(maxImageSizeBytes),
    mimeType: z.enum(allowedImageMimeTypes)
  })
  .optional();

const createUserPhotoBodySchema = z.object({
  imageUrl: z
    .string()
    .min(1)
    .max(2000)
    .refine((value) => /^(https?:\/\/|cloud:\/\/|wxfile:\/\/|mock:\/\/)/.test(value), {
      message: "图片地址必须是 http、cloud、wxfile 或 mock 协议"
    }),
  imageMeta: imageMetaSchema,
  displayName: z.string().min(1).max(40).default("我的模特")
});

export async function userPhotoRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/user-photos",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const body = parseWithSchema(createUserPhotoBodySchema, request.body);
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
}
