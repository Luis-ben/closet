import { defaultModelPhoto, store } from "../../store";
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

export function scheduleOutfitTaskProcessing(
  taskId: string,
  adapter: ImageGenerationAdapter
): void {
  setTimeout(() => {
    void processOutfitTask(taskId, adapter);
  }, 0);
}

export async function processOutfitTask(
  taskId: string,
  adapter: ImageGenerationAdapter
): Promise<void> {
  const task = store.aiTasks.find((item) => item._id === taskId);

  if (!task) {
    return;
  }

  if (task.status !== "queued") {
    return;
  }

  task.status = "running";
  task.updatedAt = nowIso();

  try {
    await wait(MOCK_GENERATION_DELAY_MS);

    const modelPhoto = resolveTaskModelPhoto(task);
    const clothingItems = task.clothingItemIds.map((itemId) => {
      const item = store.clothingItems.find(
        (record) => record._id === itemId && record.userId === task.userId && record.status === "normal"
      );

      if (!item) {
        throw new AppError(404, "CLOTHING_ITEM_NOT_FOUND", "衣物不存在");
      }

      return item;
    });

    const result = await adapter.createOutfitRenderTask({
      taskId: task._id,
      modelType: task.modelType,
      modelImageUrl: modelPhoto.imageUrl,
      clothingImageUrls: clothingItems.map((item) => item.imageUrl),
      scene: task.scene,
      style: task.style
    });

    task.status = "success";
    task.resultImageUrl = result.imageUrl;
    task.costEstimate = result.costEstimate;
    task.completedAt = nowIso();
    task.updatedAt = task.completedAt;

    clothingItems.forEach((item) => {
      item.useCount += 1;
      item.updatedAt = task.completedAt!;
    });
  } catch (error) {
    task.status = "failed";
    task.errorCode = error instanceof AppError ? error.code : "AI_FAILED";
    task.errorMessage = error instanceof Error ? error.message : "AI 生成失败";
    task.completedAt = nowIso();
    task.updatedAt = task.completedAt;
    refundCredits(task.userId, 1, task._id);
  }
}

function resolveTaskModelPhoto(task: AiTaskRecord) {
  if (task.modelType === "default_model") {
    return defaultModelPhoto;
  }

  const modelPhoto = store.userPhotos.find(
    (photo) =>
      photo._id === task.modelPhotoId &&
      photo.userId === task.userId &&
      photo.type === "personal_model" &&
      photo.auditStatus === "pass" &&
      !photo.deletedAt
  );

  if (!modelPhoto) {
    throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
  }

  return modelPhoto;
}
