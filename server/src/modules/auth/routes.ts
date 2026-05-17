import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { store } from "../../store/mockStore";
import type { UserRecord } from "../../store/types";
import { createId, nowIso } from "../../utils/ids";
import { ok } from "../../utils/response";
import { parseWithSchema } from "../../utils/validation";

const wechatLoginBodySchema = z.object({
  code: z.string().min(1).max(128),
  nickname: z.string().max(80).optional(),
  avatarUrl: z.string().url().or(z.literal("")).optional()
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/wechat-login", async (request) => {
    const body = parseWithSchema(wechatLoginBodySchema, request.body);
    const openid = `openid_${body.code.slice(0, 32)}`;
    const now = nowIso();
    let user = store.users.find((item) => item.openid === openid && !item.deletedAt);

    if (!user) {
      user = {
        _id: createId("user"),
        openid,
        nickname: body.nickname ?? "微信用户",
        avatarUrl: body.avatarUrl ?? "",
        plan: "free",
        credits: 3,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      } satisfies UserRecord;

      store.users.push(user);
      store.creditLogs.push({
        _id: createId("credit_log"),
        userId: user._id,
        change: user.credits,
        reason: "signup",
        taskId: null,
        balanceAfter: user.credits,
        createdAt: now
      });
    }

    return ok({
      token: `mock-token-${user._id}`,
      user
    });
  });
}
