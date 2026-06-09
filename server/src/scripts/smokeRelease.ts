import "dotenv/config";
import type { FastifyInstance } from "fastify";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface LoginResponse {
  token: string;
}

interface ClothingItem {
  _id: string;
  useCount: number;
}

interface ClothingItemResponse {
  item: ClothingItem;
}

interface ClothingItemsResponse {
  items: ClothingItem[];
}

interface UserPhotoResponse {
  photo: {
    _id: string;
  };
}

interface AiTaskResponse {
  taskId: string;
}

interface AiTaskStatusResponse {
  task: {
    status: string;
    resultImageUrl: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
}

interface CreditLogsResponse {
  items: Array<{
    change: number;
  }>;
}

const imageMeta = {
  mimeType: "image/png",
  sizeBytes: 1200
};

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "dev-secret-for-smoke-test";
  process.env.AI_TASK_QUEUE_PROVIDER = "memory";
  process.env.IMAGE_STORAGE_PROVIDER = "local";
  process.env.IMAGE_GENERATION_PROVIDER = "mock";
  process.env.CONTENT_SAFETY_PROVIDER = "mock";

  const { buildApp } = await import("../app");
  const app = await buildApp();

  try {
    const token = await login(app);
    const headers = {
      authorization: `Bearer ${token}`
    };

    const uploadToken = await app.inject({
      method: "POST",
      url: "/api/uploads/image-token",
      headers,
      payload: {
        fileName: "smoke.png",
        mimeType: "image/png",
        sizeBytes: imageMeta.sizeBytes
      }
    });
    assertStatus(uploadToken.statusCode, 200, "上传票据");

    const clothingId = await createClothingItem(app, headers);
    await assertRejectedContent(app, headers);
    await createModel(app, headers);
    await assertDuplicateClothingRejected(app, headers, clothingId);

    const taskId = await createTryOnTask(app, headers, clothingId);
    const finalTask = await waitForTask(app, headers, taskId);

    if (finalTask.status !== "success" || !finalTask.resultImageUrl) {
      throw new Error(
        `AI 任务未成功生成结果图：status=${finalTask.status}, errorCode=${finalTask.errorCode ?? ""}, errorMessage=${finalTask.errorMessage ?? ""}`
      );
    }

    await assertCreditLogs(app, headers);
    await assertUseCount(app, headers);
    await assertPrivacyDeletion(app, headers);

    console.log("发布前 smoke test 通过。");
  } finally {
    await app.close();
  }
}

async function login(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/wechat-login",
    payload: {
      code: `smoke-${Date.now()}`,
      nickname: "Smoke Test"
    }
  });
  assertStatus(response.statusCode, 200, "登录");

  const body = parseBody<LoginResponse>(response.body);

  if (!body.data?.token) {
    throw new Error("登录未返回 token");
  }

  return body.data.token;
}

async function createClothingItem(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/clothing-items",
    headers,
    payload: {
      imageUrl: "https://placehold.co/768x1024/png?text=Smoke+Cloth",
      imageMeta,
      sourceType: "album",
      category: "top",
      color: "white",
      season: ["all"],
      occasion: ["casual"],
      note: "smoke clean"
    }
  });
  assertStatus(response.statusCode, 200, "创建衣物");

  const body = parseBody<ClothingItemResponse>(response.body);
  const clothingId = body.data?.item._id;

  if (!clothingId) {
    throw new Error("创建衣物未返回 item id");
  }

  return clothingId;
}

async function createModel(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: "/api/user-photos",
    headers,
    payload: {
      imageUrl: "https://placehold.co/768x1024/png?text=Smoke+Model",
      imageMeta,
      displayName: "Smoke Model"
    }
  });
  assertStatus(response.statusCode, 200, "创建模特");

  const body = parseBody<UserPhotoResponse>(response.body);

  if (!body.data?.photo._id) {
    throw new Error("创建模特未返回 photo id");
  }
}

