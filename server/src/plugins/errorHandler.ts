import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { fail } from "../utils/response";

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(fail(error.code, error.message, error.details));
    }

    if (error instanceof ZodError) {
      return reply.status(400).send(fail("VALIDATION_ERROR", "请求参数不合法", error.flatten()));
    }

    return reply.status(500).send(fail("INTERNAL_SERVER_ERROR", "服务器内部错误"));
  });
}
