import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { defaultModelPhoto, store } from "../../store";
import type { AiTaskRecord, ModelType } from "../../store/types";
import { AppError } from "../../utils/errors";
import { createId, nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";
import { parseWithSchema } from "../../utils/validation";
import { deductCredits, ensureCredits } from "../credits/service";
import { createImageGenerationAdapter } from "./adapterFactory";
import { scheduleOutfitTaskProcessing } from "./taskProcessor";

const adapter = createImageGenerationAdapter();

const outfitRenderBodySchema = z.object({
  modelType: z.enum(["personal_model", "default_model"]).optional(),
  modelPhotoId: z.string().min(1).optional(),
  clothingItemIds: z.array(z.string().min(1)).min(1).max(8).refine(
    (ids) => new Set(ids).size === ids.length,
    {
      message: "衣物不能重复选择"
    }
  ),
  mode: z.enum(["quick", "high", "shop"]).default("quick"),
  scene: z.string().max(40).nullable().optional(),
  style: z.string().max(40).nullable().optional(),
  shareable: z.boolean().default(true)
});

const taskParamsSchema = z.object({
  taskId: z.string().min(1)
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/ai/outfit-render",
    {
      preHandler: authenticateRequest
    },
    async (request, reply) => {
      const body = parseWithSchema(outfitRenderBodySchema, request.body);
      const userId = request.user!.id;
      const clothingItems = body.clothingItemIds.map((itemId) =>
        store.clothingItems.find(
          (item) => item._id === itemId && item.userId === userId && item.status === "normal"
        )
      );

      if (clothingItems.some((item) => !item)) {
        throw new AppError(404, "CLOTHING_ITEM_NOT_FOUND", "衣物不存在");
      }

      const activeModel = store.userPhotos.find(
        (photo) =>
          photo.userId === userId &&
          photo.type === "personal_model" &&
          photo.isActiveModel &&
          photo.auditStatus === "pass" &&
          !photo.deletedAt
      );
      const modelType: ModelType = body.modelType ?? (activeModel ? "personal_model" : "default_model");
      const modelPhotoId = resolveModelPhotoId(userId, modelType, body.modelPhotoId, activeModel?._id);

      ensureCredits(userId, 1);

      const now = nowIso();
      const taskId = createId("task");
      const task: AiTaskRecord = {
        _id: taskId,
        userId,
        modelType,
        modelPhotoId,
        clothingItemIds: body.clothingItemIds,
        mode: body.mode,
        scene: body.scene ?? null,
        style: body.style ?? null,
        shareable: body.shareable,
        promptVersion: "mock-v1",
        status: "queued",
        resultImageUrl: null,
        retryCount: 0,
        errorCode: null,
        errorMessage: null,
        costEstimate: 0,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null
      };

      deductCredits(userId, 1, task._id);
      store.aiTasks.push(task);

      scheduleOutfitTaskProcessing(task._id, adapter);

      return reply.code(202).send(
        ok({
          taskId: task._id,
          status: task.status,
          estimatedSeconds: 3
        })
      );
    }
  );

  app.get(
    "/ai/tasks/:taskId",
    {
      preHandler: authenticateRequest
    },
    async (request) => {
      const params = parseWithSchema(taskParamsSchema, request.params);
      const task = store.aiTasks.find(
        (item) => item._id === params.taskId && item.userId === request.user!.id && !item.deletedAt
      );

      if (!task) {
        throw new AppError(404, "TASK_NOT_FOUND", "任务不存在");
      }

      return ok({
        task
      });
    }
  );
}

function resolveModelPhotoId(
  userId: string,
  modelType: ModelType,
  requestedModelPhotoId?: string,
  activeModelPhotoId?: string
): string | null {
  if (modelType === "default_model") {
    return defaultModelPhoto._id;
  }

  const modelPhotoId = requestedModelPhotoId ?? activeModelPhotoId;

  if (!modelPhotoId) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  const modelPhoto = store.userPhotos.find(
    (photo) =>
      photo._id === modelPhotoId &&
      photo.userId === userId &&
      photo.type === "personal_model" &&
      photo.auditStatus === "pass" &&
      !photo.deletedAt
  );

  if (!modelPhoto) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  return modelPhoto._id;
}
