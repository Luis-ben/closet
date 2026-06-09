import { z } from "zod";
import { AppError } from "../../utils/errors";

const code2SessionResponseSchema = z.object({
  openid: z.string().min(1).optional(),
  session_key: z.string().min(1).optional(),
  unionid: z.string().optional(),
  errcode: z.number().optional(),
  errmsg: z.string().optional()
});

export interface WechatSession {
  openid: string;
  sessionKey: string | null;
  unionid: string | null;
}

function canUseMockWechatSession(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WECHAT_LOGIN_PROVIDER !== "wechat";
}

function createMockSession(code: string): WechatSession {
  return {
    openid: `openid_${code.slice(0, 32)}`,
    sessionKey: null,
    unionid: null
  };
}

export async function exchangeWechatCodeForSession(code: string): Promise<WechatSession> {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    if (canUseMockWechatSession()) {
      return createMockSession(code);
    }

    throw new AppError(500, "WECHAT_LOGIN_NOT_CONFIGURED", "微信登录未完成生产配置");
  }

  const params = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: code,
    grant_type: "authorization_code"
  });
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`);

  if (!response.ok) {
    throw new AppError(502, "WECHAT_CODE2SESSION_FAILED", "微信登录服务暂不可用");
  }

  const result = code2SessionResponseSchema.parse(await response.json());

  if (result.errcode || !result.openid) {
    throw new AppError(401, "WECHAT_LOGIN_FAILED", result.errmsg ?? "微信登录失败");
  }

  return {
    openid: result.openid,
    sessionKey: result.session_key ?? null,
    unionid: result.unionid ?? null
  };
}
