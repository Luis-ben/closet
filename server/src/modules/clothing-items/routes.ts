import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { store } from "../../store/mockStore";
import type { ClothingItemRecord } from "../../store/types";
import { AppError } from "../../utils/errors";
import { createId, nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";
import { allowedImageMimeTypes, maxImageSizeBytes, parseWithSchema } from "../../utils/validation";

const imageMetaSchema = z
  .object({
    sizeBytes: z.number().int().positive().max(maxImageSizeBytes),
    mimeType: z.enum(allowedImageMimeTypes)
  })
  .optional();

const imageUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => /^(https?:\/\/|cloud:\/\/|wxfile:\/\/|mock:\/\/)/.test(value), {
    message: "图片地址必须是 http、cloud、wxfile 或 mock 协议"
  });

const createClothingItemBodySchema = z.object({
  imageUrl: imageUrlSchema,
  imageMeta: imageMetaSchema,
  sourceType: z.enum(["camera", "album", "web_image", "product_image"]),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  category: z.enum(["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory"]),
  color: z.string().min(1).max(30),
  season: z.array(z.enum(["spring", "summer", "autumn", "winter", "all"])).default([]),
  occasion: z.array(z.enum(["commute", "casual", "date", "sport", "formal"])).default([]),
  note: z.string().max(200).default("")
});

const deleteParamsSchema = z.object({
  id: z.string().min(1)
});

export async function clothingItemRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/clothing-items",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const body = parseWithSchema(createClothingItemBodySchema, request.body);
      const now = nowIso();
      const item: ClothingItemRecord = {
        _id: createId("cloth"),
        userId: request.user!.id,
        imageUrl: body.imageUrl,
        sourceType: body.sourceType,
        sourceUrl: body.sourceUrl ?? null,
        category: body.category,
        color: body.color,
        season: body.season,
        occasion: body.occasion,
        note: body.note,
        useCount: 0,
        status: "normal",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      store.clothingItems.push(item);

      return ok({
        item
      });
    }
  );

  app.get(
    "/clothing-items",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const items = store.clothingItems.filter(
        (item) => item.userId === request.user!.id && item.status === "normal"
      );

      return ok({
        items
      });
    }
  );

  app.delete(
    "/clothing-items/:id",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const params = parseWithSchema(deleteParamsSchema, request.params);
      const item = store.clothingItems.find(
        (record) => record._id === params.id && record.userId === request.user!.id
      );

      if (!item || item.status === "deleted") {
        throw new AppError(404, "CLOTHING_ITEM_NOT_FOUND", "衣物不存在");
      }

      item.status = "deleted";
      item.deletedAt = nowIso();
      item.updatedAt = item.deletedAt;

      return ok({
        deleted: true
      });
    }
  );
}
