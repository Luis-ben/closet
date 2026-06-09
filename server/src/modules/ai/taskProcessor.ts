import { defaultModelPhoto } from "../../store";
import { getAiTaskRepository } from "../../store/aiTaskRepository";
import {
  assertAllClothingItemsFound,
  getClothingRepository
} from "../../store/clothingRepository";
import { getUserPhotoRepository } from "../../store/userPhotoRepository";
import type { AiTaskRecord } from "../../store/types";
import { AppError } from "../../utils/errors";
import { nowIso } from "../../utils/ids";
import { refundCredits } from "../credits/service";
import type { ImageGenerationAdapter } from "./imageGenerationAdapter";

export const MOCK_GENERATION_DELAY_MS = 3000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function processOutfitTask(
  taskId: string,
  adapter: ImageGenerationAdapter
): Promise<void> {
  const task = await getAiTaskRepository().markRunning(taskId, nowIso());

  if (!task) {
    return;
  }

  try {
    await wait(MOCK_GENERATION_DELAY_MS);

    const modelPhoto = await resolveTaskModelPhoto(task);
    const clothingItems = await getClothingRepository().findManyActiveByUser(
      task.clothingItemIds,
      task.userId
    );
    assertAllClothingItemsFound(task.clothingItemIds, clothingItems);

    const result = await adapter.createOutfitRenderTask({
      taskId: task._id,
      modelType: task.modelType,
      modelImageUrl: modelPhoto.imageUrl,
      clothingImageUrls: clothingItems.map((item) => item.imageUrl),
      scene: task.scene,
      style: task.style
    });

    const completedAt = nowIso();
    await getAiTaskRepository().markSuccess({
      taskId: task._id,
      resultImageUrl: result.imageUrl,
      costEstimate: result.costEstimate,
      completedAt
    });
    await getClothingRepository().incrementUseCounts(task.userId, task.clothingItemIds, completedAt);
  } catch (error) {
    const completedAt = nowIso();
    await getAiTaskRepository().markFailed({
      taskId: task._id,
      errorCode: error instanceof AppError ? error.code : "AI_FAILED",
      errorMessage: error instanceof Error ? error.message : "AI 生成失败",
      completedAt
    });
    await refundCredits(task.userId, 1, task._id);
  }
}

async function resolveTaskModelPhoto(task: AiTaskRecord) {
  if (task.modelType === "default_model") {
    return defaultModelPhoto;
  }

  const modelPhoto = task.modelPhotoId
    ? await getUserPhotoRepository().findPassPersonalModelById(task.modelPhotoId, task.userId)
    : null;

  if (!modelPhoto) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  return modelPhoto;
}
