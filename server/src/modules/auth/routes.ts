import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserRepository } from "../../store/userRepository";
import { ok } from "../../utils/response";
import { parseWithSchema } from "../../utils/validation";
import { createSessionToken } from "./token";
import { exchangeWechatCodeForSession } from "./wechatSession";

const wechatLoginBodySchema = z.object({
  code: z.string().min(1).max(128),
  nickname: z.string().max(80).optional(),
  avatarUrl: z.string().url().or(z.literal("")).optional()
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/wechat-login", async (request) => {
    const body = parseWithSchema(wechatLoginBodySchema, request.body);
    const session = await exchangeWechatCodeForSession(body.code);
    const user = await getUserRepository().upsertWechatUser({
      openid: session.openid,
      nickname: body.nickname,
      avatarUrl: body.avatarUrl
    });

    const sessionToken = createSessionToken(user);

    return ok({
      token: sessionToken.token,
      expiresIn: sessionToken.expiresIn,
      user
    });
  });
}
