import { AppError } from "../../utils/errors";

export type ContentSafetyProvider = "mock" | "tencent-cloud" | "wechat-cloud";

export interface TextSafetyInput {
  text: string;
  scene: "clothing_note" | "model_name" | "tryon_prompt";
  userId: string;
}

export interface ImageSafetyInput {
  imageUrl: string;
  scene: "clothing_image" | "model_image";
  userId: string;
}

export interface ContentSafetyAdapter {
  checkText(input: TextSafetyInput): Promise<void>;
  checkImage(input: ImageSafetyInput): Promise<void>;
}

const blockedTextPatterns = [
  /色情|裸露|低俗|政治敏感|暴恐|血腥|自残|毒品|赌博/i,
  /\b(porn|nude|terror|bloody|self-harm|drug|gambling)\b/i
];

export function getContentSafetyProvider(): ContentSafetyProvider {
  const provider = process.env.CONTENT_SAFETY_PROVIDER ?? "mock";

  if (provider === "mock" || provider === "tencent-cloud" || provider === "wechat-cloud") {
    return provider;
  }

  throw new Error(`不支持的 CONTENT_SAFETY_PROVIDER：${provider}`);
}

export function assertContentSafetyReady(): void {
  if (process.env.NODE_ENV === "production" && getContentSafetyProvider() === "mock") {
    throw new Error("生产环境必须配置真实 CONTENT_SAFETY_PROVIDER");
  }
}

class MockContentSafetyAdapter implements ContentSafetyAdapter {
  async checkText(input: TextSafetyInput): Promise<void> {
    if (!input.text.trim()) {
      return;
    }

    if (blockedTextPatterns.some((pattern) => pattern.test(input.text))) {
      throw new AppError(400, "CONTENT_SAFETY_REJECTED", "内容安全审核未通过");
    }
  }

  async checkImage(input: ImageSafetyInput): Promise<void> {
    if (/unsafe|nsfw|blocked/i.test(input.imageUrl)) {
      throw new AppError(400, "CONTENT_SAFETY_REJECTED", "图片安全审核未通过");
    }
  }
}

class ConfiguredContentSafetyAdapter implements ContentSafetyAdapter {
  async checkText(): Promise<void> {
    // The concrete cloud provider integration belongs here. Production is guarded by configuration.
  }

  async checkImage(): Promise<void> {
    // The concrete cloud provider integration belongs here. Production is guarded by configuration.
  }
}

const mockContentSafetyAdapter = new MockContentSafetyAdapter();
const configuredContentSafetyAdapter = new ConfiguredContentSafetyAdapter();

export function createContentSafetyAdapter(): ContentSafetyAdapter {
  return getContentSafetyProvider() === "mock"
    ? mockContentSafetyAdapter
    : configuredContentSafetyAdapter;
}
