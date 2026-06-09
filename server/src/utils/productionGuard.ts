import { assertDataStoreReady } from "../store";
import { assertAiTaskQueueReady } from "../modules/ai/taskQueue";
import { assertContentSafetyReady } from "../modules/contentSafety/adapter";
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

export function assertProductionReady(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const provider = process.env.IMAGE_GENERATION_PROVIDER;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const wechatAppId = process.env.WECHAT_APP_ID ?? "";
  const wechatAppSecret = process.env.WECHAT_APP_SECRET ?? "";
  const authTokenSecret = process.env.AUTH_TOKEN_SECRET ?? "";
  const imageStorageProvider = getImageStorageProvider();

  if (!provider || provider === "mock") {
    throw new Error("生产环境必须配置真实 IMAGE_GENERATION_PROVIDER");
  }

  if (!publicBaseUrl || /^http:\/\/localhost(?::\d+)?$/i.test(publicBaseUrl)) {
    throw new Error("生产环境必须配置 HTTPS PUBLIC_BASE_URL");
  }

  if (!/^https:\/\//i.test(publicBaseUrl)) {
    throw new Error("生产环境 PUBLIC_BASE_URL 必须使用 HTTPS");
  }

  if (imageStorageProvider === "local") {
    throw new Error("生产环境不能使用本地图片存储，请配置 IMAGE_STORAGE_PROVIDER=cos 或 wechat-cloud");
  }

  if (imageStorageProvider === "cos" && !getCosPublicBaseUrl()) {
    throw new Error("生产环境使用 COS 图片存储时必须配置 COS_PUBLIC_BASE_URL");
  }

  if (imageStorageProvider === "cos" && (!getCosSecretId() || !getCosSecretKey())) {
    throw new Error("生产环境使用 COS 图片存储时必须配置 COS_SECRET_ID 和 COS_SECRET_KEY");
  }

  if (imageStorageProvider === "cos" && !getCosUploadUrl() && (!getCosBucket() || !getCosRegion())) {
    throw new Error("生产环境使用 COS 图片存储时必须配置 COS_UPLOAD_URL，或同时配置 COS_BUCKET 和 COS_REGION");
  }

  if (imageStorageProvider === "wechat-cloud" && !getWechatCloudEnv()) {
    throw new Error("生产环境使用微信云存储时必须配置 WECHAT_CLOUD_ENV");
  }

  if (!databaseUrl) {
    throw new Error("生产环境必须配置 DATABASE_URL，不能使用内存 mock store");
  }

  assertDataStoreReady();
  assertAiTaskQueueReady();
  assertContentSafetyReady();

  if (!wechatAppId || !wechatAppSecret) {
    throw new Error("生产环境必须配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET");
  }

  if (!authTokenSecret || authTokenSecret === "dev-only-auth-secret-change-me" || authTokenSecret.length < 32) {
    throw new Error("生产环境必须配置至少 32 位的 AUTH_TOKEN_SECRET");
  }
}
