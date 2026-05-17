import type { ImageGenerationAdapter } from "./imageGenerationAdapter";
import { ChatgptImage2Adapter } from "./chatgptImage2Adapter";
import { MockImageGenerationAdapter } from "./mockImageGenerationAdapter";

export function createImageGenerationAdapter(): ImageGenerationAdapter {
  if (process.env.IMAGE_GENERATION_PROVIDER === "chatgpt-image-2") {
    return new ChatgptImage2Adapter();
  }

  return new MockImageGenerationAdapter();
}
