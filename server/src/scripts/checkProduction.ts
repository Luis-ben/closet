import "dotenv/config";
import { getDataStoreProvider } from "../store";
import { getAiTaskQueueProvider } from "../modules/ai/taskQueue";
import { getContentSafetyProvider } from "../modules/contentSafety/adapter";
import {
  getCosBucket,
  getCosPublicBaseUrl,
  getCosRegion,
  getCosSecretId,
  getCosSecretKey,
  getCosUploadUrl,
  getImageStorageProvider,
  getWechatCloudEnv
} from "../modules/uploads/config";

type CheckSeverity = "error" | "warning";

interface CheckFinding {
  severity: CheckSeverity;
  area: string;
  message: string;
}

const findings: CheckFinding[] = [];

function main(): void {
  process.env.NODE_ENV = "production";

  checkBackendBasics();
  checkDataAndQueue();
  checkImageStorage();
  checkAiAndSafety();
  checkWechat();
  printResult();

  if (findings.some((finding) => finding.severity === "error")) {
    process.exitCode = 1;
  }
}

function checkBackendBasics(): void {
  const publicBaseUrl = env("PUBLIC_BASE_URL");

  requireEnv("PUBLIC_BASE_URL", "后端");

  if (publicBaseUrl && !/^https:\/\//i.test(publicBaseUrl)) {
    addError("后端", "PUBLIC_BASE_URL 必须是 HTTPS");
  }

  if (/^https?:\/\/localhost(?::\d+)?$/i.test(publicBaseUrl)) {
    addError("后端", "PUBLIC_BASE_URL 不能是 localhost");
  }

  requireMinLength("AUTH_TOKEN_SECRET", 32, "认证");
}

function checkDataAndQueue(): void {
  requireEnv("DATABASE_URL", "数据层");

  try {
    if (getDataStoreProvider() !== "mongodb") {
      addError("数据层", "DATA_STORE_PROVIDER 生产环境必须为 mongodb");
    }
  } catch (error) {
    addError("数据层", errorMessage(error));
  }

  try {
    if (getAiTaskQueueProvider() === "memory") {
      addError("任务队列", "AI_TASK_QUEUE_PROVIDER 生产环境不能为 memory");
    }
  } catch (error) {
    addError("任务队列", errorMessage(error));
  }
}

function checkImageStorage(): void {
  try {
    const provider = getImageStorageProvider();

    if (provider === "local") {
      addError("图片存储", "IMAGE_STORAGE_PROVIDER 生产环境不能为 local");
      return;
    }

    if (provider === "cos") {
      requireEnv("COS_PUBLIC_BASE_URL", "图片存储");
      requireEnv("COS_SECRET_ID", "图片存储");
      requireEnv("COS_SECRET_KEY", "图片存储");

      if (!getCosUploadUrl() && (!getCosBucket() || !getCosRegion())) {
        addError("图片存储", "COS_UPLOAD_URL 未配置时，必须同时配置 COS_BUCKET 和 COS_REGION");
      }

      if (getCosPublicBaseUrl() && !/^https:\/\//i.test(getCosPublicBaseUrl())) {
        addError("图片存储", "COS_PUBLIC_BASE_URL 必须是 HTTPS");
      }
    }

    if (provider === "wechat-cloud") {
      requireEnv("WECHAT_CLOUD_ENV", "图片存储");
    }
  } catch (error) {
    addError("图片存储", errorMessage(error));
  }
}

function checkAiAndSafety(): void {
  if (env("IMAGE_GENERATION_PROVIDER") === "mock" || !env("IMAGE_GENERATION_PROVIDER")) {
    addError("AI", "IMAGE_GENERATION_PROVIDER 生产环境必须是真实 provider");
  }

  if (env("IMAGE_GENERATION_PROVIDER") === "chatgpt-image-2") {
    requireEnv("CHATGPT_IMAGE2_API_KEY", "AI");
  }

  try {
    if (getContentSafetyProvider() === "mock") {
      addError("内容安全", "CONTENT_SAFETY_PROVIDER 生产环境不能为 mock");
    }
  } catch (error) {
    addError("内容安全", errorMessage(error));
  }

  requireEnv("CONTENT_SAFETY_ENDPOINT", "内容安全");
  requireEnv("CONTENT_SAFETY_API_KEY", "内容安全");

  const timeoutMs = Number(env("CONTENT_SAFETY_TIMEOUT_MS") || 5000);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    addError("内容安全", "CONTENT_SAFETY_TIMEOUT_MS 必须至少为 1000 毫秒");
  }
}

function checkWechat(): void {
  requireEnv("WECHAT_APP_ID", "微信");
  requireEnv("WECHAT_APP_SECRET", "微信");
}

function printResult(): void {
  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warning");

  if (findings.length === 0) {
    console.log("生产配置自检通过。");
    return;
  }

  console.log("生产配置自检发现问题：");

  for (const finding of findings) {
    console.log(`[${finding.severity.toUpperCase()}] ${finding.area}: ${finding.message}`);
  }

  console.log(`合计：${errors.length} 个错误，${warnings.length} 个提醒。`);
}

function requireEnv(name: string, area: string): void {
  if (!env(name)) {
    addError(area, `缺少 ${name}`);
  }
}

function requireMinLength(name: string, minLength: number, area: string): void {
  const value = env(name);

  if (!value || value.length < minLength || value === "dev-only-auth-secret-change-me") {
    addError(area, `${name} 至少 ${minLength} 位，且不能使用开发默认值`);
  }
}

function env(name: string): string {
  return process.env[name] ?? "";
}

function addError(area: string, message: string): void {
  findings.push({
    severity: "error",
    area,
    message
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知配置错误";
}

main();
