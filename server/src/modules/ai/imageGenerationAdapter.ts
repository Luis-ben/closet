import type { ModelType } from "../../store/types";

export interface OutfitRenderInput {
  taskId: string;
  modelType: ModelType;
  modelImageUrl: string;
  clothingImageUrls: string[];
  scene: string | null;
  style: string | null;
}

export interface ImageGenerationResult {
  imageUrl: string;
  costEstimate: number;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationAdapter {
  createOutfitRenderTask(input: OutfitRenderInput): Promise<ImageGenerationResult>;
}
