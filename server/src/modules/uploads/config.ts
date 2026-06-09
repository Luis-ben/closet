import path from "node:path";

export type ImageStorageProvider = "local" | "cos" | "wechat-cloud";

export function getImageStorageProvider(): ImageStorageProvider {
  const provider = process.env.IMAGE_STORAGE_PROVIDER ?? "local";

  if (provider === "local" || provider === "cos" || provider === "wechat-cloud") {
    return provider;
  }

  throw new Error(`不支持的 IMAGE_STORAGE_PROVIDER：${provider}`);
}

export function getUploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

export function getPublicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function getCosPublicBaseUrl(): string {
  return (process.env.COS_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
}

export function getCosUploadUrl(): string {
  return process.env.COS_UPLOAD_URL ?? "";
}

export function getCosUploadAuthorization(): string {
  return process.env.COS_UPLOAD_AUTHORIZATION ?? "";
}

export function getWechatCloudEnv(): string {
  return process.env.WECHAT_CLOUD_ENV ?? "";
}
