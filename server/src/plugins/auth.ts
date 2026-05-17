import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/errors";
import { store } from "../store/mockStore";

const tokenPrefix = "mock-token-";

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

  if (!token.startsWith(tokenPrefix)) {
    throw new AppError(401, "AUTH_INVALID", "登录态无效");
  }

  const userId = token.slice(tokenPrefix.length);
  const user = store.users.find((item) => item._id === userId && !item.deletedAt);

  if (!user) {
    throw new AppError(401, "AUTH_INVALID", "登录态无效");
  }

  request.user = {
    id: user._id,
    openid: user.openid
  };
}
