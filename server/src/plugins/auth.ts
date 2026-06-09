import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/errors";
import { store } from "../store/mockStore";
import { verifyDevMockToken, verifySessionToken } from "../modules/auth/token";

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate("authenticate", authenticateRequest);
}

export async function authenticateRequest(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "AUTH_REQUIRED", "请先登录");
  }

  const token = authorization.slice("Bearer ".length);
  const session = verifySessionToken(token) ?? verifyDevMockToken(token);

  if (!session) {
    throw new AppError(401, "AUTH_INVALID", "登录态无效");
  }

  const user = store.users.find((item) => item._id === session.userId && !item.deletedAt);

  if (!user) {
    throw new AppError(401, "AUTH_INVALID", "登录态无效");
  }

  if (session.openid && session.openid !== user.openid) {
    throw new AppError(401, "AUTH_INVALID", "登录态无效");
  }

  request.user = {
    id: user._id,
    openid: user.openid
  };
}