async function createTryOnTask(
  app: FastifyInstance,
  headers: Record<string, string>,
  clothingId: string
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/ai/outfit-render",
    headers,
    payload: {
      clothingItemIds: [clothingId],
      scene: "commute",
      style: "minimal",
      mode: "quick",
      shareable: true
    }
  });
  assertStatus(response.statusCode, 202, "创建 AI 任务");

  const body = parseBody<AiTaskResponse>(response.body);
  const taskId = body.data?.taskId;

  if (!taskId) {
    throw new Error("创建 AI 任务未返回 taskId");
  }

  return taskId;
}

async function waitForTask(
  app: FastifyInstance,
  headers: Record<string, string>,
  taskId: string
): Promise<AiTaskStatusResponse["task"]> {
  for (let index = 0; index < 8; index += 1) {
    await wait(600);
    const response = await app.inject({
      method: "GET",
      url: `/api/ai/tasks/${taskId}`,
      headers
    });
    assertStatus(response.statusCode, 200, "查询 AI 任务");

    const body = parseBody<AiTaskStatusResponse>(response.body);
    const task = body.data?.task;

    if (task?.status === "success" || task?.status === "failed") {
      return task;
    }
  }

  throw new Error("AI 任务超时未完成");
}

async function assertCreditLogs(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<void> {
  const response = await app.inject({
    method: "GET",
    url: "/api/credits/logs",
    headers
  });
  assertStatus(response.statusCode, 200, "查询额度流水");

  const changes = parseBody<CreditLogsResponse>(response.body).data?.items.map((item) => item.change) ?? [];

  if (!changes.includes(3) || !changes.includes(-1)) {
    throw new Error(`额度流水异常：${changes.join(",")}`);
  }
}

async function assertUseCount(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<void> {
  const response = await app.inject({
    method: "GET",
    url: "/api/clothing-items",
    headers
  });
  assertStatus(response.statusCode, 200, "查询衣物列表");

  const useCount = parseBody<ClothingItemsResponse>(response.body).data?.items[0]?.useCount;

  if (useCount !== 1) {
    throw new Error(`衣物使用次数异常：${useCount}`);
  }
}

async function assertPrivacyDeletion(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<void> {
  const deleteClothing = await app.inject({
    method: "POST",
    url: "/api/privacy/delete-clothing-items",
    headers
  });
  assertStatus(deleteClothing.statusCode, 200, "隐私删除衣物");

  const deleteModels = await app.inject({
    method: "POST",
    url: "/api/privacy/delete-models",
    headers
  });
  assertStatus(deleteModels.statusCode, 200, "隐私删除模特");
}

async function assertRejectedContent(
  app: FastifyInstance,
  headers: Record<string, string>
): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: "/api/clothing-items",
    headers,
    payload: {
      imageUrl: "https://placehold.co/768x1024/png?text=Smoke+Risk+Text",
      imageMeta,
      sourceType: "album",
      category: "top",
      color: "black",
      season: ["all"],
      occasion: ["casual"],
      note: "porn"
    }
  });

  assertErrorCode(response.body, "CONTENT_SAFETY_REJECTED", "风险内容拒绝");
}

async function assertDuplicateClothingRejected(
  app: FastifyInstance,
  headers: Record<string, string>,
  clothingId: string
): Promise<void> {
  const response = await app.inject({
    method: "POST",
    url: "/api/ai/outfit-render",
    headers,
    payload: {
      clothingItemIds: [clothingId, clothingId],
      mode: "quick",
      shareable: true
    }
  });

  assertErrorCode(response.body, "VALIDATION_ERROR", "重复衣物拒绝");
}

function parseBody<T>(body: string): ApiResponse<T> {
  return JSON.parse(body) as ApiResponse<T>;
}

function assertStatus(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} 状态码异常：${actual}，期望 ${expected}`);
  }
}

function assertErrorCode(body: string, expectedCode: string, label: string): void {
  const response = parseBody<unknown>(body);

  if (response.error?.code !== expectedCode) {
    throw new Error(`${label} 错误码异常：${response.error?.code ?? "无"}`);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
