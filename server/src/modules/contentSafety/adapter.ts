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

interface GatewaySafetyResponse {
  decision?: "pass" | "reject" | "review";
  code?: string;
  message?: string;
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
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (getContentSafetyProvider() === "mock") {
    throw new Error("生产环境必须配置真实 CONTENT_SAFETY_PROVIDER");
  }

  if (!getContentSafetyEndpoint() || !getContentSafetyApiKey()) {
    throw new Error("生产环境必须配置 CONTENT_SAFETY_ENDPOINT 和 CONTENT_SAFETY_API_KEY");
  }
}

export function getContentSafetyEndpoint(): string {
  return process.env.CONTENT_SAFETY_ENDPOINT ?? "";
}

export function getContentSafetyApiKey(): string {
  return process.env.CONTENT_SAFETY_API_KEY ?? "";
}

function getContentSafetyTimeoutMs(): number {
  const timeoutMs = Number(process.env.CONTENT_SAFETY_TIMEOUT_MS ?? 5000);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error("CONTENT_SAFETY_TIMEOUT_MS 必须至少为 1000 毫秒");
  }

  return timeoutMs;
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
  async checkText(input: TextSafetyInput): Promise<void> {
    if (!input.text.trim()) {
      return;
    }

    await checkWithGateway({
      type: "text",
      provider: getContentSafetyProvider(),
      scene: input.scene,
      userId: input.userId,
      text: input.text
    });
  }

  async checkImage(input: ImageSafetyInput): Promise<void> {
    await checkWithGateway({
      type: "image",
      provider: getContentSafetyProvider(),
      scene: input.scene,
      userId: input.userId,
      imageUrl: input.imageUrl
    });
  }
}

async function checkWithGateway(payload: Record<string, unknown>): Promise<void> {
  const endpoint = getContentSafetyEndpoint();
  const apiKey = getContentSafetyApiKey();

  if (!endpoint || !apiKey) {
    throw new AppError(500, "CONTENT_SAFETY_NOT_CONFIGURED", "内容安全服务未配置");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, getContentSafetyTimeoutMs());

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-content-safety-key": apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError(502, "CONTENT_SAFETY_PROVIDER_FAILED", "内容安全服务暂不可用");
    }

    const result = (await response.json()) as GatewaySafetyResponse;

    if (result.decision === "pass") {
      return;
    }

    throw new AppError(
      400,
      "CONTENT_SAFETY_REJECTED",
      result.message || "内容安全审核未通过",
      {
        providerCode: result.code,
        decision: result.decision ?? "review"
      }
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, "CONTENT_SAFETY_PROVIDER_FAILED", "内容安全服务暂不可用");
  } finally {
    clearTimeout(timeout);
  }
}

const mockContentSafetyAdapter = new MockContentSafetyAdapter();
const configuredContentSafetyAdapter = new ConfiguredContentSafetyAdapter();

export function createContentSafetyAdapter(): ContentSafetyAdapter {
  return getContentSafetyProvider() === "mock"
    ? mockContentSafetyAdapter
    : configuredContentSafetyAdapter;
}
