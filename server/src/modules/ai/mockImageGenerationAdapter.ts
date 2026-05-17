import type {
  ImageGenerationAdapter,
  ImageGenerationResult,
  OutfitRenderInput
} from "./imageGenerationAdapter";

import { AppError } from "../../utils/errors";

export class MockImageGenerationAdapter implements ImageGenerationAdapter {
  async createOutfitRenderTask(input: OutfitRenderInput): Promise<ImageGenerationResult> {
    if (input.scene === "mock_fail") {
      throw new AppError(502, "AI_FAILED", "Mock AI 生成失败");
    }

    return {
      imageUrl: `https://placehold.co/768x1024/png?text=Mock+Outfit+${encodeURIComponent(
        input.taskId
      )}`,
      costEstimate: 1,
      metadata: {
        modelType: input.modelType,
        clothingCount: input.clothingImageUrls.length
      }
    };
  }
}
