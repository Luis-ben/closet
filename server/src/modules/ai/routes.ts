import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../../plugins/auth";
import { defaultModelPhoto } from "../../store";
import { getAiTaskRepository } from "../../store/aiTaskRepository";
import {
  assertAllClothingItemsFound,
  getClothingRepository
} from "../../store/clothingRepository";
import { getUserPhotoRepository } from "../../store/userPhotoRepository";
import type { ModelType } from "../../store/types";
import { AppError } from "../../utils/errors";
import { createId } from "../../utils/ids";
import { ok } from "../../utils/response";
import { parseWithSchema } from "../../utils/validation";
import { deductCredits, ensureCredits, refundCredits } from "../credits/service";
import { createImageGenerationAdapter } from "./adapterFactory";
import { getAiTaskQueue } from "./taskQueue";

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
      const clothingItems = await getClothingRepository().findManyActiveByUser(
        body.clothingItemIds,
        userId
      );
      assertAllClothingItemsFound(body.clothingItemIds, clothingItems);

      const activeModel = await getUserPhotoRepository().findActivePersonalModel(userId);
      const modelType: ModelType = body.modelType ?? (activeModel ? "personal_model" : "default_model");
      const modelPhotoId = await resolveModelPhotoId(
        userId,
        modelType,
        body.modelPhotoId,
        activeModel?._id
      );

      await ensureCredits(userId, 1);

      const taskId = createId("task");
      await deductCredits(userId, 1, taskId);

      const task = await createTaskAfterCreditDeduction({
        taskId,
        userId,
        modelType,
        modelPhotoId,
        clothingItemIds: body.clothingItemIds,
        mode: body.mode,
        scene: body.scene ?? null,
        style: body.style ?? null,
        shareable: body.shareable
      });

      await getAiTaskQueue().enqueue(task._id, adapter);

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
      const task = await getAiTaskRepository().findActiveByUser(params.taskId, request.user!.id);

      if (!task) {
        throw new AppError(404, "TASK_NOT_FOUND", "任务不存在");
      }

      return ok({
        task
      });
    }
  );
}

type CreateTaskAfterCreditDeductionInput = Parameters<
  ReturnType<typeof getAiTaskRepository>["create"]
>[0];

async function createTaskAfterCreditDeduction(input: CreateTaskAfterCreditDeductionInput) {
  try {
    return await getAiTaskRepository().create(input);
  } catch (error) {
    await refundCredits(input.userId, 1, input.taskId!);
    throw error;
  }
}

async function resolveModelPhotoId(
  userId: string,
  modelType: ModelType,
  requestedModelPhotoId?: string,
  activeModelPhotoId?: string
): Promise<string | null> {
  if (modelType === "default_model") {
    return defaultModelPhoto._id;
  }

  const modelPhotoId = requestedModelPhotoId ?? activeModelPhotoId;

  if (!modelPhotoId) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  const modelPhoto = await getUserPhotoRepository().findPassPersonalModelById(modelPhotoId, userId);

  if (!modelPhoto) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  return modelPhoto._id;
}
