import { AppError } from "../../utils/errors";
import type {
  ImageGenerationAdapter,
  ImageGenerationResult,
  OutfitRenderInput
} from "./imageGenerationAdapter";

interface Image2AdapterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  size: string;
  quality: string;
  style: string;
  responseFormat: "url" | "b64_json";
  timeoutMs: number;
}

interface ReferenceImage {
  blob: Blob;
  fileName: string;
}

interface ProviderImageResult {
  url?: string;
  b64_json?: string;
}

interface ProviderImageResponse {
  data?: ProviderImageResult[];
  error?: {
    message?: string;
    code?: string;
  };
}

const styleTextMap: Record<string, string> = {
  clean_realistic: "简洁写实",
  commute: "通勤",
  casual: "休闲",
  date: "约会",
  premium: "高级感",
  travel: "旅行"
};

export class ChatgptImage2Adapter implements ImageGenerationAdapter {
  private readonly config: Image2AdapterConfig;

  constructor(config?: Partial<Image2AdapterConfig>) {
    this.config = {
      apiKey: config?.apiKey ?? process.env.CHATGPT_IMAGE2_API_KEY ?? "",
      baseUrl: normalizeBaseUrl(config?.baseUrl ?? process.env.CHATGPT_IMAGE2_BASE_URL ?? "https://image.codesonline.dev/v1"),
      model: config?.model ?? process.env.CHATGPT_IMAGE2_MODEL ?? "gpt-image-2",
      size: config?.size ?? process.env.CHATGPT_IMAGE2_SIZE ?? "9:16",
      quality: config?.quality ?? process.env.CHATGPT_IMAGE2_QUALITY ?? "high",
      style: config?.style ?? process.env.CHATGPT_IMAGE2_STYLE ?? "natural",
      responseFormat: config?.responseFormat ?? parseResponseFormat(process.env.CHATGPT_IMAGE2_RESPONSE_FORMAT),
      timeoutMs: config?.timeoutMs ?? Number(process.env.CHATGPT_IMAGE2_TIMEOUT_MS ?? 120000)
    };
  }

  async createOutfitRenderTask(input: OutfitRenderInput): Promise<ImageGenerationResult> {
    if (!this.config.apiKey) {
      throw new AppError(500, "IMAGE_PROVIDER_NOT_CONFIGURED", "图片生成服务未配置");
    }

    const referenceImages = await this.loadReferenceImages(input);
    const formData = new FormData();

    formData.append("model", this.config.model);
    formData.append("prompt", this.buildPrompt(input));
    formData.append("n", "1");
    formData.append("size", this.config.size);
    formData.append("quality", this.config.quality);
    formData.append("style", this.config.style);
    formData.append("response_format", this.config.responseFormat);
    formData.append("image", referenceImages[0].blob, referenceImages[0].fileName);

    for (const image of referenceImages.slice(1, 11)) {
      formData.append("image[]", image.blob, image.fileName);
    }

    const response = await this.postImageEdit(formData);
    const result = response.data?.[0];
    const imageUrl = result?.url ?? (result?.b64_json ? `data:image/png;base64,${result.b64_json}` : "");

    if (!imageUrl) {
      throw new AppError(502, "IMAGE_PROVIDER_EMPTY_RESULT", "图片生成服务未返回结果图");
    }

    return {
      imageUrl,
      costEstimate: 1,
      metadata: {
        provider: "chatgpt-image-2",
        model: this.config.model,
        responseFormat: this.config.responseFormat
      }
    };
  }

  private async postImageEdit(formData: FormData): Promise<ProviderImageResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });
      const text = await response.text();
      const body = parseJsonBody(text);

      if (!response.ok) {
        throw new AppError(
          502,
          "IMAGE_PROVIDER_FAILED",
          body.error?.message || `图片生成服务请求失败：${response.status}`
        );
      }

      return body;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError(504, "IMAGE_PROVIDER_TIMEOUT", "图片生成服务超时");
      }

      throw new AppError(502, "IMAGE_PROVIDER_FAILED", "图片生成服务调用失败");
    } finally {
      clearTimeout(timer);
    }
  }

  private async loadReferenceImages(input: OutfitRenderInput): Promise<ReferenceImage[]> {
    const imageUrls = [input.modelImageUrl, ...input.clothingImageUrls];
    const images: ReferenceImage[] = [];

    for (const [index, imageUrl] of imageUrls.entries()) {
      images.push(await downloadImage(imageUrl, index));
    }

    if (!images.length) {
      throw new AppError(400, "IMAGE_REFERENCE_REQUIRED", "缺少可用的参考图片");
    }

    return images;
  }

  private buildPrompt(input: OutfitRenderInput): string {
    const styleText = input.style ? styleTextMap[input.style] ?? input.style : "简洁写实";
    const sceneText = input.scene ? styleTextMap[input.scene] ?? input.scene : styleText;

    return [
      "生成一张真实感 AI 试穿预览图。",
      `风格：${styleText}；场景：${sceneText}。`,
      "第一张参考图是模特，请保留人物身份特征、脸部自然度、体型比例和站姿。",
      `其余 ${input.clothingImageUrls.length} 张参考图是衣物单品，请将衣物自然穿到模特身上。`,
      "保持服装结构、颜色和材质可信，背景简洁干净，光线柔和，成片像时尚穿搭海报。",
      "不得生成裸露、色情、未成年人敏感或侵犯隐私的内容。"
    ].join("\n");
  }
}

async function downloadImage(imageUrl: string, index: number): Promise<ReferenceImage> {
  if (!/^https?:\/\//.test(imageUrl)) {
    throw new AppError(
      400,
      "IMAGE_URL_NOT_FETCHABLE",
      "当前图片是本地临时地址，服务端无法读取。请先接入真实图片上传到 COS 或云存储。"
    );
  }

  let response: Response;

  try {
    response = await fetch(imageUrl);
  } catch {
    throw new AppError(400, "IMAGE_DOWNLOAD_FAILED", `参考图片下载失败：${imageUrl}`);
  }

  if (!response.ok) {
    throw new AppError(400, "IMAGE_DOWNLOAD_FAILED", "参考图片下载失败");
  }

  const contentType = response.headers.get("content-type") ?? "image/png";

  if (!contentType.startsWith("image/")) {
    throw new AppError(400, "IMAGE_INVALID_CONTENT_TYPE", "参考图片格式不支持");
  }

  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], {
    type: contentType
  });

  return {
    blob,
    fileName: `reference-${index}${getImageExtension(contentType)}`
  };
}

function getImageExtension(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return ".jpg";
  }

  if (contentType.includes("webp")) {
    return ".webp";
  }

  return ".png";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseResponseFormat(value?: string): "url" | "b64_json" {
  return value === "b64_json" ? "b64_json" : "url";
}

function parseJsonBody(text: string): ProviderImageResponse {
  try {
    return JSON.parse(text) as ProviderImageResponse;
  } catch {
    return {};
  }
}
