import { assertDataStoreReady } from "../store";

export function assertProductionReady(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const provider = process.env.IMAGE_GENERATION_PROVIDER;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
  const uploadDir = process.env.UPLOAD_DIR ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const wechatAppId = process.env.WECHAT_APP_ID ?? "";
  const wechatAppSecret = process.env.WECHAT_APP_SECRET ?? "";
  const authTokenSecret = process.env.AUTH_TOKEN_SECRET ?? "";

  if (!provider || provider === "mock") {
    throw new Error("生产环境必须配置真实 IMAGE_GENERATION_PROVIDER");
  }

  if (!publicBaseUrl || /^http:\/\/localhost(?::\d+)?$/i.test(publicBaseUrl)) {
    throw new Error("生产环境必须配置 HTTPS PUBLIC_BASE_URL");
  }

  if (!/^https:\/\//i.test(publicBaseUrl)) {
    throw new Error("生产环境 PUBLIC_BASE_URL 必须使用 HTTPS");
  }

  if (!uploadDir) {
    throw new Error("生产环境必须配置 UPLOAD_DIR 或接入对象存储");
  }

  if (!databaseUrl) {
    throw new Error("生产环境必须配置 DATABASE_URL，不能使用内存 mock store");
  }

  assertDataStoreReady();

  if (!wechatAppId || !wechatAppSecret) {
    throw new Error("生产环境必须配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET");
  }

  if (!authTokenSecret || authTokenSecret === "dev-only-auth-secret-change-me" || authTokenSecret.length < 32) {
    throw new Error("生产环境必须配置至少 32 位的 AUTH_TOKEN_SECRET");
  }
}
