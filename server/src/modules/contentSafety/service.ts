import { createContentSafetyAdapter } from "./adapter";

interface ClothingSafetyInput {
  userId: string;
  imageUrl: string;
  note: string;
}

interface ModelSafetyInput {
  userId: string;
  imageUrl: string;
  displayName: string;
}

interface TryOnSafetyInput {
  userId: string;
  scene: string | null;
  style: string | null;
}

export async function checkClothingInputSafety(input: ClothingSafetyInput): Promise<void> {
  const adapter = createContentSafetyAdapter();

  await adapter.checkImage({
    userId: input.userId,
    imageUrl: input.imageUrl,
    scene: "clothing_image"
  });
  await adapter.checkText({
    userId: input.userId,
    text: input.note,
    scene: "clothing_note"
  });
}

export async function checkModelInputSafety(input: ModelSafetyInput): Promise<void> {
  const adapter = createContentSafetyAdapter();

  await adapter.checkImage({
    userId: input.userId,
    imageUrl: input.imageUrl,
    scene: "model_image"
  });
  await adapter.checkText({
    userId: input.userId,
    text: input.displayName,
    scene: "model_name"
  });
}

export async function checkTryOnInputSafety(input: TryOnSafetyInput): Promise<void> {
  const adapter = createContentSafetyAdapter();
  const promptParts = [input.scene, input.style].filter(Boolean).join(" ");

  await adapter.checkText({
    userId: input.userId,
    text: promptParts,
    scene: "tryon_prompt"
  });
}
